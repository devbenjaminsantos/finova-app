using FinanceDashboard.Api.Services.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class EmailServiceCollectionExtensionsTests
{
    [Fact]
    public void AddHestiaEmail_RegistersDisabledSender_WhenEmailIsDisabled()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:Enabled"] = "false",
                ["Email:Provider"] = "Resend"
            })
            .Build();
        var services = new ServiceCollection();

        services.AddHestiaEmail(configuration);

        using var provider = services.BuildServiceProvider();
        Assert.IsType<DisabledEmailSender>(provider.GetRequiredService<IEmailSender>());
    }

    [Fact]
    public void AddHestiaEmail_RegistersResendSender_WhenConfigurationIsComplete()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:Enabled"] = "true",
                ["Email:Provider"] = "Resend",
                ["Resend:ApiKey"] = "re_test_key_not_real",
                ["Resend:FromEmail"] = "mail@hestia.example",
                ["Resend:FromName"] = "Héstia",
                ["Resend:TimeoutSeconds"] = "8"
            })
            .Build();
        var services = new ServiceCollection();

        services.AddHestiaEmail(configuration);

        using var provider = services.BuildServiceProvider();
        Assert.IsType<ResendEmailSender>(provider.GetRequiredService<IEmailSender>());
    }

    [Fact]
    public void AddHestiaEmail_RejectsActivation_WhenResendConfigurationIsIncomplete()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:Enabled"] = "true",
                ["Email:Provider"] = "Resend"
            })
            .Build();
        var services = new ServiceCollection();

        var exception = Assert.Throws<InvalidOperationException>(
            () => services.AddHestiaEmail(configuration));

        Assert.Contains("Resend__ApiKey", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DisabledEmailSender_ReturnsDisabledWithoutPretendingDelivery()
    {
        var sender = new DisabledEmailSender();

        var result = await sender.SendEmailVerificationAsync(
            "user@hestia.local",
            "User",
            "https://hestia.example/verify-email?token=redacted",
            "email-verification/42",
            CancellationToken.None);

        Assert.Equal(EmailSendStatus.Disabled, result.Status);
        Assert.False(result.IsAccepted);
        Assert.Null(result.ProviderMessageId);
    }
}
