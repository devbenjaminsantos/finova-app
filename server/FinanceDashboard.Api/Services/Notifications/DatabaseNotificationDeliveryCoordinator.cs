using System.Buffers.Binary;
using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FinanceDashboard.Api.Services.Notifications
{
    public class DatabaseNotificationDeliveryCoordinator : INotificationDeliveryCoordinator
    {
        private readonly AppDbContext _context;

        public DatabaseNotificationDeliveryCoordinator(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> TryDeliverAsync(
            NotificationDelivery delivery,
            Func<Task> sendAsync,
            CancellationToken cancellationToken = default)
        {
            if (!_context.Database.IsRelational())
            {
                return await TryDeliverWithoutDistributedLockAsync(
                    delivery,
                    sendAsync,
                    cancellationToken);
            }

            if (!_context.Database.IsSqlServer() && !_context.Database.IsNpgsql())
            {
                throw new NotSupportedException(
                    "A entrega idempotente de notificações requer SQL Server ou PostgreSQL.");
            }

            var executionStrategy = _context.Database.CreateExecutionStrategy();
            return await executionStrategy.ExecuteAsync(
                () => TryDeliverWithDistributedLockAsync(delivery, sendAsync, cancellationToken));
        }

        private async Task<bool> TryDeliverWithDistributedLockAsync(
            NotificationDelivery delivery,
            Func<Task> sendAsync,
            CancellationToken cancellationToken)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);

            try
            {
                var lockAcquired = await AcquireTransactionLockAsync(
                    delivery,
                    cancellationToken);

                if (!lockAcquired)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await transaction.RollbackAsync(CancellationToken.None);
                    return false;
                }

                var alreadyDelivered = await DeliveryExistsAsync(delivery, cancellationToken);

                if (alreadyDelivered)
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                    return false;
                }

                await sendAsync();

                _context.NotificationDeliveries.Add(delivery);
                await _context.SaveChangesAsync(CancellationToken.None);
                await transaction.CommitAsync(CancellationToken.None);
                return true;
            }
            catch
            {
                try
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                }
                catch
                {
                    // The original delivery failure is the actionable error.
                }

                _context.Entry(delivery).State = EntityState.Detached;
                throw;
            }
        }

        private async Task<bool> TryDeliverWithoutDistributedLockAsync(
            NotificationDelivery delivery,
            Func<Task> sendAsync,
            CancellationToken cancellationToken)
        {
            if (await DeliveryExistsAsync(delivery, cancellationToken))
            {
                return false;
            }

            await sendAsync();

            _context.NotificationDeliveries.Add(delivery);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        private Task<bool> DeliveryExistsAsync(
            NotificationDelivery delivery,
            CancellationToken cancellationToken)
        {
            return _context.NotificationDeliveries
                .AsNoTracking()
                .AnyAsync(existing =>
                    existing.UserId == delivery.UserId &&
                    existing.NotificationType == delivery.NotificationType &&
                    existing.ReferenceKey == delivery.ReferenceKey,
                    cancellationToken);
        }

        private Task<bool> AcquireTransactionLockAsync(
            NotificationDelivery delivery,
            CancellationToken cancellationToken)
        {
            return _context.Database.IsNpgsql()
                ? AcquirePostgreSqlTransactionLockAsync(delivery, cancellationToken)
                : AcquireSqlServerTransactionLockAsync(delivery, cancellationToken);
        }

        private async Task<bool> AcquireSqlServerTransactionLockAsync(
            NotificationDelivery delivery,
            CancellationToken cancellationToken)
        {
            var connection = _context.Database.GetDbConnection();
            var transaction = _context.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException("A transação de notificação não foi iniciada.");

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "sys.sp_getapplock";
            command.CommandType = CommandType.StoredProcedure;

            AddParameter(command, "@Resource", BuildSqlServerLockResource(delivery), DbType.String, 255);
            AddParameter(command, "@LockMode", "Exclusive", DbType.String, 32);
            AddParameter(command, "@LockOwner", "Transaction", DbType.String, 32);
            AddParameter(command, "@LockTimeout", 0, DbType.Int32);

            var returnValue = command.CreateParameter();
            returnValue.ParameterName = "@RETURN_VALUE";
            returnValue.DbType = DbType.Int32;
            returnValue.Direction = ParameterDirection.ReturnValue;
            command.Parameters.Add(returnValue);

            await command.ExecuteNonQueryAsync(cancellationToken);

            return Convert.ToInt32(returnValue.Value, CultureInfo.InvariantCulture) >= 0;
        }

        private async Task<bool> AcquirePostgreSqlTransactionLockAsync(
            NotificationDelivery delivery,
            CancellationToken cancellationToken)
        {
            var connection = _context.Database.GetDbConnection();
            var transaction = _context.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException("A transação de notificação não foi iniciada.");

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "SELECT pg_try_advisory_xact_lock(@lock_key);";

            AddParameter(
                command,
                "@lock_key",
                BuildPostgreSqlLockKey(delivery),
                DbType.Int64);

            return await command.ExecuteScalarAsync(cancellationToken) is true;
        }

        private static void AddParameter(
            System.Data.Common.DbCommand command,
            string name,
            object value,
            DbType dbType,
            int? size = null)
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value;
            parameter.DbType = dbType;

            if (size.HasValue)
            {
                parameter.Size = size.Value;
            }

            command.Parameters.Add(parameter);
        }

        private static string BuildSqlServerLockResource(NotificationDelivery delivery)
        {
            return $"Finova.NotificationDelivery.{Convert.ToHexString(BuildLockHash(delivery))}";
        }

        private static long BuildPostgreSqlLockKey(NotificationDelivery delivery)
        {
            return BinaryPrimitives.ReadInt64BigEndian(BuildLockHash(delivery));
        }

        private static byte[] BuildLockHash(NotificationDelivery delivery)
        {
            var deliveryKey = string.Join(
                '|',
                delivery.UserId.ToString(CultureInfo.InvariantCulture),
                delivery.NotificationType,
                delivery.ReferenceKey);
            return SHA256.HashData(Encoding.UTF8.GetBytes(deliveryKey));
        }
    }
}
