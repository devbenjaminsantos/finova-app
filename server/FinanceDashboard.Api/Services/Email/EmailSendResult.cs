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

        public static EmailSendResult Accepted(string? providerMessageId = null) =>
            new(EmailSendStatus.Accepted, providerMessageId);

        public static EmailSendResult Disabled() => new(EmailSendStatus.Disabled);
    }
}
