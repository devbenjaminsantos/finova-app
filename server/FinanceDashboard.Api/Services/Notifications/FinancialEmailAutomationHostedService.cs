using FinanceDashboard.Api.Configuration;
using Microsoft.Extensions.Options;

namespace FinanceDashboard.Api.Services.Notifications
{
    public class FinancialEmailAutomationHostedService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly NotificationOptions _options;
        private readonly ILogger<FinancialEmailAutomationHostedService> _logger;

        public FinancialEmailAutomationHostedService(
            IServiceScopeFactory serviceScopeFactory,
            IOptions<NotificationOptions> options,
            ILogger<FinancialEmailAutomationHostedService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.Enabled)
            {
                _logger.LogInformation("Automacao de e-mails financeiros desativada.");
                return;
            }

            var intervalMinutes = Math.Max(15, _options.ProcessingIntervalMinutes);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceScopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<FinancialEmailAutomationService>();

                    await service.ProcessAsync(DateTime.UtcNow, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception, "Falha ao processar alertas e relatórios financeiros.");
                }

                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
            }
        }
    }
}
