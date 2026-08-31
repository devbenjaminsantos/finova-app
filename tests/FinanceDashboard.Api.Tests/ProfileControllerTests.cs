using System.Security.Claims;
using FinanceDashboard.Api.Controllers;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.DTOs.Profile;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.CurrentUser;
using FinanceDashboard.Api.Services.PublicDashboard;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Xunit;
using AppPasswordHasher = FinanceDashboard.Api.Services.Auth.PasswordHasher;

namespace FinanceDashboard.Api.Tests;

public class ProfileControllerTests
{
    [Fact]
    public async Task Get_ReturnsGoalAlertPreferences()
    {
        using var context = CreateContext();
        context.Users.Add(new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 90,
            PasswordHash = HashPassword("SenhaSegura123!")
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context, 7);

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<AuthUserResponse>(ok.Value);

        Assert.True(payload.EmailGoalAlertsEnabled);
        Assert.Equal(90, payload.GoalAlertThresholdPercent);
    }

    [Fact]
    public async Task Update_PersistsGoalAlertPreferences_AndWritesAuditLog()
    {
        using var context = CreateContext();
        var user = new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            EmailGoalAlertsEnabled = false,
            GoalAlertThresholdPercent = 80
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var controller = CreateController(context, user.Id);

        var result = await controller.Update(new ProfileUpdateRequest
        {
            Name = "Keller",
            EmailGoalAlertsEnabled = true,
            GoalAlertThresholdPercent = 90
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<AuthUserResponse>(ok.Value);
        var refreshedUser = await context.Users.SingleAsync();

        Assert.True(payload.EmailGoalAlertsEnabled);
        Assert.Equal(90, payload.GoalAlertThresholdPercent);
        Assert.True(refreshedUser.EmailGoalAlertsEnabled);
        Assert.Equal(90, refreshedUser.GoalAlertThresholdPercent);
        Assert.Contains(
            context.AuditLogs,
            log => log.Action == "profile.updated" && log.Summary.Contains("90%"));
    }

    [Fact]
    public async Task UpdatePassword_IncrementsSessionVersion_AndRotatesCurrentCookie()
    {
        using var context = CreateContext();
        var user = new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var controller = CreateController(context, user.Id);

        var result = await controller.Update(new ProfileUpdateRequest
        {
            Name = user.Name,
            CurrentPassword = "SenhaSegura123!",
            NewPassword = "NovaSenha456!"
        });

        Assert.IsType<OkObjectResult>(result.Result);
        var refreshedUser = await context.Users.SingleAsync();
        var setCookie = controller.Response.Headers.SetCookie.ToString();

        Assert.Equal(2, refreshedUser.SessionVersion);
        Assert.Contains($"{AuthCookieService.CookieName}=", setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(context.AuditLogs, log => log.Action == "profile.updated-with-password");
    }

    [Fact]
    public async Task UpdatePublicDashboardSettings_ActivatesSharedLink()
    {
        using var context = CreateContext();
        context.Users.Add(new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            PasswordHash = HashPassword("SenhaSegura123!")
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context, 7);

        var result = await controller.UpdatePublicDashboardSettings(new PublicDashboardSettingsRequest
        {
            Enabled = true
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PublicDashboardSettingsResponse>(ok.Value);
        var refreshedUser = await context.Users.SingleAsync();
        var token = GetTokenFromPublicUrl(payload.PublicUrl);
        var tokenService = new PublicDashboardTokenService();

        Assert.True(payload.Enabled);
        Assert.True(payload.HasActiveToken);
        Assert.NotNull(payload.PublicUrl);
        Assert.Contains("/compartilhado/", payload.PublicUrl);
        Assert.True(refreshedUser.PublicDashboardEnabled);
        Assert.NotNull(refreshedUser.PublicDashboardTokenHash);
        Assert.Equal(64, refreshedUser.PublicDashboardTokenHash.Length);
        Assert.NotEqual(token, refreshedUser.PublicDashboardTokenHash);
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));
        Assert.Equal(refreshedUser.PublicDashboardTokenHash, tokenHash);
    }

    [Fact]
    public async Task GetPublicDashboardSettings_DoesNotExposeExistingToken()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var token = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));

        context.Users.Add(CreateUser(publicDashboardEnabled: true, publicDashboardTokenHash: tokenHash));
        await context.SaveChangesAsync();

        var controller = CreateController(context, 7);
        var result = await controller.GetPublicDashboardSettings();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PublicDashboardSettingsResponse>(ok.Value);

        Assert.True(payload.Enabled);
        Assert.True(payload.HasActiveToken);
        Assert.Null(payload.PublicUrl);
    }

    [Fact]
    public async Task RotatePublicDashboardToken_ReplacesStoredHashAndReturnsNewLink()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var originalToken = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(originalToken, out var originalHash));

        context.Users.Add(CreateUser(publicDashboardEnabled: true, publicDashboardTokenHash: originalHash));
        await context.SaveChangesAsync();

        var controller = CreateController(context, 7);
        var result = await controller.RotatePublicDashboardToken();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PublicDashboardSettingsResponse>(ok.Value);
        var rotatedToken = GetTokenFromPublicUrl(payload.PublicUrl);
        var refreshedUser = await context.Users.SingleAsync();

        Assert.NotEqual(originalToken, rotatedToken);
        Assert.NotEqual(originalHash, refreshedUser.PublicDashboardTokenHash);
        Assert.True(tokenService.TryHashToken(rotatedToken, out var rotatedHash));
        Assert.Equal(rotatedHash, refreshedUser.PublicDashboardTokenHash);
        Assert.Contains(context.AuditLogs, log => log.Action == "profile.public-dashboard.rotated");
    }

    [Fact]
    public async Task RevokePublicDashboardToken_DisablesDashboardAndDeletesHash()
    {
        using var context = CreateContext();
        var tokenService = new PublicDashboardTokenService();
        var token = tokenService.GenerateToken();
        Assert.True(tokenService.TryHashToken(token, out var tokenHash));

        context.Users.Add(CreateUser(publicDashboardEnabled: true, publicDashboardTokenHash: tokenHash));
        await context.SaveChangesAsync();

        var controller = CreateController(context, 7);
        var result = await controller.RevokePublicDashboardToken();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PublicDashboardSettingsResponse>(ok.Value);
        var refreshedUser = await context.Users.SingleAsync();

        Assert.False(payload.Enabled);
        Assert.False(payload.HasActiveToken);
        Assert.Null(payload.PublicUrl);
        Assert.False(refreshedUser.PublicDashboardEnabled);
        Assert.Null(refreshedUser.PublicDashboardTokenHash);
        Assert.Contains(context.AuditLogs, log => log.Action == "profile.public-dashboard.revoked");
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static ProfileController CreateController(AppDbContext context, int userId)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Demo:Email"] = "demo@hestia.local",
                ["Jwt:Key"] = "uma-chave-super-segura-para-testes-publicos",
                ["Jwt:Issuer"] = "FinanceDashboard",
                ["Jwt:Audience"] = "FinanceDashboard",
                ["Client:BaseUrl"] = "https://hestia.example"
            })
            .Build();

        var httpContext = new DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(
                new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                },
                "TestAuth"));

        var httpContextAccessor = new HttpContextAccessor
        {
            HttpContext = httpContext
        };

        var controller = new ProfileController(
            context,
            new CurrentUserService(httpContextAccessor),
            new AppPasswordHasher(new PasswordHasher<User>()),
            new PasswordPolicyService(),
            new JwTokenService(configuration),
            new AuthCookieService(new FakeWebHostEnvironment()),
            new AuditLogService(context, httpContextAccessor),
            configuration,
            new PublicDashboardTokenService());

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static string HashPassword(string password, User? user = null)
    {
        var entity = user ?? new User
        {
            Name = "Seed",
            Email = "seed@hestia.local",
            EmailConfirmed = true
        };

        return new AppPasswordHasher(new PasswordHasher<User>()).HashPassword(entity, password);
    }

    private static User CreateUser(bool publicDashboardEnabled, string? publicDashboardTokenHash)
    {
        return new User
        {
            Id = 7,
            Name = "Keller",
            Email = "keller@hestia.local",
            EmailConfirmed = true,
            PasswordHash = HashPassword("SenhaSegura123!"),
            PublicDashboardEnabled = publicDashboardEnabled,
            PublicDashboardTokenHash = publicDashboardTokenHash
        };
    }

    private static string GetTokenFromPublicUrl(string? publicUrl)
    {
        Assert.False(string.IsNullOrWhiteSpace(publicUrl));
        return new Uri(publicUrl).Segments[^1];
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "FinanceDashboard.Api.Tests";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
