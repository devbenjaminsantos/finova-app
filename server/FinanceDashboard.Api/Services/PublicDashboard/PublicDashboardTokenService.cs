using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;

namespace FinanceDashboard.Api.Services.PublicDashboard
{
    public class PublicDashboardTokenService
    {
        private const int TokenByteLength = 32;

        public string GenerateToken()
        {
            return WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(TokenByteLength));
        }

        public bool TryHashToken(string? token, out string tokenHash)
        {
            tokenHash = string.Empty;
            var normalizedToken = token?.Trim();

            if (string.IsNullOrWhiteSpace(normalizedToken))
            {
                return false;
            }

            try
            {
                var tokenBytes = WebEncoders.Base64UrlDecode(normalizedToken);
                if (tokenBytes.Length != TokenByteLength)
                {
                    return false;
                }

                tokenHash = Convert.ToHexString(SHA256.HashData(tokenBytes)).ToLowerInvariant();
                return true;
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
