using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.Notifications;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanceDashboard.Api.Services.Email
{
    public sealed class BrevoEmailSender : IEmailSender
    {
        private const int MaximumIdempotencyKeyLength = 256;
        private readonly HttpClient _httpClient;
        private readonly BrevoOptions _options;

        public BrevoEmailSender(HttpClient httpClient, IOptions<BrevoOptions> options)
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
            SendAsync(toEmail, name, EmailContentFactory.PasswordReset(name, resetUrl), idempotencyKey, cancellationToken);

        public Task<EmailSendResult> SendEmailVerificationAsync(
            string toEmail,
            string name,
            string verificationUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            SendAsync(toEmail, name, EmailContentFactory.EmailVerification(name, verificationUrl), idempotencyKey, cancellationToken);

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
                name,
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
                name,
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
            string recipientName,
            EmailContent content,
            string idempotencyKey,
            CancellationToken cancellationToken)
        {
            ValidateIdempotencyKey(idempotencyKey);
            var recipient = new MailAddress(toEmail, recipientName);
            var sender = new MailAddress(_options.FromEmail, _options.FromName);

            using var request = new HttpRequestMessage(HttpMethod.Post, "smtp/email");
            request.Headers.Add("api-key", _options.ApiKey);
            request.Headers.UserAgent.ParseAdd("Hestia/1.0");
            request.Content = JsonContent.Create(new BrevoEmailRequest(
                new BrevoAddress(sender.Address, sender.DisplayName),
                [new BrevoAddress(recipient.Address, recipient.DisplayName)],
                content.Subject,
                content.Text,
                new Dictionary<string, string> { ["Idempotency-Key"] = idempotencyKey }));

            try
            {
                using var response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var providerMessageId = await ReadProviderMessageIdAsync(response, cancellationToken);
                    return string.IsNullOrWhiteSpace(providerMessageId)
                        ? EmailSendResult.Pending("invalid_success_response")
                        : EmailSendResult.Accepted(providerMessageId);
                }

                var failureCode = await ReadFailureCodeAsync(response, cancellationToken);
                return IsPendingResponse(response.StatusCode)
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
                var payload = await response.Content.ReadFromJsonAsync<BrevoEmailResponse>(
                    cancellationToken: cancellationToken);
                return payload?.MessageId;
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
                var payload = await response.Content.ReadFromJsonAsync<BrevoErrorResponse>(
                    cancellationToken: cancellationToken);
                if (!string.IsNullOrWhiteSpace(payload?.Code))
                {
                    return payload.Code;
                }
            }
            catch (JsonException)
            {
                // O status HTTP ainda classifica a falha sem expor o corpo.
            }

            return $"http_{(int)response.StatusCode}";
        }

        private static bool IsPendingResponse(HttpStatusCode statusCode) =>
            statusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests
            || (int)statusCode == 425
            || (int)statusCode >= 500;

        private sealed record BrevoEmailRequest(
            [property: JsonPropertyName("sender")] BrevoAddress Sender,
            [property: JsonPropertyName("to")] BrevoAddress[] To,
            [property: JsonPropertyName("subject")] string Subject,
            [property: JsonPropertyName("textContent")] string TextContent,
            [property: JsonPropertyName("headers")] Dictionary<string, string> Headers);

        private sealed record BrevoAddress(
            [property: JsonPropertyName("email")] string Email,
            [property: JsonPropertyName("name")] string Name);

        private sealed record BrevoEmailResponse(
            [property: JsonPropertyName("messageId")] string? MessageId);

        private sealed record BrevoErrorResponse(
            [property: JsonPropertyName("code")] string? Code);
    }
}
