using FinanceDashboard.Api.Controllers;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class AuthControllerTests
{
    [Fact]
    public async Task Register_ReturnsConflict_WhenEmailAlreadyExists()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        context.Users.Add(new User
        {
            Name = "Já Existe",
            Email = "user@finova.app",
            EmailConfirmed = true,
            PasswordHash = HashPassword("SenhaSegura123!")
        });
        await context.SaveChangesAsync();

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "USER@finova.app",
            Password = "SenhaSegura123!"
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(conflict.Value);

        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal("E-mail já cadastrado.", problem.Title);
    }

    [Fact]
    public async Task Register_CreatesUnconfirmedUser_AndVerificationToken()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var controller = CreateController(context, emailSender: emailSender);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "novo@finova.app",
            Password = "SenhaSegura123!"
        });

        var created = Assert.IsType<ObjectResult>(result.Result);
        var payload = Assert.IsType<RegistrationResponse>(created.Value);
        var user = await context.Users.SingleAsync();

        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        Assert.Equal("novo@finova.app", user.Email);
        Assert.False(user.EmailConfirmed);
        Assert.Single(context.EmailVerificationTokens);
        Assert.Contains(context.AuditLogs, log => log.Action == "auth.registered" && log.UserId == user.Id);
        Assert.NotNull(emailSender.LastVerificationUrl);
        Assert.True(payload.VerificationEmailSent);
        Assert.Equal(payload.User.Email, user.Email);
    }

    [Fact]
    public async Task Register_ReportsPendingVerificationEmail_WhenSmtpFails()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender { ThrowOnVerification = true };
        var controller = CreateController(context, emailSender: emailSender);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "novo@finova.app",
            Password = "SenhaSegura123!"
        });

        var created = Assert.IsType<ObjectResult>(result.Result);
        var payload = Assert.IsType<RegistrationResponse>(created.Value);

        Assert.False(payload.VerificationEmailSent);
        Assert.Single(context.Users);
        Assert.Single(context.EmailVerificationTokens);
    }

    [Fact]
    public async Task Register_ReturnsBadRequest_WhenPasswordIsTooWeak()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "novo@finova.app",
            Password = "12345678"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(badRequest.Value);

        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        Assert.Equal(PasswordPolicyService.DefaultMessage, problem.Title);
    }

    [Fact]
    public async Task Login_ReturnsForbidden_WhenEmailIsNotConfirmed()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = false,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var result = await controller.Login(new LoginRequest
        {
            Email = user.Email,
            Password = "SenhaSegura123!"
        });

        var forbidden = Assert.IsType<ObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(forbidden.Value);

        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        Assert.Equal("Confirme seu e-mail antes de entrar.", problem.Title);
        Assert.Contains(context.AuditLogs, log => log.Action == "auth.login-blocked-unconfirmed-email");
    }

    [Fact]
    public async Task Login_ReturnsGenericUnauthorized_WhenEmailDoesNotExist()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.Login(new LoginRequest
        {
            Email = "inexistente@finova.app",
            Password = "SenhaSegura123!"
        });

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(unauthorized.Value);

        Assert.Equal("E-mail ou senha inválidos.", problem.Title);
    }

    [Fact]
    public async Task Login_DoesNotRevealUnconfirmedAccount_WhenPasswordIsWrong()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = false,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var result = await controller.Login(new LoginRequest
        {
            Email = user.Email,
            Password = "SenhaErrada123!"
        });

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        var problem = Assert.IsType<ProblemDetails>(unauthorized.Value);

        Assert.Equal("E-mail ou senha inválidos.", problem.Title);
        Assert.DoesNotContain(
            context.AuditLogs,
            log => log.Action == "auth.login-blocked-unconfirmed-email");
    }

    [Fact]
    public async Task Login_SetsHttpOnlyCookie_WithoutReturningToken_WhenCredentialsAreValid()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var result = await controller.Login(new LoginRequest
        {
            Email = user.Email,
            Password = "SenhaSegura123!"
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<AuthResponse>(ok.Value);

        Assert.Equal(user.Email, payload.User.Email);
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        Assert.Contains($"{AuthCookieService.CookieName}=", setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(context.AuditLogs, log => log.Action == "auth.login-succeeded" && log.UserId == user.Id);
    }

    [Fact]
    public void AuthCookie_UsesSecureSameSiteNone_InProduction()
    {
        var httpContext = new DefaultHttpContext();
        var environment = new FakeWebHostEnvironment { EnvironmentName = "Production" };
        var cookieService = new AuthCookieService(environment);

        cookieService.Write(httpContext.Response, "signed-jwt");

        var setCookie = httpContext.Response.Headers.SetCookie.ToString();
        Assert.Contains($"{AuthCookieService.CookieName}=", setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=none", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Logout_DeletesAuthenticationCookie()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var result = controller.Logout();

        Assert.IsType<NoContentResult>(result);
        var setCookie = controller.Response.Headers.SetCookie.ToString();
        Assert.Contains($"{AuthCookieService.CookieName}=", setCookie);
        Assert.Contains("expires=", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_LocksUserAfterTooManyFailedAttempts()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);

        context.Users.Add(user);
        await context.SaveChangesAsync();

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var result = await controller.Login(new LoginRequest
            {
                Email = user.Email,
                Password = "SenhaErrada123!"
            });

            var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result.Result);
            Assert.Equal(StatusCodes.Status401Unauthorized, unauthorized.StatusCode);
        }

        var refreshedUser = await context.Users.SingleAsync();
        Assert.Equal(5, refreshedUser.FailedLoginAttempts);
        Assert.NotNull(refreshedUser.LockoutEndsAtUtc);
        Assert.Contains(context.AuditLogs, log => log.Action == "auth.login-locked-out");

        var lockedOutResult = await controller.Login(new LoginRequest
        {
            Email = user.Email,
            Password = "SenhaSegura123!"
        });

        var tooManyRequests = Assert.IsType<ObjectResult>(lockedOutResult.Result);
        var problem = Assert.IsType<ProblemDetails>(tooManyRequests.Value);

        Assert.Equal(StatusCodes.Status429TooManyRequests, tooManyRequests.StatusCode);
        Assert.Equal("Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.", problem.Title);
    }

    [Fact]
    public async Task Login_ResetsFailedAttemptTracking_AfterSuccessfulAuthentication()
    {
        using var context = CreateContext();
        var controller = CreateController(context);

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
            FailedLoginAttempts = 2,
            LastFailedLoginAtUtc = DateTime.UtcNow.AddMinutes(-3)
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var result = await controller.Login(new LoginRequest
        {
            Email = user.Email,
            Password = "SenhaSegura123!"
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(ok.Value);

        var refreshedUser = await context.Users.SingleAsync();
        Assert.Equal(0, refreshedUser.FailedLoginAttempts);
        Assert.Null(refreshedUser.LockoutEndsAtUtc);
        Assert.Null(refreshedUser.LastFailedLoginAtUtc);
    }

    [Fact]
    public async Task VerifyEmail_ConfirmsUser_AndMarksTokenAsUsed()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var controller = CreateController(context, emailSender: emailSender);

        await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "novo@finova.app",
            Password = "SenhaSegura123!"
        });

        var token = ExtractTokenFromUrl(emailSender.LastVerificationUrl);

        var result = await controller.VerifyEmail(new VerifyEmailRequest
        {
            Token = token
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var user = await context.Users.SingleAsync();
        var verificationToken = await context.EmailVerificationTokens.SingleAsync();

        Assert.True(user.EmailConfirmed);
        Assert.NotNull(verificationToken.UsedAtUtc);
        Assert.Contains(context.AuditLogs, log => log.Action == "auth.email-confirmed" && log.UserId == user.Id);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task ResendEmailVerification_PreservesPreviousToken_WhenEmailFails()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var controller = CreateController(context, emailSender: emailSender);

        await controller.Register(new RegisterRequest
        {
            Name = "Novo Usuário",
            Email = "novo@finova.app",
            Password = "SenhaSegura123!"
        });

        var previousToken = await context.EmailVerificationTokens.SingleAsync();
        emailSender.ThrowOnVerification = true;

        var result = await controller.ResendEmailVerification(new ResendEmailVerificationRequest
        {
            Email = "novo@finova.app"
        });

        Assert.IsType<OkObjectResult>(result);
        var remainingToken = await context.EmailVerificationTokens.SingleAsync();
        Assert.Equal(previousToken.Id, remainingToken.Id);
        Assert.Null(remainingToken.UsedAtUtc);
    }

    [Fact]
    public async Task ForgotPassword_PersistsResetToken_AndReturnsUrl_WhenExposureIsEnabled()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var controller = CreateController(
            context,
            emailSender: emailSender,
            configurationValues: new Dictionary<string, string?>
            {
                ["Client:BaseUrl"] = "https://finova.example",
                ["PasswordReset:ExposeResetUrlInResponse"] = "true"
            });

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var result = await controller.ForgotPassword(new ForgotPasswordRequest
        {
            Email = user.Email
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<ForgotPasswordResponse>(ok.Value);
        var token = ExtractTokenFromUrl(payload.ResetUrl);

        Assert.NotNull(payload.ResetUrl);
        Assert.Contains("reset-password?token=", payload.ResetUrl);
        Assert.Single(context.PasswordResetTokens);
        Assert.Equal(payload.ResetUrl, emailSender.LastResetUrl);
        Assert.False(string.IsNullOrWhiteSpace(token));
    }

    [Fact]
    public async Task ForgotPassword_PreservesPreviousToken_WhenEmailFailsInProduction()
    {
        using var context = CreateContext();
        var emailSender = new FakeEmailSender();
        var controller = CreateController(
            context,
            emailSender: emailSender,
            environmentName: "Production",
            configurationValues: new Dictionary<string, string?>
            {
                ["Client:BaseUrl"] = "https://finova.example",
                ["PasswordReset:ExposeResetUrlInResponse"] = "false"
            });

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        await controller.ForgotPassword(new ForgotPasswordRequest { Email = user.Email });
        var previousToken = await context.PasswordResetTokens.SingleAsync();

        emailSender.ThrowOnPasswordReset = true;
        await controller.ForgotPassword(new ForgotPasswordRequest { Email = user.Email });

        var remainingToken = await context.PasswordResetTokens.SingleAsync();
        Assert.Equal(previousToken.Id, remainingToken.Id);
        Assert.Null(remainingToken.UsedAtUtc);
    }

    [Fact]
    public async Task ResetPassword_UpdatesPassword_AndMarksTokenAsUsed()
    {
        using var context = CreateContext();
        var controller = CreateController(
            context,
            configurationValues: new Dictionary<string, string?>
            {
                ["Client:BaseUrl"] = "https://finova.example",
                ["PasswordReset:ExposeResetUrlInResponse"] = "true"
            });

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var forgot = await controller.ForgotPassword(new ForgotPasswordRequest
        {
            Email = user.Email
        });

        var forgotOk = Assert.IsType<OkObjectResult>(forgot.Result);
        var forgotPayload = Assert.IsType<ForgotPasswordResponse>(forgotOk.Value);
        var rawToken = ExtractTokenFromUrl(forgotPayload.ResetUrl);

        var resetResult = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = rawToken,
            NewPassword = "NovaSenha456!"
        });

        var ok = Assert.IsType<OkObjectResult>(resetResult);
        var tokenEntity = await context.PasswordResetTokens.SingleAsync();
        var refreshedUser = await context.Users.SingleAsync();

        Assert.NotNull(tokenEntity.UsedAtUtc);
        Assert.Equal(2, refreshedUser.SessionVersion);
        Assert.True(CreatePasswordHasher().VerifyPassword(refreshedUser, "NovaSenha456!"));
        Assert.False(CreatePasswordHasher().VerifyPassword(refreshedUser, "SenhaSegura123!"));
        Assert.Contains(
            $"{AuthCookieService.CookieName}=",
            controller.Response.Headers.SetCookie.ToString());
        Assert.Contains(
            "expires=",
            controller.Response.Headers.SetCookie.ToString(),
            StringComparison.OrdinalIgnoreCase);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task ResetPassword_ReturnsBadRequest_WhenPasswordIsTooWeak()
    {
        using var context = CreateContext();
        var controller = CreateController(
            context,
            configurationValues: new Dictionary<string, string?>
            {
                ["Client:BaseUrl"] = "https://finova.example",
                ["PasswordReset:ExposeResetUrlInResponse"] = "true"
            });

        var user = new User
        {
            Name = "Finova User",
            Email = "user@finova.app",
            EmailConfirmed = true,
        };
        user.PasswordHash = HashPassword("SenhaSegura123!", user);
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var forgot = await controller.ForgotPassword(new ForgotPasswordRequest
        {
            Email = user.Email
        });

        var forgotOk = Assert.IsType<OkObjectResult>(forgot.Result);
        var forgotPayload = Assert.IsType<ForgotPasswordResponse>(forgotOk.Value);
        var rawToken = ExtractTokenFromUrl(forgotPayload.ResetUrl);

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = rawToken,
            NewPassword = "12345678"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ProblemDetails>(badRequest.Value);

        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        Assert.Equal(PasswordPolicyService.DefaultMessage, problem.Title);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static AuthController CreateController(
        AppDbContext context,
        FakeEmailSender? emailSender = null,
        Dictionary<string, string?>? configurationValues = null,
        string environmentName = "Development")
    {
        var configData = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "FinovaJwtKey2026-Segura-Com-32-Bytes!",
            ["Jwt:Issuer"] = "FinanceDashboard",
            ["Jwt:Audience"] = "FinanceDashboard",
            ["Client:BaseUrl"] = "https://finova.example"
        };

        if (configurationValues is not null)
        {
            foreach (var item in configurationValues)
            {
                configData[item.Key] = item.Value;
            }
        }

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configData)
            .Build();

        var environment = new FakeWebHostEnvironment { EnvironmentName = environmentName };
        var controller = new AuthController(
            context,
            new AuditLogService(context, new HttpContextAccessor()),
            CreatePasswordHasher(),
            new PasswordPolicyService(),
            new JwTokenService(configuration),
            new AuthCookieService(environment),
            new PasswordResetTokenService(),
            emailSender ?? new FakeEmailSender(),
            configuration,
            environment,
            NullLogger<AuthController>.Instance);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        return controller;
    }

    private static PasswordHasher CreatePasswordHasher()
    {
        return new PasswordHasher(new Microsoft.AspNetCore.Identity.PasswordHasher<User>());
    }

    private static string HashPassword(string password, User? user = null)
    {
        var entity = user ?? new User { Email = "seed@finova.app", Name = "Seed", EmailConfirmed = true };
        return CreatePasswordHasher().HashPassword(entity, password);
    }

    private static string ExtractTokenFromUrl(string? url)
    {
        Assert.False(string.IsNullOrWhiteSpace(url));

        const string tokenKey = "token=";
        var index = url!.IndexOf(tokenKey, StringComparison.Ordinal);

        Assert.True(index >= 0, "URL should contain token query parameter.");

        return Uri.UnescapeDataString(url[(index + tokenKey.Length)..]);
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public string? LastResetUrl { get; private set; }
        public string? LastVerificationUrl { get; private set; }
        public bool ThrowOnPasswordReset { get; set; }
        public bool ThrowOnVerification { get; set; }

        public Task SendPasswordResetEmailAsync(string toEmail, string name, string resetUrl)
        {
            if (ThrowOnPasswordReset)
            {
                throw new InvalidOperationException("Falha SMTP simulada.");
            }

            LastResetUrl = resetUrl;
            return Task.CompletedTask;
        }

        public Task SendEmailVerificationAsync(string toEmail, string name, string verificationUrl)
        {
            if (ThrowOnVerification)
            {
                throw new InvalidOperationException("Falha SMTP simulada.");
            }

            LastVerificationUrl = verificationUrl;
            return Task.CompletedTask;
        }

        public Task SendBudgetGoalAlertEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount)
        {
            return Task.CompletedTask;
        }

        public Task SendMonthlySummaryEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            decimal incomeAmount,
            decimal expenseAmount,
            decimal balanceAmount,
            string? topExpenseCategory,
            decimal? topExpenseAmount,
            IReadOnlyList<FinanceDashboard.Api.Services.Notifications.MonthlyGoalSummary> goalSummaries)
        {
            return Task.CompletedTask;
        }
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
