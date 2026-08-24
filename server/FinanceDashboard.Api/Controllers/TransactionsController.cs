using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.CurrentUser;
using FinanceDashboard.Api.Services.Recurring;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly CurrentUserService _currentUserService;
        private readonly RecurringTransactionGenerationService _recurringTransactionGenerationService;

        public TransactionsController(
            AppDbContext context,
            CurrentUserService currentUserService,
            AuditLogService auditLogService,
            RecurringTransactionGenerationService recurringTransactionGenerationService)
        {
            _context = context;
            _currentUserService = currentUserService;
            _auditLogService = auditLogService;
            _recurringTransactionGenerationService = recurringTransactionGenerationService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<TransactionResponse>>> GetAll()
        {
            var userId = _currentUserService.GetRequiredUserId();
            await _recurringTransactionGenerationService.EnsureTransactionsGeneratedUpToTodayAsync(userId);

            var transactions = await _context.Transactions
                .Include(transaction => transaction.TagLinks)
                .ThenInclude(link => link.TransactionTag)
                .Where(transaction => transaction.UserId == userId)
                .OrderByDescending(transaction => transaction.Date)
                .ToListAsync();

            return Ok(transactions.Select(ToResponse).ToList());
        }

        [HttpGet("installment-plans")]
        public async Task<ActionResult<IReadOnlyList<InstallmentPlanResponse>>> GetInstallmentPlans()
        {
            var userId = _currentUserService.GetRequiredUserId();
            var today = DateTime.UtcNow.Date;
            await _recurringTransactionGenerationService.EnsureTransactionsGeneratedUpToTodayAsync(userId);

            var plans = await _context.InstallmentPlans
                .Include(plan => plan.Transactions)
                .ThenInclude(transaction => transaction.TagLinks)
                .ThenInclude(link => link.TransactionTag)
                .Where(plan => plan.UserId == userId)
                .OrderByDescending(plan => plan.StartDate)
                .ToListAsync();

            return Ok(plans.Select(plan => ToInstallmentPlanResponse(plan, today)).ToList());
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<TransactionResponse>> GetById(int id)
        {
            var userId = _currentUserService.GetRequiredUserId();
            await _recurringTransactionGenerationService.EnsureTransactionsGeneratedUpToTodayAsync(userId);

            var transaction = await _context.Transactions
                .Include(existing => existing.TagLinks)
                .ThenInclude(link => link.TransactionTag)
                .FirstOrDefaultAsync(transaction => transaction.Id == id && transaction.UserId == userId);

            if (transaction is null)
            {
                return NotFound();
            }

            return Ok(ToResponse(transaction));
        }

        [HttpGet("recurring-rules")]
        public async Task<ActionResult<IReadOnlyList<RecurringRuleResponse>>> GetRecurringRules()
        {
            var userId = _currentUserService.GetRequiredUserId();
            await _recurringTransactionGenerationService.EnsureTransactionsGeneratedUpToTodayAsync(userId);

            var rules = await _context.RecurringRules
                .Where(rule => rule.UserId == userId)
                .OrderByDescending(rule => rule.IsActive)
                .ThenBy(rule => rule.NextOccurrenceDate)
                .ThenBy(rule => rule.Description)
                .ToListAsync();

            return Ok(rules.Select(ToRecurringRuleResponse).ToList());
        }

        [HttpPost]
        public async Task<ActionResult<TransactionResponse>> Create(TransactionCreateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            if (!TryBuildCreationPlan(dto, out var creationPlan, out var validationError))
            {
                ModelState.AddModelError(nameof(dto.InstallmentCount), validationError);
                return ValidationProblem(ModelState);
            }

            InstallmentPlan? installmentPlan = null;
            RecurringRule? recurringRule = null;

            if (!await FinancialAccountsBelongToUserAsync(
                    new[] { dto.FinancialAccountId },
                    userId))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Conta financeira inválida para este usuário.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            if (creationPlan[0].InstallmentGroupId is not null)
            {
                installmentPlan = new InstallmentPlan
                {
                    PublicId = creationPlan[0].InstallmentGroupId!,
                    Description = dto.Description.Trim(),
                    Category = dto.Category.Trim(),
                    AmountPerInstallmentCents = dto.AmountCents,
                    InstallmentCount = dto.InstallmentCount,
                    StartDate = dto.Date.Date,
                    CreatedAtUtc = DateTime.UtcNow,
                    UserId = userId
                };

                _context.InstallmentPlans.Add(installmentPlan);
            }

            if (dto.IsRecurring)
            {
                recurringRule = new RecurringRule
                {
                    PublicId = creationPlan[0].RecurrenceGroupId!,
                    Description = dto.Description.Trim(),
                    Category = dto.Category.Trim(),
                    AmountCents = dto.AmountCents,
                    Type = dto.Type.Trim().ToLowerInvariant(),
                    StartDate = dto.Date.Date,
                    EndDate = dto.RecurrenceEndDate!.Value.Date,
                    LastGeneratedDate = dto.Date.Date,
                    NextOccurrenceDate = dto.Date.Date.AddMonths(1) <= dto.RecurrenceEndDate.Value.Date
                        ? dto.Date.Date.AddMonths(1)
                        : null,
                    IsActive = dto.Date.Date.AddMonths(1) <= dto.RecurrenceEndDate.Value.Date,
                    TagsCsv = RecurringTransactionGenerationService.SerializeTags(dto.TagNames),
                    CreatedAtUtc = DateTime.UtcNow,
                    UserId = userId
                };

                _context.RecurringRules.Add(recurringRule);
            }

            var transactions = creationPlan
                .Select(item => BuildTransactionEntity(
                    dto,
                    userId,
                    item.Date,
                    item.RecurrenceGroupId,
                    recurringRule,
                    item.InstallmentIndex,
                    item.InstallmentCount,
                    item.InstallmentGroupId,
                    installmentPlan,
                    source: "manual",
                    importedAtUtc: null))
                .ToList();

            _context.Transactions.AddRange(transactions);
            await AttachTagsAsync(transactions, dto.TagNames, userId);
            await _context.SaveChangesAsync();

            var firstTransaction = transactions[0];
            var summary = dto.InstallmentCount > 1
                ? $"Compra parcelada criada: {firstTransaction.Description} ({dto.InstallmentCount} parcelas mensais)."
                : dto.IsRecurring
                ? $"Regra recorrente criada: {firstTransaction.Description} (próxima geração mensal automática)."
                : $"Transação criada: {firstTransaction.Description} ({firstTransaction.Type}).";

            await _auditLogService.WriteAsync(
                action: "transaction.created",
                entityType: "Transaction",
                entityId: firstTransaction.Id.ToString(),
                userId: userId,
                summary: summary);

            return CreatedAtAction(
                nameof(GetById),
                new { id = firstTransaction.Id },
                ToResponse(firstTransaction));
        }

        [HttpPost("import")]
        public async Task<ActionResult<TransactionImportResponse>> Import(TransactionImportRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            if (dto.Transactions.Count > 500)
            {
                ModelState.AddModelError(nameof(dto.Transactions), "Limite de 500 transações por importação.");
                return ValidationProblem(ModelState);
            }

            var source = dto.ImportFormat?.Trim().ToLowerInvariant() switch
            {
                "ofx" => "import_ofx",
                _ => "import_csv"
            };

            if (!await FinancialAccountsBelongToUserAsync(
                    dto.Transactions.Select(item => item.FinancialAccountId),
                    userId))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Conta financeira inválida para este usuário.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            var importedAtUtc = DateTime.UtcNow;
            var transactions = new List<Transaction>();

            for (var index = 0; index < dto.Transactions.Count; index += 1)
            {
                var item = dto.Transactions[index];

                if (item.IsRecurring)
                {
                    ModelState.AddModelError(
                        $"{nameof(dto.Transactions)}[{index}].{nameof(item.IsRecurring)}",
                        "A importação inicial de arquivo não aceita recorrência automática.");
                    return ValidationProblem(ModelState);
                }

                transactions.Add(BuildTransactionEntity(
                    item,
                    userId,
                    item.Date.Date,
                    recurrenceGroupId: null,
                    recurringRule: null,
                    installmentIndex: null,
                    installmentCount: null,
                    installmentGroupId: null,
                    installmentPlan: null,
                    source: source,
                    importedAtUtc: importedAtUtc));
            }

            _context.Transactions.AddRange(transactions);
            for (var index = 0; index < transactions.Count; index += 1)
            {
                await AttachTagsAsync(new[] { transactions[index] }, dto.Transactions[index].TagNames, userId);
            }
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "transaction.imported",
                entityType: "Transaction",
                entityId: transactions[0].Id.ToString(),
                userId: userId,
                summary: $"Importação {dto.ImportFormat?.ToUpperInvariant() ?? "CSV"} concluída com {transactions.Count} transações.");

            return Ok(new TransactionImportResponse
            {
                ImportedCount = transactions.Count
            });
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<TransactionResponse>> Update(int id, TransactionUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var transaction = await _context.Transactions
                .FirstOrDefaultAsync(existing => existing.Id == id && existing.UserId == userId);

            if (transaction is null)
            {
                return NotFound();
            }

            if (!await FinancialAccountsBelongToUserAsync(
                    new[] { dto.FinancialAccountId },
                    userId))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Conta financeira inválida para este usuário.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            transaction.Description = dto.Description.Trim();
            transaction.Category = dto.Category.Trim();
            transaction.AmountCents = dto.AmountCents;
            transaction.Date = dto.Date.Date;
            transaction.Type = dto.Type.Trim().ToLowerInvariant();
            transaction.FinancialAccountId = dto.FinancialAccountId;
            await ReplaceTagsAsync(transaction, dto.TagNames, userId);

            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "transaction.updated",
                entityType: "Transaction",
                entityId: transaction.Id.ToString(),
                userId: userId,
                summary: $"Transação atualizada: {transaction.Description} ({transaction.Type}).");

            return Ok(ToResponse(transaction));
        }

        private async Task<bool> FinancialAccountsBelongToUserAsync(
            IEnumerable<int?> financialAccountIds,
            int userId)
        {
            var requestedIds = financialAccountIds
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            if (requestedIds.Count == 0)
            {
                return true;
            }

            var ownedCount = await _context.FinancialAccounts.CountAsync(account =>
                account.UserId == userId && requestedIds.Contains(account.Id));

            return ownedCount == requestedIds.Count;
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var transaction = await _context.Transactions
                .FirstOrDefaultAsync(existing => existing.Id == id && existing.UserId == userId);

            if (transaction is null)
            {
                return NotFound();
            }

            _context.Transactions.Remove(transaction);
            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "transaction.deleted",
                entityType: "Transaction",
                entityId: id.ToString(),
                userId: userId,
                summary: $"Transação removida: {transaction.Description} ({transaction.Type}).");

            return NoContent();
        }

        [HttpDelete("installment-groups/{installmentGroupId}")]
        public async Task<IActionResult> DeleteInstallmentGroup(string installmentGroupId)
        {
            var userId = _currentUserService.GetRequiredUserId();
            var normalizedGroupId = installmentGroupId?.Trim();

            if (string.IsNullOrWhiteSpace(normalizedGroupId))
            {
                return BadRequest();
            }

            var installmentPlan = await _context.InstallmentPlans
                .FirstOrDefaultAsync(existing =>
                    existing.UserId == userId &&
                    existing.PublicId == normalizedGroupId);

            if (installmentPlan is null)
            {
                return NotFound();
            }

            var transactions = await _context.Transactions
                .Where(existing =>
                    existing.UserId == userId &&
                    existing.InstallmentPlanId == installmentPlan.Id)
                .ToListAsync();

            if (transactions.Count == 0)
            {
                return NotFound();
            }

            var firstTransaction = transactions
                .OrderBy(existing => existing.InstallmentIndex ?? int.MaxValue)
                .First();

            _context.Transactions.RemoveRange(transactions);
            _context.InstallmentPlans.Remove(installmentPlan);
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "transaction.installment-group.deleted",
                entityType: "Transaction",
                entityId: normalizedGroupId,
                userId: userId,
                summary: $"Compra parcelada removida: {firstTransaction.Description} ({transactions.Count} parcelas).");

            return NoContent();
        }

        [HttpPut("installment-groups/{installmentGroupId}")]
        public async Task<IActionResult> UpdateInstallmentGroup(
            string installmentGroupId,
            InstallmentGroupUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();
            var normalizedGroupId = installmentGroupId?.Trim();

            if (string.IsNullOrWhiteSpace(normalizedGroupId))
            {
                return BadRequest();
            }

            var installmentPlan = await _context.InstallmentPlans
                .FirstOrDefaultAsync(existing =>
                    existing.UserId == userId &&
                    existing.PublicId == normalizedGroupId);

            if (installmentPlan is null)
            {
                return NotFound();
            }

            var transactions = await _context.Transactions
                .Where(existing =>
                    existing.UserId == userId &&
                    existing.InstallmentPlanId == installmentPlan.Id)
                .ToListAsync();

            if (transactions.Count == 0)
            {
                return NotFound();
            }

            installmentPlan.Description = dto.Description.Trim();
            installmentPlan.Category = dto.Category.Trim();

            foreach (var transaction in transactions)
            {
                transaction.Description = dto.Description.Trim();
                transaction.Category = dto.Category.Trim();
            }

            foreach (var transaction in transactions)
            {
                await ReplaceTagsAsync(transaction, dto.TagNames, userId);
            }

            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "transaction.installment-group.updated",
                entityType: "Transaction",
                entityId: normalizedGroupId,
                userId: userId,
                summary: $"Compra parcelada atualizada: {dto.Description.Trim()} ({transactions.Count} parcelas).");

            return Ok(new
            {
                installmentGroupId = normalizedGroupId,
                updatedCount = transactions.Count
            });
        }

        private static bool TryBuildCreationPlan(
            TransactionRequest dto,
            out List<TransactionCreationItem> creationPlan,
            out string validationError)
        {
            creationPlan = new List<TransactionCreationItem>();
            validationError = string.Empty;

            var startDate = dto.Date.Date;
            var installmentCount = Math.Max(1, dto.InstallmentCount);

            if (dto.IsRecurring && installmentCount > 1)
            {
                validationError = "Escolha recorrência mensal ou parcelamento, não os dois ao mesmo tempo.";
                return false;
            }

            if (installmentCount > 1)
            {
                if (dto.Type != "expense")
                {
                    validationError = "Parcelamento está disponível apenas para despesas nesta etapa.";
                    return false;
                }

                var installmentGroupId = Guid.NewGuid().ToString("N");

                for (var installmentIndex = 1; installmentIndex <= installmentCount; installmentIndex += 1)
                {
                    creationPlan.Add(new TransactionCreationItem
                    {
                        Date = startDate.AddMonths(installmentIndex - 1),
                        InstallmentIndex = installmentIndex,
                        InstallmentCount = installmentCount,
                        InstallmentGroupId = installmentGroupId
                    });
                }

                return true;
            }

            if (!dto.IsRecurring)
            {
                creationPlan.Add(new TransactionCreationItem
                {
                    Date = startDate
                });
                return true;
            }

            if (!dto.RecurrenceEndDate.HasValue)
            {
                validationError = "Informe até quando a recorrência mensal deve ser gerada.";
                return false;
            }

            var endDate = dto.RecurrenceEndDate.Value.Date;
            var minimumEndDate = startDate.AddMonths(1);

            if (endDate < minimumEndDate)
            {
                validationError = "A recorrência mensal precisa alcançar pelo menos o próximo mês.";
                return false;
            }

            var recurrenceGroupId = Guid.NewGuid().ToString("N");

            creationPlan.Add(new TransactionCreationItem
            {
                Date = startDate,
                RecurrenceGroupId = recurrenceGroupId
            });

            return true;
        }

        private static Transaction BuildTransactionEntity(
            TransactionRequest dto,
            int userId,
            DateTime date,
            string? recurrenceGroupId,
            RecurringRule? recurringRule,
            int? installmentIndex,
            int? installmentCount,
            string? installmentGroupId,
            InstallmentPlan? installmentPlan,
            string source,
            DateTime? importedAtUtc)
        {
            return new Transaction
            {
                Description = dto.Description.Trim(),
                Category = dto.Category.Trim(),
                AmountCents = dto.AmountCents,
                Date = date,
                Type = dto.Type.Trim().ToLowerInvariant(),
                FinancialAccountId = dto.FinancialAccountId,
                Source = source,
                SourceReference = dto is TransactionImportItemRequest importItem
                    ? importItem.SourceReference?.Trim()
                    : null,
                ImportedAtUtc = importedAtUtc,
                IsRecurring = dto.IsRecurring,
                RecurrenceEndDate = dto.IsRecurring ? dto.RecurrenceEndDate?.Date : null,
                RecurrenceGroupId = recurrenceGroupId,
                RecurringRule = recurringRule,
                InstallmentIndex = installmentIndex,
                InstallmentCount = installmentCount,
                InstallmentGroupId = installmentGroupId,
                InstallmentPlan = installmentPlan,
                UserId = userId
            };
        }

        private async Task AttachTagsAsync(
            IEnumerable<Transaction> transactions,
            IEnumerable<string>? rawTagNames,
            int userId)
        {
            var normalizedTagNames = NormalizeTagNames(rawTagNames);

            if (normalizedTagNames.Count == 0)
            {
                return;
            }

            var normalizedTagKeys = normalizedTagNames
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

            var newTags = normalizedTagNames
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

            foreach (var transaction in transactions)
            {
                foreach (var tagName in normalizedTagNames)
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
        }

        private async Task ReplaceTagsAsync(Transaction transaction, IEnumerable<string>? rawTagNames, int userId)
        {
            await _context.Entry(transaction)
                .Collection(existing => existing.TagLinks)
                .Query()
                .Include(link => link.TransactionTag)
                .LoadAsync();

            _context.TransactionTagLinks.RemoveRange(transaction.TagLinks);
            transaction.TagLinks.Clear();

            await AttachTagsAsync(new[] { transaction }, rawTagNames, userId);
        }

        private static List<string> NormalizeTagNames(IEnumerable<string>? rawTagNames)
        {
            return (rawTagNames ?? Array.Empty<string>())
                .Select(name => name?.Trim() ?? string.Empty)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Length > 40 ? name[..40] : name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();
        }

        private static TransactionResponse ToResponse(Transaction transaction)
        {
            return new TransactionResponse
            {
                Id = transaction.Id,
                Description = transaction.Description,
                Category = transaction.Category,
                AmountCents = transaction.AmountCents,
                Date = transaction.Date,
                Type = transaction.Type,
                Source = transaction.Source,
                SourceReference = transaction.SourceReference,
                ImportedAtUtc = transaction.ImportedAtUtc,
                FinancialAccountId = transaction.FinancialAccountId,
                TagNames = transaction.TagLinks
                    .Select(link => link.TransactionTag.Name)
                    .OrderBy(name => name)
                    .ToList(),
                IsRecurring = transaction.IsRecurring,
                RecurrenceEndDate = transaction.RecurrenceEndDate,
                RecurrenceGroupId = transaction.RecurrenceGroupId,
                RecurringRuleId = transaction.RecurringRuleId,
                InstallmentIndex = transaction.InstallmentIndex,
                InstallmentCount = transaction.InstallmentCount,
                InstallmentGroupId = transaction.InstallmentGroupId,
                InstallmentPlanId = transaction.InstallmentPlanId
            };
        }

        private static RecurringRuleResponse ToRecurringRuleResponse(RecurringRule rule)
        {
            return new RecurringRuleResponse
            {
                Id = rule.PublicId,
                Description = rule.Description,
                Category = rule.Category,
                AmountCents = rule.AmountCents,
                Type = rule.Type,
                StartDate = rule.StartDate,
                EndDate = rule.EndDate,
                NextOccurrenceDate = rule.NextOccurrenceDate,
                LastGeneratedDate = rule.LastGeneratedDate,
                IsActive = rule.IsActive,
                TagNames = RecurringTransactionGenerationService.ParseTags(rule.TagsCsv)
            };
        }

        private static InstallmentPlanResponse ToInstallmentPlanResponse(
            InstallmentPlan plan,
            DateTime today)
        {
            var orderedTransactions = plan.Transactions
                .OrderBy(transaction => transaction.InstallmentIndex ?? int.MaxValue)
                .ThenBy(transaction => transaction.Date)
                .ToList();

            var postedTransactions = orderedTransactions
                .Where(transaction => transaction.Date.Date <= today)
                .ToList();

            var nextTransaction = orderedTransactions
                .Where(transaction => transaction.Date.Date > today)
                .OrderBy(transaction => transaction.Date)
                .ThenBy(transaction => transaction.InstallmentIndex ?? int.MaxValue)
                .FirstOrDefault();

            var tagNames = orderedTransactions
                .SelectMany(transaction => transaction.TagLinks)
                .Select(link => link.TransactionTag.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();

            var postedInstallments = postedTransactions.Count;
            var remainingInstallments = Math.Max(plan.InstallmentCount - postedInstallments, 0);

            return new InstallmentPlanResponse
            {
                Id = plan.PublicId,
                Description = plan.Description,
                Category = plan.Category,
                AmountPerInstallmentCents = plan.AmountPerInstallmentCents,
                InstallmentCount = plan.InstallmentCount,
                PostedInstallments = postedInstallments,
                RemainingInstallments = remainingInstallments,
                UpcomingInstallments = orderedTransactions.Count - postedInstallments,
                TotalAmountCents = plan.InstallmentCount * plan.AmountPerInstallmentCents,
                PaidAmountCents = postedInstallments * plan.AmountPerInstallmentCents,
                RemainingAmountCents = remainingInstallments * plan.AmountPerInstallmentCents,
                NextInstallmentDate = nextTransaction?.Date.Date,
                NextInstallmentIndex = nextTransaction?.InstallmentIndex,
                TagNames = tagNames
            };
        }

        private sealed class TransactionCreationItem
        {
            public DateTime Date { get; set; }
            public string? RecurrenceGroupId { get; set; }
            public int? InstallmentIndex { get; set; }
            public int? InstallmentCount { get; set; }
            public string? InstallmentGroupId { get; set; }
        }
    }
}
