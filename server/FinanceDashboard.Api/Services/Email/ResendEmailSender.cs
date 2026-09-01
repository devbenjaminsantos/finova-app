using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.Notifications;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanceDashboard.Api.Services.Email
{
    public sealed class ResendEmailSender : IEmailSender
    {
        private const int MaximumIdempotencyKeyLength = 256;
        private readonly HttpClient _httpClient;
        private readonly ResendOptions _options;

        public ResendEmailSender(HttpClient httpClient, IOptions<ResendOptions> options)
        {
            _httpClient = httpClient;
            _options = options.Value;
        }

        public Task<EmailSendResult> SendPasswordResetEmailAsync(
            string toEmail,
            string name,
            string resetUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            SendAsync(
                toEmail,
                EmailContentFactory.PasswordReset(name, resetUrl),
                idempotencyKey,
                cancellationToken);

        public Task<EmailSendResult> SendEmailVerificationAsync(
            string toEmail,
            string name,
            string verificationUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            SendAsync(
                toEmail,
                EmailContentFactory.EmailVerification(name, verificationUrl),
                idempotencyKey,
                cancellationToken);

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
            SendAsync(
                toEmail,
                EmailContentFactory.BudgetGoalAlert(
                    name,
                    monthLabel,
                    goalLabel,
                    progressPercent,
                    spentAmount,
                    targetAmount),
                idempotencyKey,
                cancellationToken);

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
            SendAsync(
                toEmail,
                EmailContentFactory.MonthlySummary(
                    name,
                    monthLabel,
                    incomeAmount,
                    expenseAmount,
                    balanceAmount,
                    topExpenseCategory,
                    topExpenseAmount,
                    goalSummaries),
                idempotencyKey,
                cancellationToken);

        private async Task<EmailSendResult> SendAsync(
            string toEmail,
            EmailContent content,
            string idempotencyKey,
            CancellationToken cancellationToken)
        {
            ValidateIdempotencyKey(idempotencyKey);
            var recipient = new MailAddress(toEmail).Address;
            var sender = new MailAddress(_options.FromEmail, _options.FromName).ToString();

            using var request = new HttpRequestMessage(HttpMethod.Post, "emails");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            request.Headers.UserAgent.ParseAdd("Hestia/1.0");
            request.Headers.Add("Idempotency-Key", idempotencyKey);
            request.Content = JsonContent.Create(new ResendEmailRequest(
                sender,
                [recipient],
                content.Subject,
                content.Text));

            try
            {
                using var response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var providerMessageId = await ReadProviderMessageIdAsync(
                        response,
                        cancellationToken);
                    return string.IsNullOrWhiteSpace(providerMessageId)
                        ? EmailSendResult.Pending("invalid_success_response")
                        : EmailSendResult.Accepted(providerMessageId);
                }

                var failureCode = await ReadFailureCodeAsync(response, cancellationToken);
                return IsPendingResponse(response.StatusCode, failureCode)
                    ? EmailSendResult.Pending(failureCode)
                    : EmailSendResult.Rejected(failureCode);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return EmailSendResult.Pending("timeout");
            }
            catch (HttpRequestException)
            {
                return EmailSendResult.Pending("network_error");
            }
        }

        private static void ValidateIdempotencyKey(string idempotencyKey)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey)
                || idempotencyKey.Length > MaximumIdempotencyKeyLength)
            {
                throw new ArgumentException(
                    $"A chave idempotente deve conter entre 1 e {MaximumIdempotencyKeyLength} caracteres.",
                    nameof(idempotencyKey));
            }
        }

        private static async Task<string?> ReadProviderMessageIdAsync(
            HttpResponseMessage response,
            CancellationToken cancellationToken)
        {
            try
            {
                var payload = await response.Content.ReadFromJsonAsync<ResendEmailResponse>(
                    cancellationToken: cancellationToken);
                return payload?.Id;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static async Task<string> ReadFailureCodeAsync(
            HttpResponseMessage response,
            CancellationToken cancellationToken)
        {
            try
            {
                var payload = await response.Content.ReadFromJsonAsync<ResendErrorResponse>(
                    cancellationToken: cancellationToken);
                var code = payload?.Type ?? payload?.Name;
                if (!string.IsNullOrWhiteSpace(code))
                {
                    return code;
                }
            }
            catch (JsonException)
            {
                // O status HTTP ainda permite classificar a falha sem expor o corpo.
            }

            return $"http_{(int)response.StatusCode}";
        }

        private static bool IsPendingResponse(HttpStatusCode statusCode, string failureCode)
        {
            return statusCode is HttpStatusCode.RequestTimeout
                or HttpStatusCode.TooManyRequests
                || (int)statusCode == 425
                || (int)statusCode >= 500
                || statusCode == HttpStatusCode.Conflict
                && string.Equals(
                    failureCode,
                    "concurrent_idempotent_requests",
                    StringComparison.Ordinal);
        }

        private sealed record ResendEmailRequest(
            [property: JsonPropertyName("from")] string From,
            [property: JsonPropertyName("to")] string[] To,
            [property: JsonPropertyName("subject")] string Subject,
            [property: JsonPropertyName("text")] string Text);

        private sealed record ResendEmailResponse(
            [property: JsonPropertyName("id")] string? Id);

        private sealed record ResendErrorResponse(
            [property: JsonPropertyName("type")] string? Type,
            [property: JsonPropertyName("name")] string? Name);
    }
}
