using System.Net;
using FinanceDashboard.Api.Services.Security;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class RateLimitPartitionKeysTests
{
    [Fact]
    public void ByIp_UsesTheConnectionAddressAndIgnoresUntrustedForwardedForHeader()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.24");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.77";

        var key = RateLimitPartitionKeys.ByIp(context);

        Assert.Equal("198.51.100.24", key);
    }

    [Fact]
    public void ByIp_NormalizesAnIpv4MappedIpv6Address()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:198.51.100.24");

        var key = RateLimitPartitionKeys.ByIp(context);

        Assert.Equal("198.51.100.24", key);
    }

    [Fact]
    public void ByIpAndPath_UsesTheNormalizedPathToKeepAuthEndpointsIndependent()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.24");
        context.Request.Path = "/api/Auth/Login";

        var key = RateLimitPartitionKeys.ByIpAndPath(context);

        Assert.Equal("198.51.100.24:/api/auth/login", key);
    }
}
