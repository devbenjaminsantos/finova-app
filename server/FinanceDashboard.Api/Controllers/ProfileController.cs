using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.DTOs.Profile;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.CurrentUser;
using FinanceDashboard.Api.Services.PublicDashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly CurrentUserService _currentUserService;
        private readonly PasswordHasher _passwordHasher;
        private readonly PasswordPolicyService _passwordPolicyService;
        private readonly JwTokenService _tokenService;
        private readonly AuthCookieService _authCookieService;
        private readonly IConfiguration _configuration;
        private readonly PublicDashboardTokenService _publicDashboardTokenService;

        public ProfileController(
            AppDbContext context,
            CurrentUserService currentUserService,
            PasswordHasher passwordHasher,
            PasswordPolicyService passwordPolicyService,
            JwTokenService tokenService,
            AuthCookieService authCookieService,
            AuditLogService auditLogService,
            IConfiguration configuration,
            PublicDashboardTokenService publicDashboardTokenService)
        {
            _context = context;
            _currentUserService = currentUserService;
            _passwordHasher = passwordHasher;
            _passwordPolicyService = passwordPolicyService;
            _tokenService = tokenService;
            _authCookieService = authCookieService;
            _auditLogService = auditLogService;
            _configuration = configuration;
            _publicDashboardTokenService = publicDashboardTokenService;
        }

        [HttpGet]
        public async Task<ActionResult<AuthUserResponse>> Get()
        {
            var userId = _currentUserService.GetRequiredUserId();

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            return Ok(ToAuthUserResponse(user));
        }

        [HttpGet("notification-deliveries")]
        public async Task<ActionResult<IReadOnlyList<NotificationDeliveryResponse>>> GetNotificationDeliveries()
        {
            var userId = _currentUserService.GetRequiredUserId();

            var deliveries = await _context.NotificationDeliveries
                .AsNoTracking()
                .Where(delivery => delivery.UserId == userId)
                .OrderByDescending(delivery => delivery.SentAtUtc)
                .Take(10)
                .Select(delivery => new NotificationDeliveryResponse
                {
                    Id = delivery.Id,
                    NotificationType = delivery.NotificationType,
                    Subject = delivery.Subject,
                    ReferenceKey = delivery.ReferenceKey,
                    SentAtUtc = delivery.SentAtUtc
                })
                .ToListAsync();

            return Ok(deliveries);
        }

        [HttpGet("public-dashboard")]
        public async Task<ActionResult<PublicDashboardSettingsResponse>> GetPublicDashboardSettings()
        {
            var userId = _currentUserService.GetRequiredUserId();

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            return Ok(ToPublicDashboardSettingsResponse(user));
        }

        [HttpPut("public-dashboard")]
        public async Task<ActionResult<PublicDashboardSettingsResponse>> UpdatePublicDashboardSettings(
            PublicDashboardSettingsRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            string? issuedToken = null;

            if (dto.Enabled)
            {
                if (!user.PublicDashboardEnabled || string.IsNullOrWhiteSpace(user.PublicDashboardTokenHash))
                {
                    issuedToken = IssuePublicDashboardToken(user);
                }

                user.PublicDashboardEnabled = true;
            }
            else
            {
                RevokePublicDashboard(user);
            }

            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: dto.Enabled
                    ? "profile.public-dashboard.enabled"
                    : "profile.public-dashboard.disabled",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: dto.Enabled
                    ? "Dashboard público ativado para leitura."
                    : "Dashboard público desativado.");

            return Ok(ToPublicDashboardSettingsResponse(user, issuedToken));
        }

        [HttpPost("public-dashboard/rotate")]
        public async Task<ActionResult<PublicDashboardSettingsResponse>> RotatePublicDashboardToken()
        {
            var userId = _currentUserService.GetRequiredUserId();
            var user = await _context.Users.FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            if (!user.PublicDashboardEnabled)
            {
                return Conflict(new ProblemDetails
                {
                    Title = "Ative o painel público antes de rotacionar o link.",
                    Status = StatusCodes.Status409Conflict
                });
            }

            var issuedToken = IssuePublicDashboardToken(user);
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "profile.public-dashboard.rotated",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Link do dashboard público rotacionado; links anteriores foram revogados.");

            return Ok(ToPublicDashboardSettingsResponse(user, issuedToken));
        }

        [HttpDelete("public-dashboard")]
        public async Task<ActionResult<PublicDashboardSettingsResponse>> RevokePublicDashboardToken()
        {
            var userId = _currentUserService.GetRequiredUserId();
            var user = await _context.Users.FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            RevokePublicDashboard(user);
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "profile.public-dashboard.revoked",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: "Link do dashboard público revogado.");

            return Ok(ToPublicDashboardSettingsResponse(user));
        }

        [HttpPut]
        public async Task<ActionResult<AuthUserResponse>> Update(ProfileUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            var name = dto.Name.Trim();

            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Informe um nome válido.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            if (dto.GoalAlertThresholdPercent is < 50 or > 100)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Escolha um percentual entre 50% e 100%.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            if (dto.MonthlyReportDay is < 1 or > 28)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Escolha um dia entre 1 e 28 para o resumo mensal.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            var wantsToChangePassword =
                !string.IsNullOrWhiteSpace(dto.CurrentPassword) ||
                !string.IsNullOrWhiteSpace(dto.NewPassword);
            var changedPassword = false;

            if (wantsToChangePassword)
            {
                if (string.IsNullOrWhiteSpace(dto.CurrentPassword))
                {
                    return BadRequest(new ProblemDetails
                    {
                        Title = "Informe sua senha atual.",
                        Status = StatusCodes.Status400BadRequest
                    });
                }

                if (!_passwordHasher.VerifyPassword(user, dto.CurrentPassword))
                {
                    return Unauthorized(new ProblemDetails
                    {
                        Title = "Senha atual incorreta.",
                        Status = StatusCodes.Status401Unauthorized
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.NewPassword))
                {
                    return BadRequest(new ProblemDetails
                    {
                        Title = "Informe uma nova senha.",
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

                user.PasswordHash = _passwordHasher.HashPassword(user, dto.NewPassword);
                user.SessionVersion += 1;
                changedPassword = true;
            }

            user.Name = name;
            user.EmailGoalAlertsEnabled = dto.EmailGoalAlertsEnabled;
            user.GoalAlertThresholdPercent = dto.GoalAlertThresholdPercent;
            user.MonthlyReportEmailsEnabled = dto.MonthlyReportEmailsEnabled;
            user.MonthlyReportDay = dto.MonthlyReportDay;

            await _context.SaveChangesAsync();
            await _auditLogService.WriteAsync(
                action: changedPassword ? "profile.updated-with-password" : "profile.updated",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: changedPassword
                    ? "Perfil atualizado com alteração de senha."
                    : BuildProfileSummary(dto));

            if (changedPassword)
            {
                _authCookieService.Write(Response, _tokenService.GenerateToken(user));
            }

            return Ok(ToAuthUserResponse(user));
        }

        [HttpPut("onboarding-preference")]
        public async Task<ActionResult<AuthUserResponse>> UpdateOnboardingPreference(
            OnboardingPreferenceUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            if (!dto.OnboardingOptIn.HasValue)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Informe uma escolha válida para o guia inicial.",
                    Status = StatusCodes.Status400BadRequest
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(existing => existing.Id == userId);

            if (user is null)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "Usuário não encontrado.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            user.OnboardingOptIn = dto.OnboardingOptIn.Value;
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "profile.onboarding-preference-updated",
                entityType: "User",
                entityId: user.Id.ToString(),
                userId: user.Id,
                summary: dto.OnboardingOptIn.Value
                    ? "Usuário optou por receber o guia inicial."
                    : "Usuário optou por ocultar o guia inicial.");

            return Ok(ToAuthUserResponse(user));
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

        private PublicDashboardSettingsResponse ToPublicDashboardSettingsResponse(
            User user,
            string? issuedToken = null)
        {
            return new PublicDashboardSettingsResponse
            {
                Enabled = user.PublicDashboardEnabled,
                HasActiveToken = user.PublicDashboardEnabled &&
                    !string.IsNullOrWhiteSpace(user.PublicDashboardTokenHash),
                PublicUrl = user.PublicDashboardEnabled && !string.IsNullOrWhiteSpace(issuedToken)
                    ? $"{GetClientBaseUrl().TrimEnd('/')}/compartilhado/{issuedToken}"
                    : null
            };
        }

        private string IssuePublicDashboardToken(User user)
        {
            var token = _publicDashboardTokenService.GenerateToken();
            if (!_publicDashboardTokenService.TryHashToken(token, out var tokenHash))
            {
                throw new InvalidOperationException("Não foi possível proteger o token do dashboard público.");
            }

            user.PublicDashboardTokenHash = tokenHash;
            return token;
        }

        private static void RevokePublicDashboard(User user)
        {
            user.PublicDashboardEnabled = false;
            user.PublicDashboardTokenHash = null;
        }

        private static string BuildProfileSummary(ProfileUpdateRequest dto)
        {
            var alertSummary = dto.EmailGoalAlertsEnabled
                ? $"Alertas de meta por e-mail configurados para {dto.GoalAlertThresholdPercent}%."
                : "Alertas de meta por e-mail desativados.";

            var monthlyReportSummary = dto.MonthlyReportEmailsEnabled
                ? $"Resumo mensal programado para o dia {dto.MonthlyReportDay}."
                : "Resumo mensal por e-mail desativado.";

            return $"Perfil atualizado. {alertSummary} {monthlyReportSummary}";
        }

        private bool IsDemoUser(User user)
        {
            return user.IsDemoAccount;
        }

        private string GetClientBaseUrl()
        {
            var clientBaseUrl = _configuration["Client:BaseUrl"]?.TrimEnd('/');

            if (!Uri.TryCreate(clientBaseUrl, UriKind.Absolute, out var clientUri) ||
                clientUri.Scheme is not ("http" or "https"))
            {
                throw new InvalidOperationException(
                    "Client:BaseUrl precisa ser uma URL absoluta configurada.");
            }

            return clientBaseUrl;
        }
    }
}
