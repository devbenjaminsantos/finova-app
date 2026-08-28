using System.Net;

namespace FinanceDashboard.Api.Services.Security;

public static class RateLimitPolicyNames
{
    public const string Auth = "auth";
    public const string Demo = "demo";
}

public static class RateLimitPartitionKeys
{
    public static string ByIp(HttpContext httpContext)
    {
        var remoteIpAddress = httpContext.Connection.RemoteIpAddress;

        if (remoteIpAddress is null)
        {
            return "unknown";
        }

        return remoteIpAddress.IsIPv4MappedToIPv6
            ? remoteIpAddress.MapToIPv4().ToString()
            : remoteIpAddress.ToString();
    }

    public static string ByIpAndPath(HttpContext httpContext)
    {
        var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? "/";
        return $"{ByIp(httpContext)}:{path}";
    }
}
