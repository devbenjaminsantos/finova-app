using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FinanceDashboard.Api.Services.Auth
{
    public sealed class CookieAntiforgeryFilter : IAsyncAuthorizationFilter
    {
        private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
        {
            HttpMethods.Get,
            HttpMethods.Head,
            HttpMethods.Options,
            HttpMethods.Trace
        };

        private readonly IAntiforgery _antiforgery;

        public CookieAntiforgeryFilter(IAntiforgery antiforgery)
        {
            _antiforgery = antiforgery;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var request = context.HttpContext.Request;

            if (SafeMethods.Contains(request.Method) || IsAuthenticatedBearerRequest(context.HttpContext))
            {
                return;
            }

            try
            {
                await _antiforgery.ValidateRequestAsync(context.HttpContext);
            }
            catch (AntiforgeryValidationException)
            {
                context.Result = new BadRequestObjectResult(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Token antiforgery ausente ou inválido.",
                    Extensions = { ["code"] = "INVALID_CSRF_TOKEN" }
                });
            }
        }

        private static bool IsAuthenticatedBearerRequest(HttpContext context)
        {
            var authorization = context.Request.Headers.Authorization.ToString();

            return context.User.Identity?.IsAuthenticated == true &&
                authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);
        }
    }
}
