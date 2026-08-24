using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services.Recurring
{
    public class RecurringTransactionGenerationService
    {
        private readonly AppDbContext _context;

        public RecurringTransactionGenerationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task EnsureTransactionsGeneratedUpToTodayAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;

            var rules = await _context.RecurringRules
                .Where(rule =>
                    rule.UserId == userId &&
                    rule.IsActive &&
                    rule.NextOccurrenceDate.HasValue &&
                    rule.NextOccurrenceDate.Value.Date <= today)
                .OrderBy(rule => rule.NextOccurrenceDate)
                .ToListAsync();

            if (rules.Count == 0)
            {
                return;
            }

            foreach (var rule in rules)
            {
                await EnsureRuleGeneratedUpToDateAsync(rule, today);
            }

            await _context.SaveChangesAsync();
        }

        private async Task EnsureRuleGeneratedUpToDateAsync(RecurringRule rule, DateTime today)
        {
            var tagNames = ParseTags(rule.TagsCsv);
            var nextDate = rule.NextOccurrenceDate?.Date ?? rule.StartDate.Date;
            var endDate = rule.EndDate.Date;

            while (nextDate <= today && nextDate <= endDate)
            {
                var exists = await _context.Transactions.AnyAsync(transaction =>
                    transaction.UserId == rule.UserId &&
                    transaction.RecurringRuleId == rule.Id &&
                    transaction.Date == nextDate);

                if (!exists)
                {
                    var transaction = new Transaction
                    {
                        Description = rule.Description,
                        Category = rule.Category,
                        AmountCents = rule.AmountCents,
                        Date = nextDate,
                        Type = rule.Type,
                        Source = "manual",
                        IsRecurring = true,
                        RecurrenceEndDate = rule.EndDate.Date,
                        RecurrenceGroupId = rule.PublicId,
                        RecurringRuleId = rule.Id,
                        UserId = rule.UserId
                    };

                    _context.Transactions.Add(transaction);
                    await AttachTagsAsync(transaction, tagNames, rule.UserId);
                }

                rule.LastGeneratedDate = nextDate;
                nextDate = nextDate.AddMonths(1);
            }

            if (nextDate > endDate)
            {
                rule.NextOccurrenceDate = null;
                rule.IsActive = false;
            }
            else
            {
                rule.NextOccurrenceDate = nextDate;
            }
        }

        private async Task AttachTagsAsync(Transaction transaction, IReadOnlyList<string> tagNames, int userId)
        {
            if (tagNames.Count == 0)
            {
                return;
            }

            var normalizedTagKeys = tagNames
                .Select(name => name.ToLowerInvariant())
                .ToList();
            var existingTags = await _context.TransactionTags
                .Where(tag =>
                    tag.UserId == userId &&
                    normalizedTagKeys.Contains(tag.Name.ToLower()))
                .ToListAsync();

            var existingNames = existingTags
                .Select(tag => tag.Name)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var newTags = tagNames
                .Where(name => !existingNames.Contains(name))
                .Select(name => new TransactionTag
                {
                    Name = name,
                    UserId = userId
                })
                .ToList();

            if (newTags.Count > 0)
            {
                _context.TransactionTags.AddRange(newTags);
                existingTags.AddRange(newTags);
            }

            var tagsByName = existingTags.ToDictionary(tag => tag.Name, StringComparer.OrdinalIgnoreCase);

            foreach (var tagName in tagNames)
            {
                if (!tagsByName.TryGetValue(tagName, out var tag))
                {
                    continue;
                }

                transaction.TagLinks.Add(new TransactionTagLink
                {
                    Transaction = transaction,
                    TransactionTag = tag
                });
            }
        }

        public static List<string> ParseTags(string? tagsCsv)
        {
            return (tagsCsv ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(tag => tag)
                .ToList();
        }

        public static string SerializeTags(IEnumerable<string>? rawTagNames)
        {
            return string.Join(",", NormalizeTagNames(rawTagNames));
        }

        public static List<string> NormalizeTagNames(IEnumerable<string>? rawTagNames)
        {
            return (rawTagNames ?? Array.Empty<string>())
                .Select(name => name?.Trim() ?? string.Empty)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Length > 40 ? name[..40] : name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();
        }
    }
}
