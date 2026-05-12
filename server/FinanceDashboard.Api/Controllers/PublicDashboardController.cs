using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.PublicDashboard;
using FinanceDashboard.Api.Services.PublicDashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/public-dashboard")]
    [AllowAnonymous]
    public class PublicDashboardController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PublicDashboardTokenService _publicDashboardTokenService;

        public PublicDashboardController(
            AppDbContext context,
            PublicDashboardTokenService publicDashboardTokenService)
        {
            _context = context;
            _publicDashboardTokenService = publicDashboardTokenService;
        }

        [HttpGet("{token}")]
        public async Task<ActionResult<PublicDashboardResponse>> Get(string token)
        {
            if (!_publicDashboardTokenService.TryReadUserId(token, out var userId))
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Painel público não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null ||
                !user.PublicDashboardEnabled ||
                !_publicDashboardTokenService.IsValid(user, token))
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Painel público não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            var transactions = await _context.Transactions
                .AsNoTracking()
                .Where(transaction => transaction.UserId == userId)
                .OrderByDescending(transaction => transaction.Date)
                .Select(transaction => new PublicDashboardTransactionResponse
                {
                    Date = transaction.Date,
                    Category = transaction.Category,
                    AmountCents = transaction.AmountCents,
                    Type = transaction.Type,
                    IsRecurring = transaction.IsRecurring
                })
                .ToListAsync();

            return Ok(new PublicDashboardResponse
            {
                DisplayName = user.Name,
                LastTransactionDate = transactions.FirstOrDefault()?.Date,
                Transactions = transactions
            });
        }
    }
}
