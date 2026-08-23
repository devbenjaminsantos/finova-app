using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FinanceDashboard.Api.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace FinanceDashboard.Api.Services.BankSync.Pluggy
{
    public class PluggyClient : IPluggyClient
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
        private const string ApiKeyCacheKey = "pluggy:api-key";

        private readonly HttpClient _httpClient;
        private readonly PluggyOptions _options;
        private readonly IMemoryCache _cache;

        public PluggyClient(HttpClient httpClient, IOptions<PluggyOptions> options, IMemoryCache cache)
        {
            _httpClient = httpClient;
            _options = options.Value;
            _cache = cache;
        }

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(_options.ClientId) &&
            !string.IsNullOrWhiteSpace(_options.ClientSecret);

        public async Task<string> CreateConnectTokenAsync(
            string clientUserId,
            string? itemId,
            CancellationToken cancellationToken = default)
        {
            EnsureConfigured();

            var payload = new Dictionary<string, object?>
            {
                ["options"] = new
                {
                    clientUserId,
                    avoidDuplicates = true
                }
            };

            if (!string.IsNullOrWhiteSpace(itemId))
            {
                payload["itemId"] = itemId;
            }

            using var request = await CreateAuthorizedRequestAsync(
                HttpMethod.Post,
                "/connect_token",
                payload,
                cancellationToken);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);

            var data = await ReadJsonAsync<PluggyConnectTokenResponse>(response, cancellationToken);

            if (string.IsNullOrWhiteSpace(data.AccessToken))
            {
                throw new InvalidOperationException("Pluggy não retornou um connect token válido.");
            }

            return data.AccessToken;
        }

        public async Task<PluggyItemResponse> GetItemAsync(string itemId, CancellationToken cancellationToken = default)
        {
            using var request = await CreateAuthorizedRequestAsync(
                HttpMethod.Get,
                $"/items/{Uri.EscapeDataString(itemId)}",
                body: null,
                cancellationToken);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
            return await ReadJsonAsync<PluggyItemResponse>(response, cancellationToken);
        }

        public async Task<List<PluggyAccountResponse>> GetAccountsAsync(string itemId, CancellationToken cancellationToken = default)
        {
            var response = await GetPagedAsync<PluggyAccountResponse>(
                $"/accounts?itemId={Uri.EscapeDataString(itemId)}&page=1&pageSize=200",
                cancellationToken);

            return response.Results;
        }

        public async Task<List<PluggyTransactionResponse>> GetTransactionsAsync(
            string accountId,
            DateTime from,
            CancellationToken cancellationToken = default)
        {
            var page = 1;
            var all = new List<PluggyTransactionResponse>();

            while (true)
            {
                var path =
                    $"/transactions?accountId={Uri.EscapeDataString(accountId)}&from={Uri.EscapeDataString(from.ToString("O"))}&page={page}&pageSize=500";

                var response = await GetPagedAsync<PluggyTransactionResponse>(path, cancellationToken);
                all.AddRange(response.Results);

                if (response.TotalPages <= page)
                {
                    break;
                }

                page += 1;
            }

            return all;
        }

        public async Task UpdateItemAsync(string itemId, CancellationToken cancellationToken = default)
        {
            using var request = await CreateAuthorizedRequestAsync(
                HttpMethod.Patch,
                $"/items/{Uri.EscapeDataString(itemId)}",
                new { },
                cancellationToken);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
        }

        private async Task<PluggyPagedResponse<T>> GetPagedAsync<T>(string path, CancellationToken cancellationToken)
        {
            using var request = await CreateAuthorizedRequestAsync(HttpMethod.Get, path, body: null, cancellationToken);
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
            return await ReadJsonAsync<PluggyPagedResponse<T>>(response, cancellationToken);
        }

        private async Task<HttpRequestMessage> CreateAuthorizedRequestAsync(
            HttpMethod method,
            string path,
            object? body,
            CancellationToken cancellationToken)
        {
            var request = new HttpRequestMessage(method, path);
            var apiKey = await GetApiKeyAsync(cancellationToken);

            request.Headers.Add("X-API-KEY", apiKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (body is not null)
            {
                request.Content = new StringContent(
                    JsonSerializer.Serialize(body, JsonOptions),
                    Encoding.UTF8,
                    "application/json");
            }

            return request;
        }

        private async Task<string> GetApiKeyAsync(CancellationToken cancellationToken)
        {
            if (_cache.TryGetValue<string>(ApiKeyCacheKey, out var cachedApiKey) && !string.IsNullOrWhiteSpace(cachedApiKey))
            {
                return cachedApiKey;
            }

            EnsureConfigured();

            using var request = new HttpRequestMessage(HttpMethod.Post, "/auth");
            request.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    clientId = _options.ClientId,
                    clientSecret = _options.ClientSecret
                }, JsonOptions),
                Encoding.UTF8,
                "application/json");

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);

            var data = await ReadJsonAsync<PluggyAuthResponse>(response, cancellationToken);

            if (string.IsNullOrWhiteSpace(data.ApiKey))
            {
                throw new InvalidOperationException("Pluggy não retornou uma API key válida.");
            }

            _cache.Set(ApiKeyCacheKey, data.ApiKey, TimeSpan.FromMinutes(25));
            return data.ApiKey;
        }

        private void EnsureConfigured()
        {
            if (!IsConfigured)
            {
                throw new InvalidOperationException(
                    "Pluggy não configurado. Defina Pluggy:ClientId e Pluggy:ClientSecret.");
            }
        }

        private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
        {
            if (response.IsSuccessStatusCode)
            {
                return;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(body)
                    ? $"Falha ao chamar Pluggy. Status {(int)response.StatusCode}."
                    : $"Falha ao chamar Pluggy. {body}");
        }

        private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var data = await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken);

            if (data is null)
            {
                throw new InvalidOperationException("A resposta do Pluggy veio vazia ou inválida.");
            }

            return data;
        }
    }
}
