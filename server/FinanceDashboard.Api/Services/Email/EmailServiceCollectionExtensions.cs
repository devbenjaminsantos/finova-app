using FinanceDashboard.Api.Configuration;
using System.Net.Mail;

namespace FinanceDashboard.Api.Services.Email
{
    public static class EmailServiceCollectionExtensions
    {
        public static IServiceCollection AddHestiaEmail(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var section = configuration.GetSection(EmailOptions.SectionName);
            var options = section.Get<EmailOptions>() ?? new EmailOptions();

            services.Configure<EmailOptions>(section);

            if (!options.Enabled)
            {
                services.AddSingleton<IEmailSender, DisabledEmailSender>();
                return services;
            }

            if (!string.Equals(options.Provider, "Resend", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Email__Provider não suportado: '{options.Provider}'. Use Resend.");
            }

            var resendSection = configuration.GetSection(ResendOptions.SectionName);
            var resendOptions = resendSection.Get<ResendOptions>() ?? new ResendOptions();
            ValidateResendOptions(resendOptions);

            services.Configure<ResendOptions>(resendSection);
            services.AddHttpClient<ResendEmailSender>(client =>
            {
                client.BaseAddress = new Uri("https://api.resend.com/");
                client.Timeout = TimeSpan.FromSeconds(resendOptions.TimeoutSeconds);
            });
            services.AddScoped<IEmailSender>(serviceProvider =>
                serviceProvider.GetRequiredService<ResendEmailSender>());
            return services;
        }

        private static void ValidateResendOptions(ResendOptions options)
        {
            if (string.IsNullOrWhiteSpace(options.ApiKey)
                || string.IsNullOrWhiteSpace(options.FromEmail))
            {
                throw new InvalidOperationException(
                    "Resend incompleto. Verifique Resend__ApiKey e Resend__FromEmail.");
            }

            if (!options.ApiKey.StartsWith("re_", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Resend__ApiKey possui formato inválido.");
            }

            try
            {
                _ = new MailAddress(options.FromEmail, options.FromName);
            }
            catch (FormatException exception)
            {
                throw new InvalidOperationException("Resend__FromEmail possui formato inválido.", exception);
            }

            if (options.TimeoutSeconds is < 1 or > ResendOptions.MaximumTimeoutSeconds)
            {
                throw new InvalidOperationException(
                    $"Resend__TimeoutSeconds deve estar entre 1 e {ResendOptions.MaximumTimeoutSeconds}.");
            }
        }
    }
}
