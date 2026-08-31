using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Email;
using FinanceDashboard.Api.Services.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class FinancialEmailAutomationServiceTests
{
    [Fact]
    public async Task ProcessAsync_MatchesGoalCategoryIgnoringLetterCase()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var user = new User
        {
            Id = 6,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 80
        };

        context.Users.Add(user);
        context.BudgetGoals.Add(new BudgetGoal
        {
            UserId = user.Id,
            Month = "2026-04",
            Category = "Mercado",
            AmountCents = 100_00
        });
        context.Transactions.Add(new Transaction
        {
            UserId = user.Id,
            Description = "Compra",
            Category = "MERCADO",
            AmountCents = 85_00,
            Date = new DateTime(2026, 4, 10),
            Type = "expense"
        });
        await context.SaveChangesAsync();

        var service = CreateService(context, emailSender);

        await service.ProcessAsync(new DateTime(2026, 4, 15));

        Assert.Single(emailSender.GoalAlerts);
    }

    [Fact]
    public async Task ProcessAsync_SendsGoalAlertOnce_WhenThresholdIsReached()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var user = new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 80
        };

        context.Users.Add(user);
        context.BudgetGoals.Add(new BudgetGoal
        {
            UserId = user.Id,
            Month = "2026-04",
            Category = string.Empty,
            AmountCents = 100_00
        });
        context.Transactions.Add(new Transaction
        {
            UserId = user.Id,
            Description = "Mercado",
            Category = "Alimentacao",
            AmountCents = 85_00,
            Date = new DateTime(2026, 4, 10),
            Type = "expense"
        });
        await context.SaveChangesAsync();

        var service = CreateService(context, emailSender);

        await service.ProcessAsync(new DateTime(2026, 4, 15));
        await service.ProcessAsync(new DateTime(2026, 4, 15));

        Assert.Single(emailSender.GoalAlerts);
        Assert.Single(context.NotificationDeliveries.Where(delivery => delivery.NotificationType == "goal_alert"));
    }

    [Fact]
    public async Task ProcessAsync_SendsMonthlyReport_ForPreviousMonth_WhenEnabled()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var user = new User
        {
            Id = 8,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            MonthlyReportEmailsEnabled = true,
            MonthlyReportDay = 1
        };

        context.Users.Add(user);
        context.BudgetGoals.Add(new BudgetGoal
        {
            UserId = user.Id,
            Month = "2026-03",
            Category = "Moradia",
            AmountCents = 300_00
        });
        context.Transactions.AddRange(
            new Transaction
            {
                UserId = user.Id,
                Description = "Salario",
                Category = "Salario",
                AmountCents = 1500_00,
                Date = new DateTime(2026, 3, 5),
                Type = "income"
            },
            new Transaction
            {
                UserId = user.Id,
                Description = "Aluguel",
                Category = "Moradia",
                AmountCents = 280_00,
                Date = new DateTime(2026, 3, 6),
                Type = "expense"
            });
        await context.SaveChangesAsync();

        var service = CreateService(context, emailSender);

        await service.ProcessAsync(new DateTime(2026, 4, 1));

        Assert.Single(emailSender.MonthlyReports);
        Assert.Contains(context.NotificationDeliveries, delivery => delivery.NotificationType == "monthly_report");
    }

    [Fact]
    public async Task ProcessAsync_RetriesGoalAlert_WhenSendingFails()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender
        {
            GoalAlertFailuresRemaining = 1
        };
        AddGoalAlertScenario(context, 9);
        await context.SaveChangesAsync();

        var service = CreateService(context, emailSender);

        await service.ProcessAsync(new DateTime(2026, 4, 15));

        Assert.Empty(emailSender.GoalAlerts);
        Assert.Empty(context.NotificationDeliveries);

        await service.ProcessAsync(new DateTime(2026, 4, 15));

        Assert.Equal(2, emailSender.GoalAlertAttempts);
        Assert.Single(emailSender.GoalAlerts);
        Assert.Single(context.NotificationDeliveries);
    }

    [Fact]
    public async Task ProcessAsync_ConcurrentInstances_SendGoalAlertOnlyOnce()
    {
        var databaseName = Guid.NewGuid().ToString();
        var databaseRoot = new InMemoryDatabaseRoot();

        using (var setupContext = CreateContext(databaseName, databaseRoot))
        {
            AddGoalAlertScenario(setupContext, 10);
            await setupContext.SaveChangesAsync();
        }

        using var firstContext = CreateContext(databaseName, databaseRoot);
        using var secondContext = CreateContext(databaseName, databaseRoot);
        var emailSender = new FakeEmailSender();
        var claimState = new TestDeliveryClaimState();
        var firstService = CreateService(
            firstContext,
            emailSender,
            new TestNotificationDeliveryCoordinator(firstContext, claimState));
        var secondService = CreateService(
            secondContext,
            emailSender,
            new TestNotificationDeliveryCoordinator(secondContext, claimState));

        await Task.WhenAll(
            firstService.ProcessAsync(new DateTime(2026, 4, 15)),
            secondService.ProcessAsync(new DateTime(2026, 4, 15)));

        using var verificationContext = CreateContext(databaseName, databaseRoot);
        Assert.Equal(1, emailSender.GoalAlertAttempts);
        Assert.Single(emailSender.GoalAlerts);
        Assert.Single(verificationContext.NotificationDeliveries);
    }

    [Fact]
    public async Task ProcessAsync_DoesNotSendNotificationsForDemoAccounts()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var user = new User
        {
            Id = 11,
            Name = "Conta Demo",
            Email = "demo+isolada@hestia.local",
            EmailConfirmed = true,
            IsDemoAccount = true,
            DemoExpiresAtUtc = DateTime.UtcNow.AddHours(1),
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 80,
            MonthlyReportEmailsEnabled = true,
            MonthlyReportDay = 1
        };
        context.Users.Add(user);
        context.BudgetGoals.Add(new BudgetGoal
        {
            UserId = user.Id,
            Month = "2026-04",
            Category = string.Empty,
            AmountCents = 100_00
        });
        context.Transactions.AddRange(
            new Transaction
            {
                UserId = user.Id,
                Description = "Mercado",
                Category = "Alimentacao",
                AmountCents = 90_00,
                Date = new DateTime(2026, 4, 10),
                Type = "expense"
            },
            new Transaction
            {
                UserId = user.Id,
                Description = "Aluguel",
                Category = "Moradia",
                AmountCents = 280_00,
                Date = new DateTime(2026, 3, 6),
                Type = "expense"
            });
        await context.SaveChangesAsync();
        var service = CreateService(context, emailSender);

        await service.ProcessAsync(new DateTime(2026, 4, 15));

        Assert.Empty(emailSender.GoalAlerts);
        Assert.Empty(emailSender.MonthlyReports);
        Assert.Empty(context.NotificationDeliveries);
    }

    private static AppDbContext CreateContext()
    {
        return CreateContext(Guid.NewGuid().ToString(), new InMemoryDatabaseRoot());
    }

    private static AppDbContext CreateContext(
        string databaseName,
        InMemoryDatabaseRoot databaseRoot)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName, databaseRoot)
            .Options;

        return new AppDbContext(options);
    }

    private static void AddGoalAlertScenario(AppDbContext context, int userId)
    {
        context.Users.Add(new User
        {
            Id = userId,
            Name = "Keller",
            Email = $"keller-{userId}@hestia.local",
            EmailConfirmed = true,
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 80
        });
        context.BudgetGoals.Add(new BudgetGoal
        {
            UserId = userId,
            Month = "2026-04",
            Category = string.Empty,
            AmountCents = 100_00
        });
        context.Transactions.Add(new Transaction
        {
            UserId = userId,
            Description = "Mercado",
            Category = "Alimentacao",
            AmountCents = 85_00,
            Date = new DateTime(2026, 4, 10),
            Type = "expense"
        });
    }

    private static FinancialEmailAutomationService CreateService(
        AppDbContext context,
        FakeEmailSender emailSender,
        INotificationDeliveryCoordinator? deliveryCoordinator = null)
    {
        var logger = NullLogger<FinancialEmailAutomationService>.Instance;

        return deliveryCoordinator is null
            ? new FinancialEmailAutomationService(context, emailSender, logger)
            : new FinancialEmailAutomationService(context, emailSender, logger, deliveryCoordinator);
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public List<string> GoalAlerts { get; } = new();
        public List<string> MonthlyReports { get; } = new();
        public int GoalAlertAttempts { get; private set; }
        public int GoalAlertFailuresRemaining { get; init; }

        public Task SendPasswordResetEmailAsync(string toEmail, string name, string resetUrl)
        {
            return Task.CompletedTask;
        }

        public Task SendEmailVerificationAsync(string toEmail, string name, string verificationUrl)
        {
            return Task.CompletedTask;
        }

        public Task SendBudgetGoalAlertEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount)
        {
            lock (GoalAlerts)
            {
                GoalAlertAttempts++;

                if (GoalAlertAttempts <= GoalAlertFailuresRemaining)
                {
                    throw new InvalidOperationException("Falha simulada no envio.");
                }

                GoalAlerts.Add($"{toEmail}:{monthLabel}:{goalLabel}:{progressPercent}");
            }

            return Task.CompletedTask;
        }

        public Task SendMonthlySummaryEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            decimal incomeAmount,
            decimal expenseAmount,
            decimal balanceAmount,
            string? topExpenseCategory,
            decimal? topExpenseAmount,
            IReadOnlyList<MonthlyGoalSummary> goalSummaries)
        {
            MonthlyReports.Add($"{toEmail}:{monthLabel}:{incomeAmount}:{expenseAmount}");
            return Task.CompletedTask;
        }
    }

    private sealed class TestDeliveryClaimState
    {
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public HashSet<string> DeliveredKeys { get; } = new(StringComparer.Ordinal);
    }

    private sealed class TestNotificationDeliveryCoordinator : INotificationDeliveryCoordinator
    {
        private readonly AppDbContext _context;
        private readonly TestDeliveryClaimState _claimState;

        public TestNotificationDeliveryCoordinator(
            AppDbContext context,
            TestDeliveryClaimState claimState)
        {
            _context = context;
            _claimState = claimState;
        }

        public async Task<bool> TryDeliverAsync(
            NotificationDelivery delivery,
            Func<Task> sendAsync,
            CancellationToken cancellationToken = default)
        {
            var key = $"{delivery.UserId}|{delivery.NotificationType}|{delivery.ReferenceKey}";
            await _claimState.Gate.WaitAsync(cancellationToken);

            try
            {
                if (!_claimState.DeliveredKeys.Add(key))
                {
                    return false;
                }

                try
                {
                    await sendAsync();
                    _context.NotificationDeliveries.Add(delivery);
                    await _context.SaveChangesAsync(cancellationToken);
                    return true;
                }
                catch
                {
                    _claimState.DeliveredKeys.Remove(key);
                    throw;
                }
            }
            finally
            {
                _claimState.Gate.Release();
            }
        }
    }
}
