namespace FinanceDashboard.Api.Models
{
    public enum TransactionalEmailDeliveryStatus
    {
        Pending,
        Accepted,
        Rejected
    }

    public class TransactionalEmailDelivery
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int? EmailVerificationTokenId { get; set; }
        public int? PasswordResetTokenId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string IdempotencyKey { get; set; } = string.Empty;
        public string ProtectedToken { get; set; } = string.Empty;
        public TransactionalEmailDeliveryStatus Status { get; set; } = TransactionalEmailDeliveryStatus.Pending;
        public string? ProviderMessageId { get; set; }
        public string? FailureCode { get; set; }
        public int AttemptCount { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? LastAttemptAtUtc { get; set; }
        public DateTime? AcceptedAtUtc { get; set; }

        public User User { get; set; } = null!;
        public EmailVerificationToken? EmailVerificationToken { get; set; }
        public PasswordResetToken? PasswordResetToken { get; set; }
    }
}
