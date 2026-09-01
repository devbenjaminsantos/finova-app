using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.Email;
using FinanceDashboard.Api.Services.Demo;
using FinanceDashboard.Api.Services.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting(RateLimitPolicyNames.Auth)]
    public class AuthController : ControllerBase
    {
        private const int MaxFailedLoginAttempts = 5;
        private static readonly TimeSpan LoginLockoutDuration = TimeSpan.FromMinutes(15);

        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly PasswordHasher _passwordHasher;
        private readonly PasswordPolicyService _passwordPolicyService;
        private readonly JwTokenService _tokenService;
        private readonly AuthCookieService _authCookieService;
        private readonly PasswordResetTokenService _tokenUtility;
        private readonly TransactionalEmailDeliveryService _transactionalEmailDeliveryService;
        private readonly DemoAccountPreparationService _demoAccountPreparationService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            AppDbContext context,
            AuditLogService auditLogService,
            PasswordHasher passwordHasher,
            PasswordPolicyService passwordPolicyService,
            JwTokenService tokenService,
            AuthCookieService authCookieService,
            PasswordResetTokenService tokenUtility,
            TransactionalEmailDeliveryService transactionalEmailDeliveryService,
            DemoAccountPreparationService demoAccountPreparationService,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            ILogger<AuthController> logger)
        {
            _context = context;
            _auditLogService = auditLogService;
            _passwordHasher = passwordHasher;
            _passwordPolicyService = passwordPolicyService;
            _tokenService = tokenService;
            _authCookieService = authCookieService;
            _tokenUtility = tokenUtility;
            _transactionalEmailDeliveryService = transactionalEmailDeliveryService;
            _demoAccountPreparationService = demoAccountPreparationService;
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpGet("csrf-token")]
        public IActionResult GetCsrfToken([FromServices] IAntiforgery antiforgery)
        {
            var tokens = antiforgery.GetAndStoreTokens(HttpContext);
            return Ok(new { token = tokens.RequestToken });
        }

        [HttpPost("register")]
        public async Task<ActionResult<RegistrationResponse>> Register(RegisterRequest dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            var emailAlreadyExists = await _context.Users
                .AnyAsync(user => user.Email == normalizedEmail);

            if (emailAlreadyExists)
            {
                return Conflict(new ProblemDetails
                {
                    Title = "E-mail já cadastrado.",
                    Status = StatusCodes.Status409Conflict,
                    Extensions = { ["code"] = "EMAIL_ALREADY_REGISTERED" }
                });
            }

            var user = new User
            {
                Name = dto.Name.Trim(),
                Email = normalizedEmail,
                EmailConfirmed = false
            };

            if (!_passwordPolicyService.IsValid(dto.Password))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = PasswordPolicyService.DefaultMessage,
                    Status = StatusCodes.Status400BadRequest,
                    Extensions = { ["code"] = "PASSWORD_POLICY" }
                });
            }

            user.PasswordHash = _passwordHasher.HashPassword(user, dto.Password);

            _context.Users.Add(user);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException exception) when (
                DatabaseErrorClassifier.IsUniqueConstraintViolation(exception))
            {
                return Conflict(new ProblemDetails
                {
                    Title = "E-mail já cadastrado.",
                    Status = StatusCodes.Status409Conflict,
                    Extensions = { ["code"] = "EMAIL_ALREADY_REGISTERED" }
                });
            }

            var verificationAttempt = await _transactionalEmailDeliveryService
                .CreateAndSendEmailVerificationAsync(user, HttpContext.RequestAborted);
            var verificationSent = verificationAttempt.Result.IsAccepted;
            LogEmailSendResult(verificationAttempt.Result, "email-verification", user.Id);

            await _auditLogService.WriteAsync(
                action: "auth.registered",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: verificationSent
                    ? "Conta criada e e-mail de confirmação enviado."
                    : "Conta criada; envio do e-mail de confirmação pendente.");

            return StatusCode(StatusCodes.Status201Created, new RegistrationResponse
            {
                User = ToAuthUserResponse(user),
                VerificationEmailSent = verificationSent
            });
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login(LoginRequest dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
            var now = DateTime.UtcNow;

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Email == normalizedEmail);

            if (user is null)
            {
                return Unauthorized(InvalidCredentialsProblem());
            }

            if (user.LockoutEndsAtUtc is not null && user.LockoutEndsAtUtc <= now)
            {
                ResetLoginAttemptTracking(user);
                await _context.SaveChangesAsync();
            }

            if (IsUserLockedOut(user, now))
            {
                await _auditLogService.WriteAsync(
                    action: "auth.login-blocked-locked-out",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Tentativa de login bloqueada por excesso de tentativas inválidas.");

                return StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails
                {
                    Title = "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.",
                    Status = StatusCodes.Status429TooManyRequests,
                    Extensions = { ["code"] = "LOGIN_LOCKED" }
                });
            }

            if (!_passwordHasher.VerifyPassword(user, dto.Password))
            {
                RegisterFailedLoginAttempt(user, now);
                await _context.SaveChangesAsync();
                await _auditLogService.WriteAsync(
                    action: user.LockoutEndsAtUtc is not null && user.LockoutEndsAtUtc > now
                        ? "auth.login-locked-out"
                        : "auth.login-failed",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: user.LockoutEndsAtUtc is not null && user.LockoutEndsAtUtc > now
                        ? "Conta temporariamente bloqueada por excesso de senhas incorretas."
                        : "Tentativa de login com senha incorreta.");

                return Unauthorized(InvalidCredentialsProblem());
            }

            if (!user.EmailConfirmed)
            {
                await _auditLogService.WriteAsync(
                    action: "auth.login-blocked-unconfirmed-email",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Tentativa de login bloqueada por e-mail não confirmado.");

                return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails
                {
                    Title = "Confirme seu e-mail antes de entrar.",
                    Status = StatusCodes.Status403Forbidden,
                    Extensions = { ["code"] = "EMAIL_NOT_CONFIRMED" }
                });
            }

            ResetLoginAttemptTracking(user);
            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "auth.login-succeeded",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Login realizado com sucesso.");

            return Ok(CreateSession(user));
        }

        [HttpPost("demo-login")]
        [EnableRateLimiting(RateLimitPolicyNames.Demo)]
        public async Task<ActionResult<AuthResponse>> DemoLogin()
        {
            if (!_configuration.GetValue("Demo:Enabled", true))
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Conta demo indisponível.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            var options = DemoAccountOptions.FromConfiguration(_configuration);
            User user;

            try
            {
                user = await _demoAccountPreparationService.PrepareAsync(
                    options,
                    HttpContext.RequestAborted);
            }
            catch (DemoAccountPreparationUnavailableException exception)
            {
                _logger.LogWarning(exception, "A preparação da conta demo excedeu o tempo limite.");

                return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
                {
                    Title = "Conta demo temporariamente ocupada. Tente novamente em instantes.",
                    Status = StatusCodes.Status503ServiceUnavailable
                });
            }

            await _auditLogService.WriteAsync(
                action: "auth.demo-login",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Acesso via conta demonstração.");

            return Ok(CreateSession(user));
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            _authCookieService.Delete(Response);
            return NoContent();
        }

        [HttpPost("resend-email-verification")]
        public async Task<IActionResult> ResendEmailVerification(ResendEmailVerificationRequest dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Email == normalizedEmail);

            if (user is null || user.EmailConfirmed)
            {
                // A resposta é intencionalmente neutra para não revelar
                // se um e-mail existe ou não no sistema.
                return Ok(new
                {
                    message = "Se a conta existir e ainda não estiver confirmada, enviaremos um novo link."
                });
            }

            var retryAttempt = await _transactionalEmailDeliveryService
                .RetryLatestPendingEmailVerificationAsync(user, HttpContext.RequestAborted);

            if (retryAttempt is not null && retryAttempt.Result.IsAccepted)
            {
                await InvalidateActiveEmailVerificationTokensAsync(
                    user.Id,
                    retryAttempt.Delivery.EmailVerificationTokenId!.Value);
                await _auditLogService.WriteAsync(
                    action: "auth.verification-resent",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "E-mail de confirmação reenviado com o mesmo link pendente.");
                return NeutralResendVerificationResponse();
            }

            if (retryAttempt is not null && retryAttempt.Result.IsPending)
            {
                LogEmailSendResult(retryAttempt.Result, "email-verification", user.Id);
                await _auditLogService.WriteAsync(
                    action: "auth.verification-resend-pending",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Link existente reenviado; resultado da entrega ainda pendente.");
                return NeutralResendVerificationResponse();
            }

            var verificationAttempt = await _transactionalEmailDeliveryService
                .CreateAndSendEmailVerificationAsync(user, HttpContext.RequestAborted);
            LogEmailSendResult(verificationAttempt.Result, "email-verification", user.Id);

            if (verificationAttempt.Result.IsAccepted)
            {
                await InvalidateActiveEmailVerificationTokensAsync(
                    user.Id,
                    verificationAttempt.Delivery.EmailVerificationTokenId!.Value);
                await _auditLogService.WriteAsync(
                    action: "auth.verification-resent",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Novo e-mail de confirmação enviado.");
            }
            else if (verificationAttempt.Result.IsPending)
            {
                await _auditLogService.WriteAsync(
                    action: "auth.verification-resend-pending",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Novo link criado; resultado do envio de confirmação pendente.");
            }
            else
            {
                await _transactionalEmailDeliveryService.DiscardAsync(
                    verificationAttempt.Delivery,
                    HttpContext.RequestAborted);
            }

            return NeutralResendVerificationResponse();
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailRequest dto)
        {
            var tokenHash = _tokenUtility.HashToken(dto.Token);
            var now = DateTime.UtcNow;

            var verificationToken = await _context.EmailVerificationTokens
                .Include(token => token.User)
                .FirstOrDefaultAsync(token =>
                    token.TokenHash == tokenHash &&
                    token.UsedAtUtc == null &&
                    token.ExpiresAtUtc > now);

            if (verificationToken is null)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Link de confirmação inválido ou expirado.",
                    Status = StatusCodes.Status400BadRequest,
                    Extensions = { ["code"] = "INVALID_VERIFICATION_TOKEN" }
                });
            }

            verificationToken.User.EmailConfirmed = true;
            verificationToken.UsedAtUtc = now;
            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "auth.email-confirmed",
                entityType: "User",
                entityId: verificationToken.User.Id.ToString(),
                userId: verificationToken.User.Id,
                summary: "E-mail confirmado com sucesso.");

            return Ok(new
            {
                message = "E-mail confirmado com sucesso. Agora você já pode entrar."
            });
        }

        [HttpPost("forgot-password")]
        public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword(ForgotPasswordRequest dto)
        {
            var response = new ForgotPasswordResponse
            {
                Message = "Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição."
            };

            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Email == normalizedEmail);

            if (user is null)
            {
                // Mesmo princípio do reenvio de confirmação.
                // Não entrego pistas sobre quais e-mails estão cadastrados.
                return Ok(response);
            }

            var exposeResetUrl = _environment.IsDevelopment() ||
                _configuration.GetValue("PasswordReset:ExposeResetUrlInResponse", false);
            var resetAttempt = await _transactionalEmailDeliveryService
                .RetryLatestPendingPasswordResetAsync(user, HttpContext.RequestAborted)
                ?? await _transactionalEmailDeliveryService
                    .CreateAndSendPasswordResetAsync(user, HttpContext.RequestAborted);
            var resetEmailSent = resetAttempt.Result.IsAccepted;
            LogEmailSendResult(resetAttempt.Result, "password-reset", user.Id);

            if (resetAttempt.Result.IsPending)
            {
                await _auditLogService.WriteAsync(
                    action: "auth.password-reset-requested",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Solicitação de redefinição registrada; entrega do e-mail pendente.");
                return Ok(response);
            }

            if (resetEmailSent || exposeResetUrl)
            {
                await InvalidateActivePasswordResetTokensAsync(
                    user.Id,
                    resetAttempt.Delivery.PasswordResetTokenId!.Value);
            }
            else
            {
                await _transactionalEmailDeliveryService.DiscardAsync(
                    resetAttempt.Delivery,
                    HttpContext.RequestAborted);
            }

            await _auditLogService.WriteAsync(
                action: "auth.password-reset-requested",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: resetEmailSent
                    ? "Solicitação de redefinição de senha registrada e e-mail enviado."
                    : "Solicitação de redefinição de senha registrada; envio do e-mail não concluído.");

            if (exposeResetUrl)
            {
                response.ResetUrl = resetAttempt.Url;
            }

            return Ok(response);
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordRequest dto)
        {
            var tokenHash = _tokenUtility.HashToken(dto.Token);
            var now = DateTime.UtcNow;

            var resetToken = await _context.PasswordResetTokens
                .Include(token => token.User)
                .FirstOrDefaultAsync(token =>
                    token.TokenHash == tokenHash &&
                    token.UsedAtUtc == null &&
                    token.ExpiresAtUtc > now);

            if (resetToken is null)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Link de redefinição inválido ou expirado.",
                    Status = StatusCodes.Status400BadRequest,
                    Extensions = { ["code"] = "INVALID_RESET_TOKEN" }
                });
            }

            if (!_passwordPolicyService.IsValid(dto.NewPassword))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = PasswordPolicyService.DefaultMessage,
                    Status = StatusCodes.Status400BadRequest,
                    Extensions = { ["code"] = "PASSWORD_POLICY" }
                });
            }

            resetToken.User.PasswordHash = _passwordHasher.HashPassword(resetToken.User, dto.NewPassword);
            resetToken.User.SessionVersion += 1;
            resetToken.UsedAtUtc = now;

            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "auth.password-reset-completed",
                entityType: "User",
                entityId: resetToken.User.Id.ToString(),
                userId: resetToken.User.Id,
                summary: "Senha redefinida com sucesso.");

            _authCookieService.Delete(Response);

            return Ok(new { message = "Senha redefinida com sucesso." });
        }

        private AuthResponse CreateSession(User user)
        {
            _authCookieService.Write(Response, _tokenService.GenerateToken(user));

            return new AuthResponse
            {
                User = ToAuthUserResponse(user)
            };
        }

        private AuthUserResponse ToAuthUserResponse(User user)
        {
            return new AuthUserResponse
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                IsDemo = IsDemoUser(user),
                OnboardingOptIn = user.OnboardingOptIn,
                EmailGoalAlertsEnabled = user.EmailGoalAlertsEnabled,
                GoalAlertThresholdPercent = user.GoalAlertThresholdPercent,
                MonthlyReportEmailsEnabled = user.MonthlyReportEmailsEnabled,
                MonthlyReportDay = user.MonthlyReportDay,
                PublicDashboardEnabled = user.PublicDashboardEnabled
            };
        }

        private bool IsDemoUser(User user)
        {
            return user.IsDemoAccount;
        }

        private static bool IsUserLockedOut(User user, DateTime now)
        {
            return user.LockoutEndsAtUtc is not null && user.LockoutEndsAtUtc > now;
        }

        private static void RegisterFailedLoginAttempt(User user, DateTime now)
        {
            user.FailedLoginAttempts += 1;
            user.LastFailedLoginAtUtc = now;

            if (user.FailedLoginAttempts >= MaxFailedLoginAttempts)
            {
                user.LockoutEndsAtUtc = now.Add(LoginLockoutDuration);
            }
        }

        private static void ResetLoginAttemptTracking(User user)
        {
            user.FailedLoginAttempts = 0;
            user.LastFailedLoginAtUtc = null;
            user.LockoutEndsAtUtc = null;
        }

        private static ProblemDetails InvalidCredentialsProblem()
        {
            return new ProblemDetails
            {
                Title = "E-mail ou senha inválidos.",
                Status = StatusCodes.Status401Unauthorized,
                Extensions = { ["code"] = "INVALID_CREDENTIALS" }
            };
        }

        private async Task InvalidateActiveEmailVerificationTokensAsync(int userId, int exceptTokenId)
        {
            var now = DateTime.UtcNow;

            var activeTokens = await _context.EmailVerificationTokens
                .Where(token =>
                    token.UserId == userId &&
                    token.Id != exceptTokenId &&
                    token.UsedAtUtc == null &&
                    token.ExpiresAtUtc > now)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.UsedAtUtc = now;
            }

            if (activeTokens.Count > 0)
            {
                await _context.SaveChangesAsync();
            }
        }

        private async Task InvalidateActivePasswordResetTokensAsync(int userId, int exceptTokenId)
        {
            var now = DateTime.UtcNow;
            var activeTokens = await _context.PasswordResetTokens
                .Where(token =>
                    token.UserId == userId &&
                    token.Id != exceptTokenId &&
                    token.UsedAtUtc == null &&
                    token.ExpiresAtUtc > now)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.UsedAtUtc = now;
            }

            if (activeTokens.Count > 0)
            {
                await _context.SaveChangesAsync();
            }
        }

        private OkObjectResult NeutralResendVerificationResponse() => Ok(new
        {
            message = "Se a conta existir e ainda não estiver confirmada, enviaremos um novo link."
        });

        private void LogEmailSendResult(EmailSendResult result, string eventType, int userId)
        {
            if (result.IsAccepted || result.Status == EmailSendStatus.Disabled)
            {
                return;
            }

            _logger.LogWarning(
                "Solicitação de e-mail terminou com estado {EmailStatus}, código {FailureCode}, " +
                "evento {EmailEventType} e usuário {UserId}.",
                result.Status,
                result.FailureCode,
                eventType,
                userId);
        }

        private string ResolveClientBaseUrl()
        {
            var configuredBaseUrl = _configuration["Client:BaseUrl"]?.TrimEnd('/');

            if (Uri.TryCreate(configuredBaseUrl, UriKind.Absolute, out var configuredUri) &&
                configuredUri.Scheme is "http" or "https")
            {
                return configuredBaseUrl!;
            }

            if (!_environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Client:BaseUrl precisa ser uma URL absoluta configurada em produção.");
            }

            var requestOrigin = Request.Headers.Origin.FirstOrDefault()?.TrimEnd('/');
            return Uri.TryCreate(requestOrigin, UriKind.Absolute, out var originUri) &&
                   originUri.Scheme is "http" or "https"
                ? requestOrigin!
                : "http://localhost:5173";
        }

    }
}
