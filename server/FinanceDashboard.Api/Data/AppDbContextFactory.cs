using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FinanceDashboard.Api.Data;

public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string LocalDesignTimeConnection =
        "Host=localhost;Port=54329;Database=hestia_migrations;" +
        "Username=hestia;Password=hestia_local_migrations";

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(
            "ConnectionStrings__Default");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                string.IsNullOrWhiteSpace(connectionString)
                    ? LocalDesignTimeConnection
                    : connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
