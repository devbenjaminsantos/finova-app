using System.Text.RegularExpressions;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.BudgetGoals;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BudgetGoalsController : ControllerBase
    {
        private static readonly Regex MonthRegex = new(@"^\d{4}-(0[1-9]|1[0-2])$", RegexOptions.Compiled);

        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly CurrentUserService _currentUserService;

        public BudgetGoalsController(
            AppDbContext context,
            CurrentUserService currentUserService,
            AuditLogService auditLogService)
        {
            _context = context;
            _currentUserService = currentUserService;
            _auditLogService = auditLogService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<BudgetGoalResponse>>> GetAll([FromQuery] string? month = null)
        {
            var userId = _currentUserService.GetRequiredUserId();
            var normalizedMonth = NormalizeMonthOrThrow(month);

            var goals = await _context.BudgetGoals
                .Where(goal => goal.UserId == userId && goal.Month == normalizedMonth)
                .OrderBy(goal => string.IsNullOrEmpty(goal.Category) ? 0 : 1)
                .ThenBy(goal => goal.Category)
                .Select(goal => ToResponse(goal))
                .ToListAsync();

            return Ok(goals);
        }

        [HttpPost]
        public async Task<ActionResult<BudgetGoalResponse>> Create(BudgetGoalCreateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();
            var month = NormalizeMonthOrThrow(dto.Month);
            var category = NormalizeCategory(dto.Category);
            var categoryKey = category.ToLowerInvariant();

            var alreadyExists = await _context.BudgetGoals.AnyAsync(goal =>
                goal.UserId == userId &&
                goal.Month == month &&
                goal.Category.ToLower() == categoryKey);

            if (alreadyExists)
            {
                return Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Já existe uma meta para esta categoria neste mês."
                });
            }

            var goal = new BudgetGoal
            {
                Month = month,
                Category = category,
                AmountCents = dto.AmountCents,
                UserId = userId
            };

            _context.BudgetGoals.Add(goal);
            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "budget-goal.created",
                entityType: "BudgetGoal",
                entityId: goal.Id.ToString(),
                userId: userId,
                summary: $"Meta criada para {goal.Month} ({DescribeGoalScope(goal.Category)}).");

            return CreatedAtAction(nameof(GetAll), new { month = goal.Month }, ToResponse(goal));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<BudgetGoalResponse>> Update(int id, BudgetGoalUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();
            var month = NormalizeMonthOrThrow(dto.Month);
            var category = NormalizeCategory(dto.Category);
            var categoryKey = category.ToLowerInvariant();

            var goal = await _context.BudgetGoals
                .FirstOrDefaultAsync(existing => existing.Id == id && existing.UserId == userId);

            if (goal is null)
            {
                return NotFound();
            }

            var alreadyExists = await _context.BudgetGoals.AnyAsync(existing =>
                existing.Id != id &&
                existing.UserId == userId &&
                existing.Month == month &&
                existing.Category.ToLower() == categoryKey);

            if (alreadyExists)
            {
                return Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Já existe uma meta para esta categoria neste mês."
                });
            }

            goal.Month = month;
            goal.Category = category;
            goal.AmountCents = dto.AmountCents;

            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "budget-goal.updated",
                entityType: "BudgetGoal",
                entityId: goal.Id.ToString(),
                userId: userId,
                summary: $"Meta atualizada para {goal.Month} ({DescribeGoalScope(goal.Category)}).");

            return Ok(ToResponse(goal));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var goal = await _context.BudgetGoals
                .FirstOrDefaultAsync(existing => existing.Id == id && existing.UserId == userId);

            if (goal is null)
            {
                return NotFound();
            }

            _context.BudgetGoals.Remove(goal);
            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "budget-goal.deleted",
                entityType: "BudgetGoal",
                entityId: id.ToString(),
                userId: userId,
                summary: $"Meta removida de {goal.Month} ({DescribeGoalScope(goal.Category)}).");

            return NoContent();
        }

        private static BudgetGoalResponse ToResponse(BudgetGoal goal)
        {
            return new BudgetGoalResponse
            {
                Id = goal.Id,
                Month = goal.Month,
                Category = goal.Category,
                AmountCents = goal.AmountCents
            };
        }

        private static string NormalizeMonthOrThrow(string? value)
        {
            var normalized = string.IsNullOrWhiteSpace(value)
                ? DateTime.UtcNow.ToString("yyyy-MM")
                : value.Trim();

            if (!MonthRegex.IsMatch(normalized))
            {
                throw new BadHttpRequestException("Informe um mês válido no formato yyyy-MM.");
            }

            return normalized;
        }

        private static string NormalizeCategory(string? category)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                return string.Empty;
            }

            return category.Trim();
        }

        private static string DescribeGoalScope(string category)
        {
            return string.IsNullOrWhiteSpace(category) ? "orçamento geral" : category;
        }
    }
}
