namespace FinanceDashboard.Api.Services.Demo
{
    public sealed class DemoAccountOptions
    {
        private const string DefaultEmail = "demo@hestia.local";

        public string Name { get; init; } = "Conta Demo";
        public string Email { get; init; } = DefaultEmail;
        public TimeSpan LockTimeout { get; init; } = TimeSpan.FromSeconds(15);
        public TimeSpan SessionLifetime { get; init; } = TimeSpan.FromHours(2);

        public static DemoAccountOptions FromConfiguration(IConfiguration configuration)
        {
            var email = (configuration["Demo:Email"] ?? DefaultEmail)
                .Trim()
                .ToLowerInvariant();

            if (!IsValidEmailTemplate(email))
            {
                throw new InvalidOperationException("Demo:Email precisa ser um endereço de e-mail válido.");
            }

            var configuredTimeout = configuration.GetValue<int?>("Demo:ResetLockTimeoutSeconds") ?? 15;
            var configuredLifetime = configuration.GetValue<int?>("Demo:SessionLifetimeHours") ?? 2;

            return new DemoAccountOptions
            {
                Name = string.IsNullOrWhiteSpace(configuration["Demo:Name"])
                    ? "Conta Demo"
                    : configuration["Demo:Name"]!.Trim(),
                Email = email,
                LockTimeout = TimeSpan.FromSeconds(Math.Clamp(configuredTimeout, 1, 60)),
                SessionLifetime = TimeSpan.FromHours(Math.Clamp(configuredLifetime, 1, 2))
            };
        }

        private static bool IsValidEmailTemplate(string email)
        {
            var separatorIndex = email.LastIndexOf('@');
            return separatorIndex > 0 &&
                separatorIndex < email.Length - 1 &&
                email.Length <= 220;
        }
    }
}
