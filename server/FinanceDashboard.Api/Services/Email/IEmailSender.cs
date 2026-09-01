namespace FinanceDashboard.Api.Services.Email
{
    using FinanceDashboard.Api.Services.Notifications;

    public interface IEmailSender
    {
        Task<EmailSendResult> SendPasswordResetEmailAsync(
            string toEmail,
            string name,
            string resetUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default);
        Task<EmailSendResult> SendEmailVerificationAsync(
            string toEmail,
            string name,
            string verificationUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default);
        Task<EmailSendResult> SendBudgetGoalAlertEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount,
            string idempotencyKey,
            CancellationToken cancellationToken = default);
        Task<EmailSendResult> SendMonthlySummaryEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            decimal incomeAmount,
            decimal expenseAmount,
            decimal balanceAmount,
            string? topExpenseCategory,
            decimal? topExpenseAmount,
            IReadOnlyList<MonthlyGoalSummary> goalSummaries,
            string idempotencyKey,
            CancellationToken cancellationToken = default);
    }
}
