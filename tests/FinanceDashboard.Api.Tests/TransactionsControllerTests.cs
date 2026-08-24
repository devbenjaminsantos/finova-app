using System.Security.Claims;
using FinanceDashboard.Api.Controllers;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.CurrentUser;
using FinanceDashboard.Api.Services.Recurring;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class TransactionsControllerTests
{
    [Fact]
    public async Task GetAll_ReturnsOnlyTransactionsFromAuthenticatedUser()
    {
        using var context = CreateContext();
        SeedTransactions(context);

        var controller = CreateController(context, userId: 1);

        var result = await controller.GetAll();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IReadOnlyList<TransactionResponse>>(ok.Value);

        Assert.Equal(2, payload.Count);
        Assert.All(payload, item => Assert.Contains(item.Description, new[] { "Mercado", "Salario" }));
        Assert.DoesNotContain(payload, item => item.Description == "Outro usuario");
    }

    [Fact]
    public async Task Create_PersistsTransactionForAuthenticatedUser()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 7);

        var dto = new TransactionCreateRequest
        {
            Description = "Assinatura streaming",
            Category = "Assinaturas",
            AmountCents = 4990,
            Date = new DateTime(2026, 4, 10),
            Type = "expense"
        };

        var result = await controller.Create(dto);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<TransactionResponse>(created.Value);
        var entity = await context.Transactions.SingleAsync();

        Assert.Equal(7, entity.UserId);
        Assert.Equal(dto.Description, entity.Description);
        Assert.Equal(dto.Category, entity.Category);
        Assert.Equal(dto.AmountCents, entity.AmountCents);
        Assert.Equal(dto.Type, entity.Type);
        Assert.Equal("manual", entity.Source);
        Assert.Null(entity.ImportedAtUtc);
        Assert.False(entity.IsRecurring);
        Assert.Equal(entity.Id, payload.Id);
        Assert.Equal("manual", payload.Source);
        Assert.Contains(context.AuditLogs, log => log.Action == "transaction.created" && log.UserId == 7);
    }

    [Fact]
    public async Task Create_ReusesTagIgnoringLetterCase()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 7);

        await controller.Create(new TransactionCreateRequest
        {
            Description = "Compra semanal",
            Category = "Alimentação",
            AmountCents = 12000,
            Date = new DateTime(2026, 4, 10),
            Type = "expense",
            TagNames = new List<string> { "Mercado" }
        });
        await controller.Create(new TransactionCreateRequest
        {
            Description = "Compra mensal",
            Category = "ALIMENTAÇÃO",
            AmountCents = 45000,
            Date = new DateTime(2026, 4, 11),
            Type = "expense",
            TagNames = new List<string> { "MERCADO", "mercado" }
        });

        var tag = Assert.Single(context.TransactionTags);
        Assert.Equal("Mercado", tag.Name);
        Assert.Equal(2, context.TransactionTagLinks.Count());
        Assert.All(
            context.TransactionTagLinks,
            link => Assert.Equal(tag.Id, link.TransactionTagId));
    }

    [Fact]
    public async Task Create_CreatesRecurringRuleAndFirstOccurrence_WhenRequested()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 7);

        var dto = new TransactionCreateRequest
        {
            Description = "Condominio",
            Category = "Moradia",
            AmountCents = 180000,
            Date = new DateTime(2026, 4, 7),
            Type = "expense",
            IsRecurring = true,
            RecurrenceEndDate = new DateTime(2026, 7, 7),
        };

        var result = await controller.Create(dto);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<TransactionResponse>(created.Value);
        var entity = await context.Transactions.SingleAsync();
        var rule = await context.RecurringRules.SingleAsync();

        Assert.True(entity.IsRecurring);
        Assert.Equal(7, entity.UserId);
        Assert.Equal("manual", entity.Source);
        Assert.Equal(new DateTime(2026, 4, 7), entity.Date);
        Assert.Equal(dto.RecurrenceEndDate, entity.RecurrenceEndDate);
        Assert.NotNull(entity.RecurringRuleId);
        Assert.Equal(rule.Id, entity.RecurringRuleId);
        Assert.Equal(rule.PublicId, entity.RecurrenceGroupId);
        Assert.Equal("Condominio", rule.Description);
        Assert.Equal("Moradia", rule.Category);
        Assert.Equal(180000, rule.AmountCents);
        Assert.Equal("expense", rule.Type);
        Assert.True(rule.IsActive);
        Assert.Equal(new DateTime(2026, 5, 7), rule.NextOccurrenceDate);
        Assert.True(payload.IsRecurring);
        Assert.NotNull(payload.RecurrenceGroupId);
        Assert.Equal(rule.Id, payload.RecurringRuleId);
        Assert.Equal("manual", payload.Source);
        Assert.Contains(context.AuditLogs, log => log.Action == "transaction.created" && log.Summary.Contains("Regra recorrente criada"));
    }

    [Fact]
    public async Task GetAll_GeneratesDueRecurringTransactionsBeforeReturning()
    {
        using var context = CreateContext();

        var rule = new RecurringRule
        {
            UserId = 7,
            PublicId = "recurring-condominio",
            Description = "Condominio",
            Category = "Moradia",
            AmountCents = 180000,
            Type = "expense",
            StartDate = DateTime.UtcNow.Date.AddMonths(-2),
            EndDate = DateTime.UtcNow.Date.AddMonths(1),
            LastGeneratedDate = DateTime.UtcNow.Date.AddMonths(-2),
            NextOccurrenceDate = DateTime.UtcNow.Date.AddMonths(-1),
            IsActive = true,
            TagsCsv = "casa",
            CreatedAtUtc = DateTime.UtcNow,
        };

        context.RecurringRules.Add(rule);
        context.Transactions.Add(new Transaction
        {
            UserId = 7,
            Description = rule.Description,
            Category = rule.Category,
            AmountCents = rule.AmountCents,
            Date = rule.StartDate,
            Type = rule.Type,
            Source = "manual",
            IsRecurring = true,
            RecurrenceEndDate = rule.EndDate,
            RecurrenceGroupId = rule.PublicId,
            RecurringRule = rule,
        });
        context.SaveChanges();

        var controller = CreateController(context, userId: 7);

        var result = await controller.GetAll();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IReadOnlyList<TransactionResponse>>(ok.Value);

        Assert.True(payload.Count >= 2);
        Assert.Contains(payload, transaction => transaction.Date.Date == DateTime.UtcNow.Date.AddMonths(-1));
        Assert.Contains(payload, transaction => transaction.Date.Date == DateTime.UtcNow.Date);
    }

    [Fact]
    public async Task GetRecurringRules_ReturnsRulesForAuthenticatedUser()
    {
        using var context = CreateContext();

        context.RecurringRules.AddRange(
            new RecurringRule
            {
                UserId = 7,
                PublicId = "rule-1",
                Description = "Salario",
                Category = "Salario",
                AmountCents = 500000,
                Type = "income",
                StartDate = new DateTime(2026, 4, 5),
                EndDate = new DateTime(2026, 12, 5),
                LastGeneratedDate = new DateTime(2026, 4, 5),
                NextOccurrenceDate = new DateTime(2026, 5, 5),
                IsActive = true,
                TagsCsv = "trabalho"
            },
            new RecurringRule
            {
                UserId = 9,
                PublicId = "rule-2",
                Description = "Outro",
                Category = "Outros",
                AmountCents = 1000,
                Type = "expense",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2026, 6, 1),
                IsActive = true,
                TagsCsv = ""
            });
        context.SaveChanges();

        var controller = CreateController(context, userId: 7);

        var result = await controller.GetRecurringRules();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IReadOnlyList<RecurringRuleResponse>>(ok.Value);
        var ruleResponse = Assert.Single(payload);

        Assert.Equal("rule-1", ruleResponse.Id);
        Assert.Equal("Salario", ruleResponse.Description);
        Assert.Equal("income", ruleResponse.Type);
        Assert.Contains("trabalho", ruleResponse.TagNames);
    }

    [Fact]
    public async Task Create_CreatesInstallmentPlan_WhenExpenseIsSplitIntoInstallments()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 7);

        var dto = new TransactionCreateRequest
        {
            Description = "Notebook",
            Category = "Tecnologia",
            AmountCents = 250000,
            Date = new DateTime(2026, 4, 5),
            Type = "expense",
            InstallmentCount = 3
        };

        var result = await controller.Create(dto);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<TransactionResponse>(created.Value);
        var plan = await context.InstallmentPlans.SingleAsync();
        var transactions = await context.Transactions
            .OrderBy(transaction => transaction.InstallmentIndex)
            .ToListAsync();

        Assert.Equal("Notebook", plan.Description);
        Assert.Equal("Tecnologia", plan.Category);
        Assert.Equal(250000, plan.AmountPerInstallmentCents);
        Assert.Equal(3, plan.InstallmentCount);
        Assert.Equal(3, transactions.Count);
        Assert.All(transactions, transaction => Assert.Equal(plan.Id, transaction.InstallmentPlanId));
        Assert.All(transactions, transaction => Assert.Equal(plan.PublicId, transaction.InstallmentGroupId));
        Assert.Equal(plan.Id, payload.InstallmentPlanId);
        Assert.Equal(plan.PublicId, payload.InstallmentGroupId);
    }

    [Fact]
    public async Task GetInstallmentPlans_ReturnsStructuredSummaryForAuthenticatedUser()
    {
        using var context = CreateContext();
        SeedInstallmentPlan(context, userId: 4);
        SeedInstallmentPlan(context, userId: 9, publicId: "other-plan");

        var controller = CreateController(context, userId: 4);

        var result = await controller.GetInstallmentPlans();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IReadOnlyList<InstallmentPlanResponse>>(ok.Value);
        var plan = Assert.Single(payload);

        Assert.Equal("notebook-plan", plan.Id);
        Assert.Equal("Notebook", plan.Description);
        Assert.Equal("Tecnologia", plan.Category);
        Assert.Equal(3, plan.InstallmentCount);
        Assert.Equal(3, plan.PostedInstallments);
        Assert.Equal(0, plan.RemainingInstallments);
        Assert.Equal(600000, plan.TotalAmountCents);
        Assert.Contains("trabalho", plan.TagNames);
    }

    [Fact]
    public async Task Import_PersistsTransactionsForAuthenticatedUser()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 15);

        var dto = new TransactionImportRequest
        {
            ImportFormat = "csv",
            Transactions =
            {
                new TransactionImportItemRequest
                {
                    Description = "Padaria",
                    Category = "Alimentacao",
                    AmountCents = 2590,
                    Date = new DateTime(2026, 4, 11),
                    Type = "expense"
                },
                new TransactionImportItemRequest
                {
                    Description = "Transferencia recebida",
                    Category = "Reembolso",
                    AmountCents = 30000,
                    Date = new DateTime(2026, 4, 12),
                    Type = "income",
                    SourceReference = "arquivo-001"
                }
            }
        };

        var result = await controller.Import(dto);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<TransactionImportResponse>(ok.Value);
        var entities = await context.Transactions.OrderBy(item => item.Date).ToListAsync();

        Assert.Equal(2, payload.ImportedCount);
        Assert.Equal(2, entities.Count);
        Assert.All(entities, item => Assert.Equal(15, item.UserId));
        Assert.All(entities, item => Assert.Equal("import_csv", item.Source));
        Assert.All(entities, item => Assert.NotNull(item.ImportedAtUtc));
        Assert.Equal("arquivo-001", entities[1].SourceReference);
        Assert.Contains(context.AuditLogs, log => log.Action == "transaction.imported" && log.UserId == 15);
    }

    [Fact]
    public async Task Import_RejectsFinancialAccountFromAnotherUser()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 99,
            Provider = "manual",
            InstitutionName = "Banco externo",
            AccountName = "Conta externa",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var foreignAccountId = await context.FinancialAccounts.Select(account => account.Id).SingleAsync();
        var controller = CreateController(context, userId: 15);
        var dto = new TransactionImportRequest
        {
            ImportFormat = "csv",
            Transactions =
            {
                new TransactionImportItemRequest
                {
                    Description = "Transacao indevida",
                    Category = "Outros",
                    AmountCents = 1000,
                    Date = new DateTime(2026, 4, 11),
                    Type = "expense",
                    FinancialAccountId = foreignAccountId
                }
            }
        };

        var result = await controller.Import(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(context.Transactions);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_WhenTransactionBelongsToAnotherUser()
    {
        using var context = CreateContext();
        SeedTransactions(context);

        var foreignTransaction = await context.Transactions
            .FirstAsync(transaction => transaction.UserId == 2);

        var controller = CreateController(context, userId: 1);

        var result = await controller.Update(foreignTransaction.Id, new TransactionUpdateRequest
        {
            Description = "Nao deveria alterar",
            Category = "Outros",
            AmountCents = 1000,
            Date = new DateTime(2026, 4, 10),
            Type = "expense"
        });

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_ChangesOwnedTransaction()
    {
        using var context = CreateContext();
        SeedTransactions(context);

        var ownedTransaction = await context.Transactions
            .FirstAsync(transaction => transaction.UserId == 1 && transaction.Type == "expense");

        var controller = CreateController(context, userId: 1);

        var result = await controller.Update(ownedTransaction.Id, new TransactionUpdateRequest
        {
            Description = "Mercado atualizado",
            Category = "Alimentacao",
            AmountCents = 92000,
            Date = new DateTime(2026, 4, 9),
            Type = "expense"
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<TransactionResponse>(ok.Value);
        var entity = await context.Transactions.SingleAsync(transaction => transaction.Id == ownedTransaction.Id);

        Assert.Equal("Mercado atualizado", entity.Description);
        Assert.Equal("Alimentacao", entity.Category);
        Assert.Equal(92000, entity.AmountCents);
        Assert.Equal("Mercado atualizado", payload.Description);
        Assert.Contains(context.AuditLogs, log => log.Action == "transaction.updated" && log.EntityId == ownedTransaction.Id.ToString());
    }

    [Fact]
    public async Task Update_RejectsFinancialAccountFromAnotherUser()
    {
        using var context = CreateContext();
        SeedTransactions(context);
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 2,
            Provider = "manual",
            InstitutionName = "Banco externo",
            AccountName = "Conta externa",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var ownedTransaction = await context.Transactions.FirstAsync(transaction => transaction.UserId == 1);
        var foreignAccountId = await context.FinancialAccounts.Select(account => account.Id).SingleAsync();
        var controller = CreateController(context, userId: 1);

        var result = await controller.Update(ownedTransaction.Id, new TransactionUpdateRequest
        {
            Description = ownedTransaction.Description,
            Category = ownedTransaction.Category,
            AmountCents = ownedTransaction.AmountCents,
            Date = ownedTransaction.Date,
            Type = ownedTransaction.Type,
            FinancialAccountId = foreignAccountId
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(ownedTransaction.FinancialAccountId);
    }

    [Fact]
    public async Task Delete_RemovesOwnedTransaction()
    {
        using var context = CreateContext();
        SeedTransactions(context);

        var ownedTransaction = await context.Transactions
            .FirstAsync(transaction => transaction.UserId == 1);

        var controller = CreateController(context, userId: 1);

        var result = await controller.Delete(ownedTransaction.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.DoesNotContain(context.Transactions, transaction => transaction.Id == ownedTransaction.Id);
        Assert.Contains(context.AuditLogs, log => log.Action == "transaction.deleted" && log.EntityId == ownedTransaction.Id.ToString());
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_WhenTransactionBelongsToAnotherUser()
    {
        using var context = CreateContext();
        SeedTransactions(context);

        var foreignTransaction = await context.Transactions
            .FirstAsync(transaction => transaction.UserId == 2);

        var controller = CreateController(context, userId: 1);

        var result = await controller.Delete(foreignTransaction.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Contains(context.Transactions, transaction => transaction.Id == foreignTransaction.Id);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static TransactionsController CreateController(AppDbContext context, int userId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, $"User {userId}"),
        };

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
        };

        var accessor = new HttpContextAccessor
        {
            HttpContext = httpContext
        };

        var controller = new TransactionsController(
            context,
            new CurrentUserService(accessor),
            new AuditLogService(context, accessor),
            new RecurringTransactionGenerationService(context));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static void SeedTransactions(AppDbContext context)
    {
        context.Transactions.AddRange(
            new Transaction
            {
                UserId = 1,
                Description = "Mercado",
                Category = "Alimentacao",
                AmountCents = 85000,
                Date = new DateTime(2026, 4, 8),
                Type = "expense",
                Source = "manual"
            },
            new Transaction
            {
                UserId = 1,
                Description = "Salario",
                Category = "Salario",
                AmountCents = 700000,
                Date = new DateTime(2026, 4, 5),
                Type = "income",
                Source = "manual"
            },
            new Transaction
            {
                UserId = 2,
                Description = "Outro usuario",
                Category = "Transporte",
                AmountCents = 21000,
                Date = new DateTime(2026, 4, 7),
                Type = "expense",
                Source = "manual"
            });

        context.SaveChanges();
    }

    private static void SeedInstallmentPlan(AppDbContext context, int userId, string publicId = "notebook-plan")
    {
        var plan = new InstallmentPlan
        {
            UserId = userId,
            PublicId = publicId,
            Description = "Notebook",
            Category = "Tecnologia",
            AmountPerInstallmentCents = 200000,
            InstallmentCount = 3,
            StartDate = new DateTime(2026, 2, 5),
            CreatedAtUtc = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        var tag = new TransactionTag
        {
            UserId = userId,
            Name = "trabalho"
        };

        context.InstallmentPlans.Add(plan);
        context.TransactionTags.Add(tag);
        context.SaveChanges();

        var transactions = new[]
        {
            new Transaction
            {
                UserId = userId,
                Description = "Notebook",
                Category = "Tecnologia",
                AmountCents = 200000,
                Date = new DateTime(2026, 2, 5),
                Type = "expense",
                Source = "manual",
                InstallmentIndex = 1,
                InstallmentCount = 3,
                InstallmentGroupId = publicId,
                InstallmentPlanId = plan.Id
            },
            new Transaction
            {
                UserId = userId,
                Description = "Notebook",
                Category = "Tecnologia",
                AmountCents = 200000,
                Date = new DateTime(2026, 3, 5),
                Type = "expense",
                Source = "manual",
                InstallmentIndex = 2,
                InstallmentCount = 3,
                InstallmentGroupId = publicId,
                InstallmentPlanId = plan.Id
            },
            new Transaction
            {
                UserId = userId,
                Description = "Notebook",
                Category = "Tecnologia",
                AmountCents = 200000,
                Date = new DateTime(2026, 4, 5),
                Type = "expense",
                Source = "manual",
                InstallmentIndex = 3,
                InstallmentCount = 3,
                InstallmentGroupId = publicId,
                InstallmentPlanId = plan.Id
            }
        };

        context.Transactions.AddRange(transactions);
        context.SaveChanges();

        context.TransactionTagLinks.Add(new TransactionTagLink
        {
            TransactionId = transactions[0].Id,
            TransactionTagId = tag.Id
        });

        context.SaveChanges();
    }
}
