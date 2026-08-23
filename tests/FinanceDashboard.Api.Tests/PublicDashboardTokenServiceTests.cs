using FinanceDashboard.Api.Services.PublicDashboard;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class PublicDashboardTokenServiceTests
{
    [Fact]
    public void GenerateToken_CreatesDistinctRandomTokensWithStableHashes()
    {
        var service = new PublicDashboardTokenService();

        var firstToken = service.GenerateToken();
        var secondToken = service.GenerateToken();

        Assert.NotEqual(firstToken, secondToken);
        Assert.True(service.TryHashToken(firstToken, out var firstHash));
        Assert.True(service.TryHashToken(firstToken, out var repeatedHash));
        Assert.True(service.TryHashToken(secondToken, out var secondHash));
        Assert.Equal(firstHash, repeatedHash);
        Assert.NotEqual(firstHash, secondHash);
        Assert.Equal(64, firstHash.Length);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-valid-token")]
    [InlineData("AQ")]
    public void TryHashToken_RejectsMalformedTokens(string? token)
    {
        var service = new PublicDashboardTokenService();

        var valid = service.TryHashToken(token, out var tokenHash);

        Assert.False(valid);
        Assert.Empty(tokenHash);
    }
}
