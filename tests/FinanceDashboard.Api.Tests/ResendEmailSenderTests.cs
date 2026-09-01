using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.Email;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class ResendEmailSenderTests
{
    [Fact]
    public async Task SendEmailVerificationAsync_SendsRequiredHeadersAndReturnsProviderId()
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent("""{"id":"email_123"}""")
            });
        var sender = CreateSender(handler);

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.True(result.IsAccepted);
        Assert.Equal("email_123", result.ProviderMessageId);
        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal("https://api.resend.com/emails", handler.RequestUri?.ToString());
        Assert.Equal("Bearer", handler.AuthorizationScheme);
        Assert.Equal("re_test_key_not_real", handler.AuthorizationParameter);
        Assert.Equal("email-verification/42", handler.IdempotencyKey);
        Assert.Contains("Hestia/1.0", handler.UserAgent, StringComparison.Ordinal);

        using var payload = JsonDocument.Parse(handler.Body!);
        Assert.Equal("user@example.com", payload.RootElement.GetProperty("to")[0].GetString());
        Assert.Contains("mail@hestia.example", payload.RootElement.GetProperty("from").GetString());
        Assert.Equal("Confirmação de e-mail - Héstia", payload.RootElement.GetProperty("subject").GetString());
        Assert.Contains("token=redacted", payload.RootElement.GetProperty("text").GetString());
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, "rate_limit_exceeded")]
    [InlineData(HttpStatusCode.InternalServerError, "internal_server_error")]
    [InlineData(HttpStatusCode.Conflict, "concurrent_idempotent_requests")]
    public async Task SendEmailVerificationAsync_ReturnsPending_ForRecoverableResponses(
        HttpStatusCode statusCode,
        string errorType)
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(statusCode)
            {
                Content = JsonContent($$"""{"type":"{{errorType}}"}""")
            });
        var sender = CreateSender(handler);

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Pending, result.Status);
        Assert.Equal(errorType, result.FailureCode);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "validation_error")]
    [InlineData(HttpStatusCode.Unauthorized, "missing_api_key")]
    [InlineData(HttpStatusCode.Conflict, "invalid_idempotent_request")]
    public async Task SendEmailVerificationAsync_ReturnsRejected_ForDefinitiveResponses(
        HttpStatusCode statusCode,
        string errorType)
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(statusCode)
            {
                Content = JsonContent($$"""{"type":"{{errorType}}"}""")
            });
        var sender = CreateSender(handler);

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Rejected, result.Status);
        Assert.Equal(errorType, result.FailureCode);
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

    [Fact]
    public async Task SendEmailVerificationAsync_ReturnsPending_WhenRequestTimesOut()
    {
        var sender = CreateSender(new RecordingHandler(new TaskCanceledException("simulated timeout")));

        var result = await sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42");

        Assert.Equal(EmailSendStatus.Pending, result.Status);
        Assert.Equal("timeout", result.FailureCode);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_RejectsOversizedIdempotencyKey()
    {
        var sender = CreateSender(new RecordingHandler(new HttpResponseMessage(HttpStatusCode.OK)));

        var action = () => sender.SendEmailVerificationAsync(
            "user@example.com",
            "Usuário",
            "https://hestia.example/verify-email?token=redacted",
            new string('x', 257));

        await Assert.ThrowsAsync<ArgumentException>(action);
    }

    private static ResendEmailSender CreateSender(HttpMessageHandler handler)
    {
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.resend.com/"),
            Timeout = TimeSpan.FromSeconds(8)
        };
        var options = Options.Create(new ResendOptions
        {
            ApiKey = "re_test_key_not_real",
            FromEmail = "mail@hestia.example",
            FromName = "Héstia",
            TimeoutSeconds = 8
        });
        return new ResendEmailSender(client, options);
    }

    private static StringContent JsonContent(string json) =>
        new(json, Encoding.UTF8, "application/json");

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage? _response;
        private readonly Exception? _exception;

        public RecordingHandler(HttpResponseMessage response)
        {
            _response = response;
        }

        public RecordingHandler(Exception exception)
        {
            _exception = exception;
        }

        public HttpMethod? Method { get; private set; }
        public Uri? RequestUri { get; private set; }
        public string? AuthorizationScheme { get; private set; }
        public string? AuthorizationParameter { get; private set; }
        public string? IdempotencyKey { get; private set; }
        public string UserAgent { get; private set; } = string.Empty;
        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Method = request.Method;
            RequestUri = request.RequestUri;
            AuthorizationScheme = request.Headers.Authorization?.Scheme;
            AuthorizationParameter = request.Headers.Authorization?.Parameter;
            IdempotencyKey = request.Headers.GetValues("Idempotency-Key").Single();
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
