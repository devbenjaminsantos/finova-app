using FinanceDashboard.Api.Models;

namespace FinanceDashboard.Api.Services.Notifications
{
    public interface INotificationDeliveryCoordinator
    {
        Task<bool> TryDeliverAsync(
            NotificationDelivery delivery,
            Func<Task> sendAsync,
            CancellationToken cancellationToken = default);
    }
}
