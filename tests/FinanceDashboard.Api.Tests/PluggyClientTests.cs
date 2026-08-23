using System.Net;
using System.Text;
using System.Text.Json;
using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.BankSync.Pluggy;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class PluggyClientTests
{
    [Fact]
    public async Task CreateConnectToken_NestsClientOptionsAndKeepsItemIdAtRoot()
    {
        using var handler = new RecordingPluggyHandler();
        using var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.pluggy.test")
        };
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var client = new PluggyClient(
            httpClient,
            Options.Create(new PluggyOptions
            {
                ClientId = "client-id",
                ClientSecret = "client-secret"
            }),
            cache);

        var token = await client.CreateConnectTokenAsync("user:8", "item-123");

        Assert.Equal("connect-token", token);
        Assert.NotNull(handler.ConnectTokenBody);

        using var payload = JsonDocument.Parse(handler.ConnectTokenBody!);
        var root = payload.RootElement;
        var options = root.GetProperty("options");

        Assert.Equal("item-123", root.GetProperty("itemId").GetString());
        Assert.False(root.TryGetProperty("clientUserId", out _));
        Assert.Equal("user:8", options.GetProperty("clientUserId").GetString());
        Assert.True(options.GetProperty("avoidDuplicates").GetBoolean());
    }

    private sealed class RecordingPluggyHandler : HttpMessageHandler
    {
        public string? ConnectTokenBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            if (request.RequestUri?.AbsolutePath == "/auth")
            {
                return JsonResponse("{\"apiKey\":\"api-key\"}");
            }

            if (request.RequestUri?.AbsolutePath == "/connect_token")
            {
                ConnectTokenBody = await request.Content!.ReadAsStringAsync(cancellationToken);
                return JsonResponse("{\"accessToken\":\"connect-token\"}");
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        private static HttpResponseMessage JsonResponse(string body)
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        }
    }
}
