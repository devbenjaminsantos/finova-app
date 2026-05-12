using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.Email;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private const int MaxFailedLoginAttempts = 5;
        private static readonly TimeSpan LoginLockoutDuration = TimeSpan.FromMinutes(15);

        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly PasswordHasher _passwordHasher;
        private readonly PasswordPolicyService _passwordPolicyService;
        private readonly JwTokenService _tokenService;
        private readonly PasswordResetTokenService _tokenUtility;
        private readonly IEmailSender _emailSender;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            AppDbContext context,
            AuditLogService auditLogService,
            PasswordHasher passwordHasher,
            PasswordPolicyService passwordPolicyService,
            JwTokenService tokenService,
            PasswordResetTokenService tokenUtility,
            IEmailSender emailSender,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            ILogger<AuthController> logger)
        {
            _context = context;
            _auditLogService = auditLogService;
            _passwordHasher = passwordHasher;
            _passwordPolicyService = passwordPolicyService;
            _tokenService = tokenService;
            _tokenUtility = tokenUtility;
            _emailSender = emailSender;
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthUserResponse>> Register(RegisterRequest dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            var emailAlreadyExists = await _context.Users
                .AnyAsync(user => user.Email == normalizedEmail);

            if (emailAlreadyExists)
            {
                return Conflict(new ProblemDetails
                {
                    Title = "E-mail já cadastrado.",
                    Status = StatusCodes.Status409Conflict
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
                    Status = StatusCodes.Status400BadRequest
                });
            }

            user.PasswordHash = _passwordHasher.HashPassword(user, dto.Password);

            _context.Users.Add(user);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException exception) when (IsDuplicateEmailViolation(exception))
            {
                return Conflict(new ProblemDetails
                {
                    Title = "E-mail já cadastrado.",
                    Status = StatusCodes.Status409Conflict
                });
            }

            // Eu invalido links anteriores antes de gerar um novo.
            // Assim evito deixar vários links de confirmação ativos para a mesma conta.
            await InvalidateActiveEmailVerificationTokensAsync(user.Id);
            var verificationUrl = await CreateEmailVerificationTokenAsync(user);

            try
            {
                await _emailSender.SendEmailVerificationAsync(user.Email, user.Name, verificationUrl);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Não foi possível enviar o e-mail de confirmação.");
            }

            await _auditLogService.WriteAsync(
                action: "auth.registered",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Conta criada e aguardando confirmação de e-mail.");

            return StatusCode(StatusCodes.Status201Created, ToAuthUserResponse(user));
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
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
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
                    Status = StatusCodes.Status429TooManyRequests
                });
            }

            if (!user.EmailConfirmed)
            {
                // O bloqueio por e-mail não confirmado vem antes da senha
                // porque a regra de acesso aqui depende primeiro da conta estar validada.
                await _auditLogService.WriteAsync(
                    action: "auth.login-blocked-unconfirmed-email",
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    userId: user.Id,
                    summary: "Tentativa de login bloqueada por e-mail não confirmado.");

                return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails
                {
                    Title = "Confirme seu e-mail antes de entrar.",
                    Status = StatusCodes.Status403Forbidden
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

                return Unauthorized(new ProblemDetails
                {
                    Title = user.LockoutEndsAtUtc is not null && user.LockoutEndsAtUtc > now
                        ? "Senha incorreta. A conta foi bloqueada temporariamente por segurança."
                        : "Senha incorreta.",
                    Status = StatusCodes.Status401Unauthorized
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

            return Ok(ToAuthResponse(user));
        }

        [HttpPost("demo-login")]
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

            var demoEmail = _configuration["Demo:Email"] ?? "demo@finova.app";
            var normalizedEmail = demoEmail.Trim().ToLowerInvariant();

            var user = await _context.Users
                .Include(existing => existing.Transactions)
                .FirstOrDefaultAsync(existing => existing.Email == normalizedEmail);

            if (user is null)
            {
                user = new User
                {
                    Name = "Conta Demo",
                    Email = normalizedEmail,
                    EmailConfirmed = true,
                    OnboardingOptIn = false
                };
                user.PasswordHash = _passwordHasher.HashPassword(
                    user,
                    _configuration["Demo:Password"] ?? "FinovaDemo@2026");

                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            if (!user.Transactions.Any())
            {
                // A conta demo sé é populada quando estiver vazia.
                // Isso me deixa reutilizar o mesmo usuário sem duplicar movimentações.
                SeedDemoTransactions(user.Id);
                await _context.SaveChangesAsync();
            }

            await _auditLogService.WriteAsync(
                action: "auth.demo-login",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Acesso via conta demonstração.");

            return Ok(ToAuthResponse(user));
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

            await InvalidateActiveEmailVerificationTokensAsync(user.Id);
            var verificationUrl = await CreateEmailVerificationTokenAsync(user);

            try
            {
                await _emailSender.SendEmailVerificationAsync(user.Email, user.Name, verificationUrl);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Não foi possível reenviar o e-mail de confirmação.");
            }

            await _auditLogService.WriteAsync(
                action: "auth.verification-resent",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Novo e-mail de confirmação enviado.");

            return Ok(new
            {
                message = "Se a conta existir e ainda não estiver confirmada, enviaremos um novo link."
            });
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
                    Status = StatusCodes.Status400BadRequest
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

            var now = DateTime.UtcNow;
            var activeTokens = await _context.PasswordResetTokens
                .Where(token => token.UserId == user.Id && token.UsedAtUtc == null && token.ExpiresAtUtc > now)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.UsedAtUtc = now;
            }

            // Sempre invalido tokens ativos antes de criar outro.
            // Isso reduz confusão com links antigos ainda no e-mail do usuário.
            var rawToken = _tokenUtility.GenerateToken();
            var resetToken = new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = _tokenUtility.HashToken(rawToken),
                CreatedAtUtc = now,
                ExpiresAtUtc = now.AddMinutes(30)
            };

            _context.PasswordResetTokens.Add(resetToken);
            await _context.SaveChangesAsync();

            var resetUrl = BuildResetUrl(rawToken);

            try
            {
                await _emailSender.SendPasswordResetEmailAsync(user.Email, user.Name, resetUrl);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Não foi possível enviar e-mail de redefinição de senha.");
            }

            await _auditLogService.WriteAsync(
                action: "auth.password-reset-requested",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Solicitação de redefinição de senha registrada.");

            if (_environment.IsDevelopment() || _configuration.GetValue("PasswordReset:ExposeResetUrlInResponse", false))
            {
                response.ResetUrl = resetUrl;
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
                    Status = StatusCodes.Status400BadRequest
                });
            }

            if (!_passwordPolicyService.IsValid(dto.NewPassword))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = PasswordPolicyService.DefaultMessage,
                    Status = StatusCodes.Status400BadRequest
                });
            }

            resetToken.User.PasswordHash = _passwordHasher.HashPassword(resetToken.User, dto.NewPassword);
            resetToken.UsedAtUtc = now;

            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: "auth.password-reset-completed",
                entityType: "User",
                entityId: resetToken.User.Id.ToString(),
                userId: resetToken.User.Id,
                summary: "Senha redefinida com sucesso.");

            return Ok(new { message = "Senha redefinida com sucesso." });
        }

        private AuthResponse ToAuthResponse(User user)
        {
            return new AuthResponse
            {
                Token = _tokenService.GenerateToken(user),
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
            var demoEmail = (_configuration["Demo:Email"] ?? "demo@finova.app").Trim().ToLowerInvariant();
            return user.Email == demoEmail;
        }

        private static bool IsDuplicateEmailViolation(DbUpdateException exception)
        {
            return exception.InnerException is SqlException { Number: 2601 or 2627 };
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

        private async Task<string> CreateEmailVerificationTokenAsync(User user)
        {
            var now = DateTime.UtcNow;
            var rawToken = _tokenUtility.GenerateToken();

            _context.EmailVerificationTokens.Add(new EmailVerificationToken
            {
                UserId = user.Id,
                TokenHash = _tokenUtility.HashToken(rawToken),
                CreatedAtUtc = now,
                ExpiresAtUtc = now.AddHours(24)
            });

            await _context.SaveChangesAsync();

            return BuildEmailVerificationUrl(rawToken);
        }

        private async Task InvalidateActiveEmailVerificationTokensAsync(int userId)
        {
            var now = DateTime.UtcNow;

            var activeTokens = await _context.EmailVerificationTokens
                .Where(token => token.UserId == userId && token.UsedAtUtc == null && token.ExpiresAtUtc > now)
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

        private string BuildResetUrl(string token)
        {
            return $"{ResolveClientBaseUrl()}/reset-password?token={Uri.EscapeDataString(token)}";
        }

        private string BuildEmailVerificationUrl(string token)
        {
            return $"{ResolveClientBaseUrl()}/verify-email?token={Uri.EscapeDataString(token)}";
        }

        private string ResolveClientBaseUrl()
        {
            var configuredBaseUrl = _configuration["Client:BaseUrl"]?.TrimEnd('/');
            var requestOrigin = Request.Headers.Origin.FirstOrDefault()?.TrimEnd('/');

            // Primeiro tento a URL oficial configurada no ambiente.
            // Sem ela, aproveito a origem da requisição e, por último, uso localhost.
            return !string.IsNullOrWhiteSpace(configuredBaseUrl)
                ? configuredBaseUrl
                : requestOrigin ?? "http://localhost:5173";
        }

        private void SeedDemoTransactions(int userId)
        {
            var today = DateTime.UtcNow.Date;

            // Estes dados foram pensados para preencher dashboard,
            // categorias, filtros e exportações já no primeiro acesso da demo.
            _context.Transactions.AddRange(
                new Transaction
                {
                    UserId = userId,
                    Description = "Salário",
                    Category = "Receita fixa",
                    AmountCents = 720000,
                    Date = today.AddDays(-5),
                    Type = "income"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Mercado do mês",
                    Category = "Alimentação",
                    AmountCents = 86540,
                    Date = today.AddDays(-4),
                    Type = "expense"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Aluguel",
                    Category = "Moradia",
                    AmountCents = 180000,
                    Date = today.AddDays(-3),
                    Type = "expense"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Freelance",
                    Category = "Receita extra",
                    AmountCents = 125000,
                    Date = today.AddDays(-2),
                    Type = "income"
                },
                new Transaction
                {
                    UserId = userId,
                    Description = "Assinaturas digitais",
                    Category = "Assinaturas",
                    AmountCents = 8990,
                    Date = today.AddDays(-1),
                    Type = "expense"
                });
        }
    }
}
