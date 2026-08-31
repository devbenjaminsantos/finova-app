using System.Security.Claims;
using FinanceDashboard.Api.Controllers;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.BankSync;
using FinanceDashboard.Api.Services.BankSync.Pluggy;
using FinanceDashboard.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class FinancialAccountsControllerTests
{
    [Fact]
    public async Task Create_PersistsFinancialAccountForAuthenticatedUser()
    {
        using var context = CreateContext();
        var controller = CreateController(context, userId: 11);

        var dto = new FinancialAccountCreateRequest
        {
            Provider = "manual",
            InstitutionName = "Banco Héstia",
            AccountName = "Conta principal",
            AccountMask = "1234"
        };

        var result = await controller.Create(dto);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<FinancialAccountResponse>(created.Value);
        var entity = await context.FinancialAccounts.SingleAsync();

        Assert.Equal(11, entity.UserId);
        Assert.Equal("pending", entity.Status);
        Assert.Equal("manual", payload.Provider);
        Assert.Contains(context.AuditLogs, log => log.Action == "financial-account.created");
    }

    [Fact]
    public async Task Sync_RejectsManualAccountWithoutPretendingToImportTransactions()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 4,
            Provider = "manual",
            InstitutionName = "Banco Héstia",
            AccountName = "Conta principal",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var accountId = await context.FinancialAccounts.Select(item => item.Id).SingleAsync();
        var controller = CreateController(context, userId: 4);

        var result = await controller.Sync(accountId, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        var entity = await context.FinancialAccounts.SingleAsync();

        Assert.Equal("pending", entity.Status);
        Assert.Null(entity.LastSyncedAtUtc);
        Assert.DoesNotContain(context.AuditLogs, log => log.Action == "financial-account.synced");
    }

    [Fact]
    public async Task Sync_UpdatesLinkedPluggyAccount()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 4,
            Provider = "pluggy",
            ProviderItemId = "item-123",
            InstitutionName = "Banco Héstia",
            AccountName = "Conta principal",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var accountId = await context.FinancialAccounts.Select(item => item.Id).SingleAsync();
        var controller = CreateController(context, userId: 4);

        var result = await controller.Sync(accountId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<FinancialAccountSyncResponse>(ok.Value);
        var entity = await context.FinancialAccounts.SingleAsync();

        Assert.Equal("connected", payload.Status);
        Assert.Equal("connected", entity.Status);
        Assert.NotNull(entity.LastSyncedAtUtc);
        Assert.Contains(context.AuditLogs, log => log.Action == "financial-account.synced");
    }

    [Fact]
    public async Task CreateConnectToken_ReturnsTokenForPluggyAccount()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 8,
            Provider = "pluggy",
            InstitutionName = "Nubank",
            AccountName = "Conta principal",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var accountId = await context.FinancialAccounts.Select(item => item.Id).SingleAsync();
        var pluggyClient = new FakePluggyClient();
        var controller = CreateController(context, userId: 8, pluggyClient: pluggyClient);

        var result = await controller.CreateConnectToken(accountId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<FinancialAccountConnectTokenResponse>(ok.Value);

        Assert.Equal("pluggy-connect-token", payload.ConnectToken);
        Assert.Equal("user:8", pluggyClient.LastClientUserId);
    }

    [Fact]
    public async Task LinkItem_PersistsProviderItemIdAndConnectedStatus()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 9,
            Provider = "pluggy",
            InstitutionName = "Conta em configuracao",
            AccountName = "Carteira principal",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var accountId = await context.FinancialAccounts.Select(item => item.Id).SingleAsync();
        var controller = CreateController(context, userId: 9);

        var result = await controller.LinkItem(accountId, new FinancialAccountLinkItemRequest
        {
            ItemId = "item-123",
            InstitutionName = "Nubank"
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<FinancialAccountResponse>(ok.Value);
        var entity = await context.FinancialAccounts.SingleAsync();

        Assert.Equal("item-123", entity.ProviderItemId);
        Assert.Equal("connected", entity.Status);
        Assert.Equal("Nubank", payload.InstitutionName);
        Assert.Contains(context.AuditLogs, log => log.Action == "financial-account.linked");
    }

    [Fact]
    public async Task LinkItem_RejectsItemOwnedByAnotherPluggyClientUser()
    {
        using var context = CreateContext();
        context.FinancialAccounts.Add(new FinancialAccount
        {
            UserId = 9,
            Provider = "pluggy",
            InstitutionName = "Conta em configuracao",
            AccountName = "Carteira principal",
            Status = "pending"
        });
        await context.SaveChangesAsync();

        var accountId = await context.FinancialAccounts.Select(item => item.Id).SingleAsync();
        var controller = CreateController(
            context,
            userId: 9,
            pluggyClient: new FakePluggyClient(clientUserId: "user:42"));

        var result = await controller.LinkItem(accountId, new FinancialAccountLinkItemRequest
        {
            ItemId = "item-de-outro-usuario"
        }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        var entity = await context.FinancialAccounts.SingleAsync();
        Assert.Null(entity.ProviderItemId);
        Assert.Equal("pending", entity.Status);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static FinancialAccountsController CreateController(
        AppDbContext context,
        int userId,
        IPluggyClient? pluggyClient = null)
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

        var resolvedPluggyClient = pluggyClient ?? new FakePluggyClient();
        var controller = new FinancialAccountsController(
            context,
            new CurrentUserService(accessor),
            new AuditLogService(context, accessor),
            new BankSyncService(context, new IBankSyncProvider[]
            {
                new PluggyBankSyncProvider(resolvedPluggyClient)
            }),
            resolvedPluggyClient);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private class FakePluggyClient : IPluggyClient
    {
        private readonly string _clientUserId;

        public FakePluggyClient(string clientUserId = "user:9")
        {
            _clientUserId = clientUserId;
        }

        public bool IsConfigured => true;
        public string? LastClientUserId { get; private set; }

        public Task<string> CreateConnectTokenAsync(string clientUserId, string? itemId, CancellationToken cancellationToken = default)
        {
            LastClientUserId = clientUserId;
            return Task.FromResult("pluggy-connect-token");
        }

        public Task<PluggyItemResponse> GetItemAsync(string itemId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new PluggyItemResponse
            {
                Id = itemId,
                Status = "UPDATED",
                ClientUserId = _clientUserId,
                Connector = new PluggyConnectorResponse
                {
                    Name = "Nubank"
                }
            });
        }

        public Task<List<PluggyAccountResponse>> GetAccountsAsync(string itemId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new List<PluggyAccountResponse>());
        }

        public Task<List<PluggyTransactionResponse>> GetTransactionsAsync(string accountId, DateTime from, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new List<PluggyTransactionResponse>());
        }

        public Task UpdateItemAsync(string itemId, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}
