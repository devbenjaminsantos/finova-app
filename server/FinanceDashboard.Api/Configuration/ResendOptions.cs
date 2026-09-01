namespace FinanceDashboard.Api.Configuration
{
    public sealed class ResendOptions
    {
        public const string SectionName = "Resend";
        public const int DefaultTimeoutSeconds = 8;
        public const int MaximumTimeoutSeconds = 30;

        public string ApiKey { get; init; } = string.Empty;
        public string FromEmail { get; init; } = string.Empty;
        public string FromName { get; init; } = "Héstia";
        public int TimeoutSeconds { get; init; } = DefaultTimeoutSeconds;
    }
}
