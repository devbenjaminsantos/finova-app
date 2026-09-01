namespace FinanceDashboard.Api.Services.Email
{
    public enum EmailSendStatus
    {
        Accepted,
        Disabled,
        Pending,
        Rejected
    }

    public sealed record EmailSendResult(
        EmailSendStatus Status,
        string? ProviderMessageId = null,
        string? FailureCode = null)
    {
        public bool IsAccepted => Status == EmailSendStatus.Accepted;
        public bool IsPending => Status == EmailSendStatus.Pending;

        public static EmailSendResult Accepted(string? providerMessageId = null) =>
            new(EmailSendStatus.Accepted, providerMessageId);

        public static EmailSendResult Disabled() => new(EmailSendStatus.Disabled);

        public static EmailSendResult Pending(string failureCode) =>
            new(EmailSendStatus.Pending, FailureCode: failureCode);

        public static EmailSendResult Rejected(string failureCode) =>
            new(EmailSendStatus.Rejected, FailureCode: failureCode);
    }
}
