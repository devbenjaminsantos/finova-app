using FinanceDashboard.Api.Controllers;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.PublicDashboard;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.PublicDashboard;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class PublicDashboardControllerTests
{
    [Fact]
    public async Task Get_WithActiveToken_ReturnsReadOnlyDashboard()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var token = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));

        context.Users.Add(CreateUser(tokenHash));
        context.Transactions.Add(new Transaction
        {
            Id = 11,
            UserId = 7,
            Description = "Mercado",
            Category = "Alimentação",
            AmountCents = 12990,
            Date = new DateTime(2026, 8, 23),
            Type = "expense"
        });
        await context.SaveChangesAsync();

        var controller = new PublicDashboardController(context, tokenService);
        var result = await controller.Get(token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PublicDashboardResponse>(ok.Value);
        Assert.Equal("Keller", payload.DisplayName);
        Assert.Single(payload.Transactions);
        Assert.Equal(12990, payload.Transactions[0].AmountCents);
    }

    [Fact]
    public async Task Get_AfterRotation_RejectsOldTokenAndAcceptsNewToken()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var oldToken = tokenService.GenerateToken();
        var newToken = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(oldToken, out var oldHash));
        Assert.True(tokenService.TryHashToken(newToken, out var newHash));

        var user = CreateUser(oldHash);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        user.PublicDashboardTokenHash = newHash;
        await context.SaveChangesAsync();

        var controller = new PublicDashboardController(context, tokenService);
        var oldResult = await controller.Get(oldToken);
        var newResult = await controller.Get(newToken);

        Assert.IsType<NotFoundObjectResult>(oldResult.Result);
        Assert.IsType<OkObjectResult>(newResult.Result);
    }

    [Fact]
    public async Task Get_AfterRevocation_ReturnsNotFound()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var token = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));

        var user = CreateUser(tokenHash);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        user.PublicDashboardEnabled = false;
        user.PublicDashboardTokenHash = null;
        await context.SaveChangesAsync();

        var controller = new PublicDashboardController(context, tokenService);
        var result = await controller.Get(token);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Get_ForExpiredDemoAccount_ReturnsNotFound()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var token = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));

        var user = CreateUser(tokenHash);
        user.IsDemoAccount = true;
        user.DemoExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var controller = new PublicDashboardController(context, tokenService);
        var result = await controller.Get(token);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static User CreateUser(string tokenHash)
    {
        return new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            PasswordHash = "test-only",
            PublicDashboardEnabled = true,
            PublicDashboardTokenHash = tokenHash
        };
    }
}
