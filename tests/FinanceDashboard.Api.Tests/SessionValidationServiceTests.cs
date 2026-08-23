using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class SessionValidationServiceTests
{
    [Fact]
    public void GenerateToken_IncludesSessionVersionClaim()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "FinovaJwtKey2026-Segura-Com-32-Bytes!",
                ["Jwt:Issuer"] = "FinanceDashboard",
                ["Jwt:Audience"] = "FinanceDashboard"
            })
            .Build();
        var service = new JwTokenService(configuration);

        var rawToken = service.GenerateToken(CreateUser(sessionVersion: 3));
        var token = new JwtSecurityTokenHandler().ReadJwtToken(rawToken);

        Assert.Equal(
            "3",
            token.Claims.Single(claim => claim.Type == JwTokenService.SessionVersionClaimType).Value);
    }

    [Fact]
    public async Task IsCurrentAsync_AcceptsMatchingSessionVersion()
    {
        using var context = CreateContext();
        context.Users.Add(CreateUser(sessionVersion: 3));
        await context.SaveChangesAsync();
        var service = new SessionValidationService(context);

        var isCurrent = await service.IsCurrentAsync(CreatePrincipal(sessionVersion: 3));

        Assert.True(isCurrent);
    }

    [Fact]
    public async Task IsCurrentAsync_RejectsRevokedSessionVersion()
    {
        using var context = CreateContext();
        context.Users.Add(CreateUser(sessionVersion: 4));
        await context.SaveChangesAsync();
        var service = new SessionValidationService(context);

        var isCurrent = await service.IsCurrentAsync(CreatePrincipal(sessionVersion: 3));

        Assert.False(isCurrent);
    }

    [Fact]
    public async Task IsCurrentAsync_RejectsLegacyTokenWithoutSessionVersion()
    {
        using var context = CreateContext();
        context.Users.Add(CreateUser(sessionVersion: 1));
        await context.SaveChangesAsync();
        var service = new SessionValidationService(context);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, "7") },
            "TestAuth"));

        var isCurrent = await service.IsCurrentAsync(principal);

        Assert.False(isCurrent);
    }

    [Fact]
    public async Task IsCurrentAsync_RejectsExpiredDemoAccount()
    {
        using var context = CreateContext();
        var user = CreateUser(sessionVersion: 1);
        user.IsDemoAccount = true;
        user.DemoExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var service = new SessionValidationService(context);

        var isCurrent = await service.IsCurrentAsync(CreatePrincipal(sessionVersion: 1));

        Assert.False(isCurrent);
    }

    [Fact]
    public async Task IsCurrentAsync_AcceptsActiveDemoAccount()
    {
        using var context = CreateContext();
        var user = CreateUser(sessionVersion: 1);
        user.IsDemoAccount = true;
        user.DemoExpiresAtUtc = DateTime.UtcNow.AddMinutes(30);
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var service = new SessionValidationService(context);

        var isCurrent = await service.IsCurrentAsync(CreatePrincipal(sessionVersion: 1));

        Assert.True(isCurrent);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static User CreateUser(int sessionVersion)
    {
        return new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@finova.app",
            PasswordHash = "hash",
            SessionVersion = sessionVersion
        };
    }

    private static ClaimsPrincipal CreatePrincipal(int sessionVersion)
    {
        return new ClaimsPrincipal(new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "7"),
                new Claim(JwTokenService.SessionVersionClaimType, sessionVersion.ToString())
            },
            "TestAuth"));
    }
}
