namespace FinanceDashboard.Api.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool EmailConfirmed { get; set; }
        public bool? OnboardingOptIn { get; set; }
        public bool EmailGoalAlertsEnabled { get; set; }
        public int GoalAlertThresholdPercent { get; set; } = 80;
        public bool MonthlyReportEmailsEnabled { get; set; }
        public int MonthlyReportDay { get; set; } = 1;
        public bool PublicDashboardEnabled { get; set; }
        public string? PublicDashboardTokenHash { get; set; }
        public bool IsDemoAccount { get; set; }
        public DateTime? DemoExpiresAtUtc { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public int SessionVersion { get; set; } = 1;
        public int FailedLoginAttempts { get; set; }
        public DateTime? LockoutEndsAtUtc { get; set; }
        public DateTime? LastFailedLoginAtUtc { get; set; }

        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
        public ICollection<RecurringRule> RecurringRules { get; set; } = new List<RecurringRule>();
        public ICollection<InstallmentPlan> InstallmentPlans { get; set; } = new List<InstallmentPlan>();
        public ICollection<TransactionTag> TransactionTags { get; set; } = new List<TransactionTag>();
        public ICollection<FinancialAccount> FinancialAccounts { get; set; } = new List<FinancialAccount>();
        public ICollection<BudgetGoal> BudgetGoals { get; set; } = new List<BudgetGoal>();
        public ICollection<NotificationDelivery> NotificationDeliveries { get; set; } = new List<NotificationDelivery>();
        public ICollection<EmailVerificationToken> EmailVerificationTokens { get; set; } = new List<EmailVerificationToken>();
        public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
        public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    }
}
