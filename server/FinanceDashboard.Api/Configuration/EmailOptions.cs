namespace FinanceDashboard.Api.Configuration
{
    public sealed class EmailOptions
    {
        public const string SectionName = "Email";

        public bool Enabled { get; init; }
        public string Provider { get; init; } = "Resend";
    }
}
