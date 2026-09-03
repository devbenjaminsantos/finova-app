using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.Email;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class BrevoEmailSenderTests
{
    [Fact]
    public async Task SendEmailVerificationAsync_SendsBrevoContractAndReturnsProviderId()
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = JsonContent("""{"messageId":"<message@relay.brevo.com>"}""")
            });
        var sender = CreateSender(handler);

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.True(result.IsAccepted);
        Assert.Equal("<message@relay.brevo.com>", result.ProviderMessageId);
        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal("https://api.brevo.com/v3/smtp/email", handler.RequestUri?.ToString());
        Assert.Equal("xkeysib-test-key-not-real", handler.ApiKey);
        Assert.Contains("Hestia/1.0", handler.UserAgent, StringComparison.Ordinal);

        using var payload = JsonDocument.Parse(handler.Body!);
        Assert.Equal("sender@example.com", payload.RootElement.GetProperty("sender").GetProperty("email").GetString());
        Assert.Equal("user@example.com", payload.RootElement.GetProperty("to")[0].GetProperty("email").GetString());
        Assert.Equal("Confirmação de e-mail - Héstia", payload.RootElement.GetProperty("subject").GetString());
        Assert.Contains("token=redacted", payload.RootElement.GetProperty("textContent").GetString());
        Assert.Equal(
            "email-verification/42",
            payload.RootElement.GetProperty("headers").GetProperty("Idempotency-Key").GetString());
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, "too_many_requests")]
    [InlineData(HttpStatusCode.InternalServerError, "internal_error")]
    public async Task SendEmailVerificationAsync_ReturnsPending_ForRecoverableResponses(
        HttpStatusCode statusCode,
        string errorCode)
    {
        var sender = CreateSender(new RecordingHandler(
            new HttpResponseMessage(statusCode)
            {
                Content = JsonContent($$"""{"code":"{{errorCode}}"}""")
            }));

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Pending, result.Status);
        Assert.Equal(errorCode, result.FailureCode);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "invalid_parameter")]
    [InlineData(HttpStatusCode.Unauthorized, "unauthorized")]
    [InlineData(HttpStatusCode.Forbidden, "permission_denied")]
    public async Task SendEmailVerificationAsync_ReturnsRejected_ForDefinitiveResponses(
        HttpStatusCode statusCode,
        string errorCode)
    {
        var sender = CreateSender(new RecordingHandler(
            new HttpResponseMessage(statusCode)
            {
                Content = JsonContent($$"""{"code":"{{errorCode}}"}""")
            }));

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Rejected, result.Status);
        Assert.Equal(errorCode, result.FailureCode);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_ReturnsPending_WhenNetworkFails()
    {
        var sender = CreateSender(new RecordingHandler(new HttpRequestException("simulated")));

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Pending, result.Status);
        Assert.Equal("network_error", result.FailureCode);
    }

    private static BrevoEmailSender CreateSender(HttpMessageHandler handler)
    {
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.brevo.com/v3/"),
            Timeout = TimeSpan.FromSeconds(8)
        };
        var options = Options.Create(new BrevoOptions
        {
            ApiKey = "xkeysib-test-key-not-real",
            FromEmail = "sender@example.com",
            FromName = "Héstia",
            TimeoutSeconds = 8
        });
        return new BrevoEmailSender(client, options);
    }

    private static StringContent JsonContent(string json) =>
        new(json, Encoding.UTF8, "application/json");

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage? _response;
        private readonly Exception? _exception;

        public RecordingHandler(HttpResponseMessage response) => _response = response;
        public RecordingHandler(Exception exception) => _exception = exception;

        public HttpMethod? Method { get; private set; }
        public Uri? RequestUri { get; private set; }
        public string? ApiKey { get; private set; }
        public string UserAgent { get; private set; } = string.Empty;
        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Method = request.Method;
            RequestUri = request.RequestUri;
            ApiKey = request.Headers.GetValues("api-key").Single();
            UserAgent = request.Headers.UserAgent.ToString();
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);

            if (_exception is not null)
            {
                throw _exception;
            }

            return _response!;
        }
    }
}
