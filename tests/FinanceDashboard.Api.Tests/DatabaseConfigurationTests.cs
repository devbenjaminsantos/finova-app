using FinanceDashboard.Api.Data;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public sealed class DatabaseConfigurationTests
{
    [Fact]
    public void NormalizePostgreSqlConnectionString_ConvertsNeonUriWithoutLeakingIt()
    {
        var normalized = DatabaseConfiguration.NormalizePostgreSqlConnectionString(
            "postgresql://migrator:secret-value@ep-example.us-east-1.aws.neon.tech/hestia?sslmode=require&channel_binding=require");

        Assert.Contains("Host=ep-example.us-east-1.aws.neon.tech", normalized);
        Assert.Contains("Database=hestia", normalized);
        Assert.Contains("Username=migrator", normalized);
        Assert.Contains("Ssl Mode=Require", normalized);
        Assert.DoesNotContain("://", normalized);
    }

    [Fact]
    public void NormalizePostgreSqlConnectionString_RejectsMalformedUriWithoutEchoingIt()
    {
        var exception = Assert.Throws<InvalidOperationException>(() =>
            DatabaseConfiguration.NormalizePostgreSqlConnectionString("postgresql://migrator@invalid"));

        Assert.DoesNotContain("migrator", exception.Message, StringComparison.OrdinalIgnoreCase);
    }
}
