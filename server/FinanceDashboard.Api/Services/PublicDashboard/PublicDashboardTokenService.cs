using System.Security.Cryptography;
using System.Text;
using FinanceDashboard.Api.Models;

namespace FinanceDashboard.Api.Services.PublicDashboard
{
    public class PublicDashboardTokenService
    {
        private readonly IConfiguration _configuration;

        public PublicDashboardTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string Generate(User user)
        {
            var payload = $"{user.Id}:{NormalizeEmail(user.Email)}";
            var signature = ComputeSignature(payload);

            return $"{user.Id}.{signature}";
        }

        public bool TryReadUserId(string token, out int userId)
        {
            userId = 0;

            var normalizedToken = token?.Trim();
            if (string.IsNullOrWhiteSpace(normalizedToken))
            {
                return false;
            }

            var parts = normalizedToken.Split('.', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2 || !int.TryParse(parts[0], out userId))
            {
                userId = 0;
                return false;
            }

            return true;
        }

        public bool IsValid(User user, string token)
        {
            if (!TryReadUserId(token, out var userId) || userId != user.Id)
            {
                return false;
            }

            var expectedToken = Generate(user);
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expectedToken),
                Encoding.UTF8.GetBytes(token.Trim()));
        }

        private string ComputeSignature(string payload)
        {
            var key = _configuration["Jwt:Key"]?.Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new InvalidOperationException("Jwt:Key não configurada para gerar o dashboard público.");
            }

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));

            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static string NormalizeEmail(string email)
        {
            return (email ?? string.Empty).Trim().ToLowerInvariant();
        }
    }
}
