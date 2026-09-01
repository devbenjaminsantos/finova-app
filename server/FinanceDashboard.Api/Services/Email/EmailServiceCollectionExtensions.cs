using FinanceDashboard.Api.Configuration;

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

            if (options.Enabled)
            {
                throw new InvalidOperationException(
                    $"O provedor de e-mail '{options.Provider}' ainda não está disponível. " +
                    "Mantenha Email__Enabled=false até a implementação do Resend.");
            }

            services.AddSingleton<IEmailSender, DisabledEmailSender>();
            return services;
        }
    }
}
