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

            if (!_context.Database.IsSqlServer())
            {
                throw new NotSupportedException(
                    "A entrega idempotente de notificacoes requer SQL Server.");
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
                var lockResult = await AcquireTransactionLockAsync(delivery, cancellationToken);

                if (lockResult < 0)
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

        private async Task<int> AcquireTransactionLockAsync(
            NotificationDelivery delivery,
            CancellationToken cancellationToken)
        {
            var connection = _context.Database.GetDbConnection();
            var transaction = _context.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException("A transacao de notificacao nao foi iniciada.");

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "sys.sp_getapplock";
            command.CommandType = CommandType.StoredProcedure;

            AddParameter(command, "@Resource", BuildLockResource(delivery), DbType.String, 255);
            AddParameter(command, "@LockMode", "Exclusive", DbType.String, 32);
            AddParameter(command, "@LockOwner", "Transaction", DbType.String, 32);
            AddParameter(command, "@LockTimeout", 0, DbType.Int32);

            var returnValue = command.CreateParameter();
            returnValue.ParameterName = "@RETURN_VALUE";
            returnValue.DbType = DbType.Int32;
            returnValue.Direction = ParameterDirection.ReturnValue;
            command.Parameters.Add(returnValue);

            await command.ExecuteNonQueryAsync(cancellationToken);

            return Convert.ToInt32(returnValue.Value, CultureInfo.InvariantCulture);
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

        private static string BuildLockResource(NotificationDelivery delivery)
        {
            var deliveryKey = string.Join(
                '|',
                delivery.UserId.ToString(CultureInfo.InvariantCulture),
                delivery.NotificationType,
                delivery.ReferenceKey);
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(deliveryKey));
            return $"Finova.NotificationDelivery.{Convert.ToHexString(hash)}";
        }
    }
}
