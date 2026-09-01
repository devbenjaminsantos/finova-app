using System.Security.Cryptography;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Auth;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services.Email
{
    public sealed record TransactionalEmailDeliveryAttempt(
        TransactionalEmailDelivery Delivery,
        EmailSendResult Result,
        string? Url);

    public sealed class TransactionalEmailDeliveryService
    {
        public const string EmailVerificationEventType = "email-verification";
        public const string PasswordResetEventType = "password-reset";

        private const string ProtectorPurpose = "Hestia.TransactionalEmailDelivery.v1";
        private readonly AppDbContext _context;
        private readonly IEmailSender _emailSender;
        private readonly PasswordResetTokenService _tokenUtility;
        private readonly IDataProtector _tokenProtector;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TransactionalEmailDeliveryService> _logger;

        public TransactionalEmailDeliveryService(
            AppDbContext context,
            IEmailSender emailSender,
            PasswordResetTokenService tokenUtility,
            IDataProtectionProvider dataProtectionProvider,
            IConfiguration configuration,
            ILogger<TransactionalEmailDeliveryService> logger)
        {
            _context = context;
            _emailSender = emailSender;
            _tokenUtility = tokenUtility;
            _tokenProtector = dataProtectionProvider.CreateProtector(ProtectorPurpose);
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<TransactionalEmailDeliveryAttempt> CreateAndSendEmailVerificationAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            var rawToken = _tokenUtility.GenerateToken();
            var now = DateTime.UtcNow;
            var token = new EmailVerificationToken
            {
                UserId = user.Id,
                TokenHash = _tokenUtility.HashToken(rawToken),
                CreatedAtUtc = now,
                ExpiresAtUtc = now.AddHours(24)
            };
            _context.EmailVerificationTokens.Add(token);
            await _context.SaveChangesAsync(cancellationToken);
            var delivery = CreateDelivery(
                user,
                rawToken,
                now,
                EmailVerificationEventType,
                $"{EmailVerificationEventType}/{token.Id}",
                emailVerificationToken: token);
            _context.TransactionalEmailDeliveries.Add(delivery);
            await _context.SaveChangesAsync(cancellationToken);

            return await SendAsync(delivery, user, rawToken, cancellationToken);
        }

        public async Task<TransactionalEmailDeliveryAttempt> CreateAndSendPasswordResetAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            var rawToken = _tokenUtility.GenerateToken();
            var now = DateTime.UtcNow;
            var token = new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = _tokenUtility.HashToken(rawToken),
                CreatedAtUtc = now,
                ExpiresAtUtc = now.AddMinutes(30)
            };
            _context.PasswordResetTokens.Add(token);
            await _context.SaveChangesAsync(cancellationToken);
            var delivery = CreateDelivery(
                user,
                rawToken,
                now,
                PasswordResetEventType,
                $"{PasswordResetEventType}/{token.Id}",
                passwordResetToken: token);
            _context.TransactionalEmailDeliveries.Add(delivery);
            await _context.SaveChangesAsync(cancellationToken);

            return await SendAsync(delivery, user, rawToken, cancellationToken);
        }

        public async Task<TransactionalEmailDeliveryAttempt?> RetryLatestPendingEmailVerificationAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var delivery = await _context.TransactionalEmailDeliveries
                .Include(item => item.EmailVerificationToken)
                .Where(item =>
                    item.UserId == user.Id &&
                    item.EventType == EmailVerificationEventType &&
                    item.Status == TransactionalEmailDeliveryStatus.Pending &&
                    item.EmailVerificationToken != null &&
                    item.EmailVerificationToken.UsedAtUtc == null &&
                    item.EmailVerificationToken.ExpiresAtUtc > now)
                .OrderByDescending(item => item.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            return delivery is null
                ? null
                : await RetryAsync(delivery, user, cancellationToken);
        }

        public async Task<TransactionalEmailDeliveryAttempt?> RetryLatestPendingPasswordResetAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var delivery = await _context.TransactionalEmailDeliveries
                .Include(item => item.PasswordResetToken)
                .Where(item =>
                    item.UserId == user.Id &&
                    item.EventType == PasswordResetEventType &&
                    item.Status == TransactionalEmailDeliveryStatus.Pending &&
                    item.PasswordResetToken != null &&
                    item.PasswordResetToken.UsedAtUtc == null &&
                    item.PasswordResetToken.ExpiresAtUtc > now)
                .OrderByDescending(item => item.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            return delivery is null
                ? null
                : await RetryAsync(delivery, user, cancellationToken);
        }

        public async Task DiscardAsync(
            TransactionalEmailDelivery delivery,
            CancellationToken cancellationToken = default)
        {
            if (delivery.EmailVerificationToken is not null)
            {
                _context.EmailVerificationTokens.Remove(delivery.EmailVerificationToken);
            }
            else if (delivery.PasswordResetToken is not null)
            {
                _context.PasswordResetTokens.Remove(delivery.PasswordResetToken);
            }

            _context.TransactionalEmailDeliveries.Remove(delivery);
            await _context.SaveChangesAsync(cancellationToken);
        }

        private TransactionalEmailDelivery CreateDelivery(
            User user,
            string rawToken,
            DateTime now,
            string eventType,
            string idempotencyKey,
            EmailVerificationToken? emailVerificationToken = null,
            PasswordResetToken? passwordResetToken = null)
        {
            return new TransactionalEmailDelivery
            {
                UserId = user.Id,
                EmailVerificationToken = emailVerificationToken,
                PasswordResetToken = passwordResetToken,
                EventType = eventType,
                IdempotencyKey = idempotencyKey,
                ProtectedToken = _tokenProtector.Protect(rawToken),
                CreatedAtUtc = now
            };
        }

        private async Task<TransactionalEmailDeliveryAttempt> RetryAsync(
            TransactionalEmailDelivery delivery,
            User user,
            CancellationToken cancellationToken)
        {
            string rawToken;

            try
            {
                rawToken = _tokenProtector.Unprotect(delivery.ProtectedToken);
            }
            catch (CryptographicException)
            {
                delivery.Status = TransactionalEmailDeliveryStatus.Rejected;
                delivery.FailureCode = "delivery_token_unavailable";
                delivery.LastAttemptAtUtc = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                return new TransactionalEmailDeliveryAttempt(
                    delivery,
                    EmailSendResult.Rejected(delivery.FailureCode),
                    null);
            }

            return await SendAsync(delivery, user, rawToken, cancellationToken);
        }

        private async Task<TransactionalEmailDeliveryAttempt> SendAsync(
            TransactionalEmailDelivery delivery,
            User user,
            string rawToken,
            CancellationToken cancellationToken)
        {
            var url = delivery.EventType == EmailVerificationEventType
                ? BuildClientUrl("verify-email", rawToken)
                : BuildClientUrl("reset-password", rawToken);
            EmailSendResult result;

            try
            {
                result = delivery.EventType == EmailVerificationEventType
                    ? await _emailSender.SendEmailVerificationAsync(
                        user.Email,
                        user.Name,
                        url,
                        delivery.IdempotencyKey,
                        cancellationToken)
                    : await _emailSender.SendPasswordResetEmailAsync(
                        user.Email,
                        user.Name,
                        url,
                        delivery.IdempotencyKey,
                        cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Não foi possível solicitar entrega de e-mail para o evento {EmailEventType} e usuário {UserId}.",
                    delivery.EventType,
                    user.Id);
                result = EmailSendResult.Pending("provider_exception");
            }

            delivery.AttemptCount++;
            delivery.LastAttemptAtUtc = DateTime.UtcNow;
            delivery.ProviderMessageId = result.ProviderMessageId;
            delivery.FailureCode = result.FailureCode;
            delivery.Status = result.IsAccepted
                ? TransactionalEmailDeliveryStatus.Accepted
                : result.Status == EmailSendStatus.Rejected
                    ? TransactionalEmailDeliveryStatus.Rejected
                    : TransactionalEmailDeliveryStatus.Pending;
            delivery.AcceptedAtUtc = result.IsAccepted ? delivery.LastAttemptAtUtc : null;
            await _context.SaveChangesAsync(cancellationToken);

            return new TransactionalEmailDeliveryAttempt(delivery, result, url);
        }

        private string BuildClientUrl(string path, string rawToken)
        {
            var clientBaseUrl = _configuration["Client:BaseUrl"]?.TrimEnd('/');
            if (string.IsNullOrWhiteSpace(clientBaseUrl))
            {
                throw new InvalidOperationException("Client__BaseUrl não está configurado.");
            }

            return $"{clientBaseUrl}/{path}?token={Uri.EscapeDataString(rawToken)}";
        }
    }
}
