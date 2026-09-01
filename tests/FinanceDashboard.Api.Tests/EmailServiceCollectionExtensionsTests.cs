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
    public void AddHestiaEmail_RejectsActivation_BeforeResendIsImplemented()
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

        Assert.Contains("Email__Enabled=false", exception.Message, StringComparison.Ordinal);
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
