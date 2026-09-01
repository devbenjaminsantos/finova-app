using FinanceDashboard.Api.Services.Notifications;

namespace FinanceDashboard.Api.Services.Email
{
    public sealed class DisabledEmailSender : IEmailSender
    {
        public Task<EmailSendResult> SendPasswordResetEmailAsync(
            string toEmail,
            string name,
            string resetUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            DisabledAsync(cancellationToken);

        public Task<EmailSendResult> SendEmailVerificationAsync(
            string toEmail,
            string name,
            string verificationUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            DisabledAsync(cancellationToken);

        public Task<EmailSendResult> SendBudgetGoalAlertEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            DisabledAsync(cancellationToken);

        public Task<EmailSendResult> SendMonthlySummaryEmailAsync(
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
            CancellationToken cancellationToken = default) =>
            DisabledAsync(cancellationToken);

        private static Task<EmailSendResult> DisabledAsync(CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(EmailSendResult.Disabled());
        }
    }
}
