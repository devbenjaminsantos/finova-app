using FinanceDashboard.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
        Assert.Contains("SSL Mode=Require", normalized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("://", normalized);
    }

    [Fact]
    public void NormalizePostgreSqlConnectionString_RejectsMalformedUriWithoutEchoingIt()
    {
        var exception = Assert.Throws<InvalidOperationException>(() =>
            DatabaseConfiguration.NormalizePostgreSqlConnectionString("postgresql://migrator@invalid"));

        Assert.DoesNotContain("migrator", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void AddHestiaDatabase_AcceptsPostgreSqlUriForRuntimeConnections()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "PostgreSql",
                ["ConnectionStrings:Default"] =
                    "postgresql://app:secret-value@ep-example-pooler.us-east-1.aws.neon.tech/hestia?sslmode=require&channel_binding=require"
            })
            .Build();
        var services = new ServiceCollection();

        services.AddHestiaDatabase(configuration);

        using var provider = services.BuildServiceProvider();
        using var dbContext = provider.GetRequiredService<AppDbContext>();
        var normalized = dbContext.Database.GetConnectionString();

        Assert.Contains("Host=ep-example-pooler.us-east-1.aws.neon.tech", normalized);
        Assert.Contains("Username=app", normalized);
        Assert.DoesNotContain("://", normalized);
    }
}
