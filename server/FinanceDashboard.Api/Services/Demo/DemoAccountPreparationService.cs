using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Data;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Auth;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FinanceDashboard.Api.Services.Demo
{
    public sealed class DemoAccountPreparationService
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> NonRelationalLocks = new();

        private readonly AppDbContext _context;
        private readonly PasswordHasher _passwordHasher;

        public DemoAccountPreparationService(AppDbContext context, PasswordHasher passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
        }

        public async Task<User> PrepareAsync(
            DemoAccountOptions options,
            CancellationToken cancellationToken = default)
        {
            var sessionEmail = CreateSessionEmail(options.Email);

            if (_context.Database.IsRelational())
            {
                return await PrepareRelationalAsync(options, sessionEmail, cancellationToken);
            }

            return await PrepareNonRelationalAsync(options, sessionEmail, cancellationToken);
        }

        private async Task<User> PrepareRelationalAsync(
            DemoAccountOptions options,
            string sessionEmail,
            CancellationToken cancellationToken)
        {
            if (!_context.Database.IsSqlServer() && !_context.Database.IsNpgsql())
            {
                throw new NotSupportedException(
                    "A coordenação distribuída da conta demo requer SQL Server ou PostgreSQL.");
            }

            var executionStrategy = _context.Database.CreateExecutionStrategy();

            return await executionStrategy.ExecuteAsync(async () =>
            {
                _context.ChangeTracker.Clear();

                await using var transaction = await _context.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

                await AcquireRelationalLockAsync(options, cancellationToken);
                var user = await CreateIsolatedDemoAccountAsync(
                    options,
                    sessionEmail,
                    useSetBasedDeletes: true,
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return user;
            });
        }

        private async Task<User> PrepareNonRelationalAsync(
            DemoAccountOptions options,
            string sessionEmail,
            CancellationToken cancellationToken)
        {
            // EF InMemory is used only by focused tests. Production uses a database
            // transaction lock, which coordinates cleanup across API instances.
            var coordinationLock = NonRelationalLocks.GetOrAdd(
                options.Email,
                static _ => new SemaphoreSlim(1, 1));

            if (!await coordinationLock.WaitAsync(options.LockTimeout, cancellationToken))
            {
                throw new DemoAccountPreparationUnavailableException();
            }

            try
            {
                return await CreateIsolatedDemoAccountAsync(
                    options,
                    sessionEmail,
                    useSetBasedDeletes: false,
                    cancellationToken);
            }
            finally
            {
                coordinationLock.Release();
            }
        }

        private Task AcquireRelationalLockAsync(
            DemoAccountOptions options,
            CancellationToken cancellationToken)
        {
            return _context.Database.IsNpgsql()
                ? AcquirePostgreSqlLockAsync(options, cancellationToken)
                : AcquireSqlServerLockAsync(options, cancellationToken);
        }

        private async Task AcquireSqlServerLockAsync(
            DemoAccountOptions options,
            CancellationToken cancellationToken)
        {
            var result = new SqlParameter("@result", SqlDbType.Int)
            {
                Direction = ParameterDirection.Output
            };
            var resource = new SqlParameter(
                "@resource",
                $"Finova:DemoAccount:{options.Email}");
            var timeout = new SqlParameter(
                "@timeout",
                checked((int)options.LockTimeout.TotalMilliseconds));

            await _context.Database.ExecuteSqlRawAsync(
                "EXEC @result = sys.sp_getapplock " +
                "@Resource = @resource, " +
                "@LockMode = 'Exclusive', " +
                "@LockOwner = 'Transaction', " +
                "@LockTimeout = @timeout;",
                new object[] { result, resource, timeout },
                cancellationToken);

            if (result.Value is not int lockResult || lockResult < 0)
            {
                throw new DemoAccountPreparationUnavailableException();
            }
        }

        private async Task AcquirePostgreSqlLockAsync(
            DemoAccountOptions options,
            CancellationToken cancellationToken)
        {
            var resource = $"Finova:DemoAccount:{options.Email}";
            var lockKey = CreatePostgreSqlLockKey(resource);
            var elapsed = Stopwatch.StartNew();

            while (elapsed.Elapsed < options.LockTimeout)
            {
                if (await TryAcquirePostgreSqlLockAsync(lockKey, cancellationToken))
                {
                    return;
                }

                var remaining = options.LockTimeout - elapsed.Elapsed;
                if (remaining <= TimeSpan.Zero)
                {
                    break;
                }

                await Task.Delay(
                    remaining < TimeSpan.FromMilliseconds(100)
                        ? remaining
                        : TimeSpan.FromMilliseconds(100),
                    cancellationToken);
            }

            throw new DemoAccountPreparationUnavailableException();
        }

        private async Task<bool> TryAcquirePostgreSqlLockAsync(
            long lockKey,
            CancellationToken cancellationToken)
        {
            var connection = _context.Database.GetDbConnection();
            var transaction = _context.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException(
                    "A transação da conta demo não foi iniciada.");

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "SELECT pg_try_advisory_xact_lock(@lock_key);";

            var parameter = command.CreateParameter();
            parameter.ParameterName = "@lock_key";
            parameter.DbType = DbType.Int64;
            parameter.Value = lockKey;
            command.Parameters.Add(parameter);

            return await command.ExecuteScalarAsync(cancellationToken) is true;
        }

        private static long CreatePostgreSqlLockKey(string resource)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(resource));
            return BinaryPrimitives.ReadInt64BigEndian(hash);
        }

        private async Task<User> CreateIsolatedDemoAccountAsync(
            DemoAccountOptions options,
            string sessionEmail,
            bool useSetBasedDeletes,
            CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            if (useSetBasedDeletes)
            {
                await DeleteExpiredDemoAccountsSetBasedAsync(now, cancellationToken);
            }
            else
            {
                await DeleteExpiredDemoAccountsTrackedAsync(now, cancellationToken);
            }

            var existingUser = await _context.Users
                .FirstOrDefaultAsync(
                    user => user.IsDemoAccount && user.Email == sessionEmail,
                    cancellationToken);

            if (existingUser is not null)
            {
                return existingUser;
            }

            var user = new User
            {
                Name = options.Name,
                Email = sessionEmail,
                EmailConfirmed = true,
                OnboardingOptIn = false,
                EmailGoalAlertsEnabled = false,
                GoalAlertThresholdPercent = 80,
                MonthlyReportEmailsEnabled = false,
                MonthlyReportDay = 1,
                PublicDashboardEnabled = false,
                PublicDashboardTokenHash = null,
                IsDemoAccount = true,
                DemoExpiresAtUtc = now.Add(options.SessionLifetime),
                SessionVersion = 1
            };
            user.PasswordHash = _passwordHasher.HashPassword(
                user,
                Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));

            _context.Users.Add(user);
            await _context.SaveChangesAsync(cancellationToken);

            _context.Transactions.AddRange(CreateSeedTransactions(user.Id));
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = user.Id,
                Action = "auth.demo-created",
                EntityType = "User",
                EntityId = user.Id.ToString(),
                Summary = "Conta demo efêmera criada para apresentação.",
                CreatedAtUtc = now
            });
            await _context.SaveChangesAsync(cancellationToken);

            return user;
        }

        private async Task DeleteExpiredDemoAccountsSetBasedAsync(
            DateTime now,
            CancellationToken cancellationToken)
        {
            var accountIds = _context.Users
                .Where(user => user.IsDemoAccount && user.DemoExpiresAtUtc <= now)
                .Select(user => user.Id);

            await _context.TransactionTagLinks
                .Where(link =>
                    accountIds.Contains(link.Transaction.UserId) ||
                    accountIds.Contains(link.TransactionTag.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.Transactions
                .Where(transaction => accountIds.Contains(transaction.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.RecurringRules
                .Where(rule => accountIds.Contains(rule.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.InstallmentPlans
                .Where(plan => accountIds.Contains(plan.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.FinancialAccounts
                .Where(account => accountIds.Contains(account.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.TransactionTags
                .Where(tag => accountIds.Contains(tag.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.BudgetGoals
                .Where(goal => accountIds.Contains(goal.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.NotificationDeliveries
                .Where(delivery => accountIds.Contains(delivery.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.EmailVerificationTokens
                .Where(token => accountIds.Contains(token.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.PasswordResetTokens
                .Where(token => accountIds.Contains(token.UserId))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.AuditLogs
                .Where(log => log.UserId.HasValue && accountIds.Contains(log.UserId.Value))
                .ExecuteDeleteAsync(cancellationToken);
            await _context.Users
                .Where(user => accountIds.Contains(user.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }

        private async Task DeleteExpiredDemoAccountsTrackedAsync(
            DateTime now,
            CancellationToken cancellationToken)
        {
            var accountIds = await _context.Users
                .Where(user => user.IsDemoAccount && user.DemoExpiresAtUtc <= now)
                .Select(user => user.Id)
                .ToListAsync(cancellationToken);

            if (accountIds.Count == 0)
            {
                return;
            }

            _context.TransactionTagLinks.RemoveRange(await _context.TransactionTagLinks
                .Where(link =>
                    accountIds.Contains(link.Transaction.UserId) ||
                    accountIds.Contains(link.TransactionTag.UserId))
                .ToListAsync(cancellationToken));
            _context.Transactions.RemoveRange(await _context.Transactions
                .Where(transaction => accountIds.Contains(transaction.UserId))
                .ToListAsync(cancellationToken));
            _context.RecurringRules.RemoveRange(await _context.RecurringRules
                .Where(rule => accountIds.Contains(rule.UserId))
                .ToListAsync(cancellationToken));
            _context.InstallmentPlans.RemoveRange(await _context.InstallmentPlans
                .Where(plan => accountIds.Contains(plan.UserId))
                .ToListAsync(cancellationToken));
            _context.FinancialAccounts.RemoveRange(await _context.FinancialAccounts
                .Where(account => accountIds.Contains(account.UserId))
                .ToListAsync(cancellationToken));
            _context.TransactionTags.RemoveRange(await _context.TransactionTags
                .Where(tag => accountIds.Contains(tag.UserId))
                .ToListAsync(cancellationToken));
            _context.BudgetGoals.RemoveRange(await _context.BudgetGoals
                .Where(goal => accountIds.Contains(goal.UserId))
                .ToListAsync(cancellationToken));
            _context.NotificationDeliveries.RemoveRange(await _context.NotificationDeliveries
                .Where(delivery => accountIds.Contains(delivery.UserId))
                .ToListAsync(cancellationToken));
            _context.EmailVerificationTokens.RemoveRange(await _context.EmailVerificationTokens
                .Where(token => accountIds.Contains(token.UserId))
                .ToListAsync(cancellationToken));
            _context.PasswordResetTokens.RemoveRange(await _context.PasswordResetTokens
                .Where(token => accountIds.Contains(token.UserId))
                .ToListAsync(cancellationToken));
            _context.AuditLogs.RemoveRange(await _context.AuditLogs
                .Where(log => log.UserId.HasValue && accountIds.Contains(log.UserId.Value))
                .ToListAsync(cancellationToken));
            _context.Users.RemoveRange(await _context.Users
                .Where(user => accountIds.Contains(user.Id))
                .ToListAsync(cancellationToken));
            await _context.SaveChangesAsync(cancellationToken);
        }

        private static string CreateSessionEmail(string emailTemplate)
        {
            var separatorIndex = emailTemplate.LastIndexOf('@');
            var localPart = emailTemplate[..separatorIndex];
            var domain = emailTemplate[(separatorIndex + 1)..];
            var sessionId = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
            return $"{localPart}+{sessionId}@{domain}";
        }

        private static IReadOnlyList<Transaction> CreateSeedTransactions(int userId)
        {
            var today = DateTime.UtcNow.Date;

            return new[]
            {
                new Transaction
                {
                    UserId = userId,
                    Description = "Salário",
                    Category = "Receita fixa",
                    AmountCents = 720000,
                    Date = today.AddDays(-5),
                    Type = "income"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Mercado do mês",
                    Category = "Alimentação",
                    AmountCents = 86540,
                    Date = today.AddDays(-4),
                    Type = "expense"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Aluguel",
                    Category = "Moradia",
                    AmountCents = 180000,
                    Date = today.AddDays(-3),
                    Type = "expense"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Freelance",
                    Category = "Receita extra",
                    AmountCents = 125000,
                    Date = today.AddDays(-2),
                    Type = "income"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Assinaturas digitais",
                    Category = "Assinaturas",
                    AmountCents = 8990,
                    Date = today.AddDays(-1),
                    Type = "expense"
                }
            };
        }
    }

    public sealed class DemoAccountPreparationUnavailableException : Exception
    {
        public DemoAccountPreparationUnavailableException()
            : base("A conta demo está sendo preparada por outra solicitação.")
        {
        }
    }
}
