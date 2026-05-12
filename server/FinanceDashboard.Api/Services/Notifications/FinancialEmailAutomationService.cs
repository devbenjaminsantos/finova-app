using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Email;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services.Notifications
{
    public class FinancialEmailAutomationService
    {
        private readonly AppDbContext _context;
        private readonly IEmailSender _emailSender;
        private readonly ILogger<FinancialEmailAutomationService> _logger;

        public FinancialEmailAutomationService(
            AppDbContext context,
            IEmailSender emailSender,
            ILogger<FinancialEmailAutomationService> logger)
        {
            _context = context;
            _emailSender = emailSender;
            _logger = logger;
        }

        public async Task ProcessAsync(DateTime utcNow, CancellationToken cancellationToken = default)
        {
            await ProcessGoalAlertsAsync(utcNow, cancellationToken);
            await ProcessMonthlyReportsAsync(utcNow, cancellationToken);
        }

        private async Task ProcessGoalAlertsAsync(DateTime utcNow, CancellationToken cancellationToken)
        {
            var month = utcNow.ToString("yyyy-MM");
            var monthStart = new DateTime(utcNow.Year, utcNow.Month, 1);
            var nextMonthStart = monthStart.AddMonths(1);

            var users = await _context.Users
                .Where(user => user.EmailConfirmed && user.EmailGoalAlertsEnabled)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            foreach (var user in users)
            {
                var goals = await _context.BudgetGoals
                    .Where(goal => goal.UserId == user.Id && goal.Month == month && goal.AmountCents > 0)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                if (goals.Count == 0)
                {
                    continue;
                }

                var expenses = await _context.Transactions
                    .Where(transaction =>
                        transaction.UserId == user.Id &&
                        transaction.Type == "expense" &&
                        transaction.Date >= monthStart &&
                        transaction.Date < nextMonthStart)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                foreach (var goal in goals)
                {
                    var spentCents = string.IsNullOrWhiteSpace(goal.Category)
                        ? expenses.Sum(transaction => transaction.AmountCents)
                        : expenses
                            .Where(transaction => transaction.Category == goal.Category)
                            .Sum(transaction => transaction.AmountCents);

                    var thresholdAmount = goal.AmountCents * user.GoalAlertThresholdPercent / 100m;

                    if (spentCents < thresholdAmount)
                    {
                        continue;
                    }

                    var referenceKey = BuildGoalAlertReferenceKey(
                        month,
                        goal.Category,
                        user.GoalAlertThresholdPercent);

                    var alreadySent = await _context.NotificationDeliveries
                        .AnyAsync(delivery =>
                            delivery.UserId == user.Id &&
                            delivery.NotificationType == NotificationTypes.GoalAlert &&
                            delivery.ReferenceKey == referenceKey,
                            cancellationToken);

                    if (alreadySent)
                    {
                        continue;
                    }

                    var progressPercent = (int)Math.Floor(spentCents * 100m / goal.AmountCents);
                    var goalLabel = string.IsNullOrWhiteSpace(goal.Category)
                        ? "orcamento geral"
                        : goal.Category;

                    try
                    {
                        await _emailSender.SendBudgetGoalAlertEmailAsync(
                            user.Email,
                            user.Name,
                            month,
                            goalLabel,
                            progressPercent,
                            ConvertCentsToAmount(spentCents),
                            ConvertCentsToAmount(goal.AmountCents));

                        _context.NotificationDeliveries.Add(new NotificationDelivery
                        {
                            UserId = user.Id,
                            NotificationType = NotificationTypes.GoalAlert,
                            ReferenceKey = referenceKey,
                            Subject = $"Alerta de meta mensal - {goalLabel}",
                            SentAtUtc = utcNow
                        });

                        await _context.SaveChangesAsync(cancellationToken);
                    }
                    catch (Exception exception)
                    {
                        _logger.LogWarning(
                            exception,
                            "Falha ao enviar alerta de meta para o usuário {UserId} no período {Month}.",
                            user.Id,
                            month);
                    }
                }
            }
        }

        private async Task ProcessMonthlyReportsAsync(DateTime utcNow, CancellationToken cancellationToken)
        {
            var reportMonthDate = new DateTime(utcNow.Year, utcNow.Month, 1).AddMonths(-1);
            var reportMonth = reportMonthDate.ToString("yyyy-MM");
            var reportStart = reportMonthDate;
            var reportEnd = reportMonthDate.AddMonths(1);

            var users = await _context.Users
                .Where(user => user.EmailConfirmed && user.MonthlyReportEmailsEnabled)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            foreach (var user in users)
            {
                if (utcNow.Day < user.MonthlyReportDay)
                {
                    continue;
                }

                var referenceKey = $"{reportMonth}|day-{user.MonthlyReportDay}";

                var alreadySent = await _context.NotificationDeliveries
                    .AnyAsync(delivery =>
                        delivery.UserId == user.Id &&
                        delivery.NotificationType == NotificationTypes.MonthlyReport &&
                        delivery.ReferenceKey == referenceKey,
                        cancellationToken);

                if (alreadySent)
                {
                    continue;
                }

                var transactions = await _context.Transactions
                    .Where(transaction =>
                        transaction.UserId == user.Id &&
                        transaction.Date >= reportStart &&
                        transaction.Date < reportEnd)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                if (transactions.Count == 0)
                {
                    continue;
                }

                var goals = await _context.BudgetGoals
                    .Where(goal => goal.UserId == user.Id && goal.Month == reportMonth)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                var incomeCents = transactions
                    .Where(transaction => transaction.Type == "income")
                    .Sum(transaction => transaction.AmountCents);
                var expenseCents = transactions
                    .Where(transaction => transaction.Type == "expense")
                    .Sum(transaction => transaction.AmountCents);
                var topExpenseCategory = transactions
                    .Where(transaction => transaction.Type == "expense")
                    .GroupBy(transaction => string.IsNullOrWhiteSpace(transaction.Category) ? "Sem categoria" : transaction.Category)
                    .Select(group => new
                    {
                        Category = group.Key,
                        TotalCents = group.Sum(transaction => transaction.AmountCents)
                    })
                    .OrderByDescending(group => group.TotalCents)
                    .FirstOrDefault();

                var goalSummaries = goals
                    .Select(goal =>
                    {
                        var spentCents = string.IsNullOrWhiteSpace(goal.Category)
                            ? expenseCents
                            : transactions
                                .Where(transaction =>
                                    transaction.Type == "expense" &&
                                    transaction.Category == goal.Category)
                                .Sum(transaction => transaction.AmountCents);

                        return new MonthlyGoalSummary(
                            string.IsNullOrWhiteSpace(goal.Category) ? "Orcamento geral" : goal.Category,
                            ConvertCentsToAmount(goal.AmountCents),
                            ConvertCentsToAmount(spentCents));
                    })
                    .ToList();

                try
                {
                    await _emailSender.SendMonthlySummaryEmailAsync(
                        user.Email,
                        user.Name,
                        reportMonth,
                        ConvertCentsToAmount(incomeCents),
                        ConvertCentsToAmount(expenseCents),
                        ConvertCentsToAmount(incomeCents - expenseCents),
                        topExpenseCategory?.Category,
                        topExpenseCategory is null ? null : ConvertCentsToAmount(topExpenseCategory.TotalCents),
                        goalSummaries);

                    _context.NotificationDeliveries.Add(new NotificationDelivery
                    {
                        UserId = user.Id,
                        NotificationType = NotificationTypes.MonthlyReport,
                        ReferenceKey = referenceKey,
                        Subject = $"Resumo mensal - {reportMonth}",
                        SentAtUtc = utcNow
                    });

                    await _context.SaveChangesAsync(cancellationToken);
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
                        exception,
                        "Falha ao enviar relatório mensal para o usuário {UserId} no período {Month}.",
                        user.Id,
                        reportMonth);
                }
            }
        }

        private static string BuildGoalAlertReferenceKey(string month, string category, int thresholdPercent)
        {
            var normalizedCategory = string.IsNullOrWhiteSpace(category) ? "__all__" : category.Trim().ToLowerInvariant();
            return $"{month}|{normalizedCategory}|{thresholdPercent}";
        }

        private static decimal ConvertCentsToAmount(long amountCents)
        {
            return amountCents / 100m;
        }

        private static class NotificationTypes
        {
            public const string GoalAlert = "goal_alert";
            public const string MonthlyReport = "monthly_report";
        }
    }

    public record MonthlyGoalSummary(string GoalLabel, decimal TargetAmount, decimal SpentAmount);
}
