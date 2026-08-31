namespace FinanceDashboard.Api.Services.Auth
{
    public sealed class AuthCookieService
    {
        public const string CookieName = "hestia_auth";
        public const string LegacyCookieName = "finova_auth";

        private static readonly TimeSpan Lifetime = TimeSpan.FromHours(2);
        private readonly IWebHostEnvironment _environment;

        public AuthCookieService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public void Write(HttpResponse response, string token)
        {
            response.Cookies.Append(CookieName, token, BuildOptions(DateTimeOffset.UtcNow.Add(Lifetime)));
        }

        public void Delete(HttpResponse response)
        {
            response.Cookies.Delete(CookieName, BuildOptions(expires: null));
            response.Cookies.Delete(LegacyCookieName, BuildOptions(expires: null));
        }

        public static bool TryRead(IRequestCookieCollection cookies, out string token)
        {
            if (cookies.TryGetValue(CookieName, out var currentToken) ||
                cookies.TryGetValue(LegacyCookieName, out currentToken))
            {
                token = currentToken;
                return true;
            }

            token = string.Empty;
            return false;
        }

        private CookieOptions BuildOptions(DateTimeOffset? expires)
        {
            var isDevelopment = _environment.IsDevelopment();

            return new CookieOptions
            {
                HttpOnly = true,
                Secure = !isDevelopment,
                SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
                IsEssential = true,
                Path = "/",
                Expires = expires
            };
        }
    }
}
