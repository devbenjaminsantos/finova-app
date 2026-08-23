using System.Security.Claims;
using FinanceDashboard.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services.Auth
{
    public sealed class SessionValidationService
    {
        private readonly AppDbContext _context;

        public SessionValidationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> IsCurrentAsync(
            ClaimsPrincipal principal,
            CancellationToken cancellationToken = default)
        {
            var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            var sessionVersionValue = principal.FindFirstValue(JwTokenService.SessionVersionClaimType);

            if (!int.TryParse(userIdValue, out var userId) ||
                !int.TryParse(sessionVersionValue, out var sessionVersion))
            {
                return false;
            }

            var now = DateTime.UtcNow;

            return await _context.Users
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.Id == userId &&
                        user.SessionVersion == sessionVersion &&
                        (!user.IsDemoAccount ||
                            (user.DemoExpiresAtUtc.HasValue && user.DemoExpiresAtUtc > now)),
                    cancellationToken);
        }
    }
}
