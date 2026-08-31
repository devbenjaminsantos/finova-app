using FinanceDashboard.Api.Data;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class DatabaseConfigurationTests
{
    [Theory]
    [InlineData("SqlServer", HestiaDatabaseProvider.SqlServer)]
    [InlineData("sqlserver", HestiaDatabaseProvider.SqlServer)]
    [InlineData("PostgreSql", HestiaDatabaseProvider.PostgreSql)]
    [InlineData("postgresql", HestiaDatabaseProvider.PostgreSql)]
    public void ResolveProviderAcceptsSupportedNames(
        string configuredProvider,
        HestiaDatabaseProvider expected)
    {
        var provider = DatabaseConfiguration.ResolveProvider(configuredProvider);

        Assert.Equal(expected, provider);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1")]
    [InlineData("Postgres")]
    public void ResolveProviderRejectsMissingOrUnsupportedNames(string? configuredProvider)
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => DatabaseConfiguration.ResolveProvider(configuredProvider));

        Assert.Contains("SqlServer ou PostgreSql", exception.Message);
    }
}
