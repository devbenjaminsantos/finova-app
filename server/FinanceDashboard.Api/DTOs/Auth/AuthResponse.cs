namespace FinanceDashboard.Api.DTOs
{
    public class AuthResponse
    {
        public AuthUserResponse User { get; set; } = new();
    }

    public class RegistrationResponse
    {
        public AuthUserResponse User { get; set; } = new();
        public bool VerificationEmailSent { get; set; }
    }

    public class AuthUserResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool IsDemo { get; set; }
        public bool? OnboardingOptIn { get; set; }
        public bool EmailGoalAlertsEnabled { get; set; }
        public int GoalAlertThresholdPercent { get; set; }
        public bool MonthlyReportEmailsEnabled { get; set; }
        public int MonthlyReportDay { get; set; }
        public bool PublicDashboardEnabled { get; set; }
    }
}
