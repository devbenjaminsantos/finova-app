using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Data;

public enum FinovaDatabaseProvider
{
    SqlServer,
    PostgreSql
}

public static class DatabaseConfiguration
{
    public static IServiceCollection AddFinovaDatabase(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var provider = ResolveProvider(configuration["Database:Provider"]);
        var connectionString = GetRequiredConnectionString(configuration);

        services.AddDbContext<AppDbContext>(options =>
        {
            switch (provider)
            {
                case FinovaDatabaseProvider.SqlServer:
                    options.UseSqlServer(
                        connectionString,
                        sqlOptions => sqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(10),
                            errorNumbersToAdd: null));
                    break;

                case FinovaDatabaseProvider.PostgreSql:
                    options.UseNpgsql(
                        connectionString,
                        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(10),
                            errorCodesToAdd: null));
                    break;

                default:
                    throw new InvalidOperationException(
                        $"Provedor de banco não suportado: {provider}.");
            }
        });

        return services;
    }

    public static FinovaDatabaseProvider ResolveProvider(string? configuredProvider)
    {
        if (string.Equals(
                configuredProvider,
                nameof(FinovaDatabaseProvider.SqlServer),
                StringComparison.OrdinalIgnoreCase))
        {
            return FinovaDatabaseProvider.SqlServer;
        }

        if (string.Equals(
                configuredProvider,
                nameof(FinovaDatabaseProvider.PostgreSql),
                StringComparison.OrdinalIgnoreCase))
        {
            return FinovaDatabaseProvider.PostgreSql;
        }

        throw new InvalidOperationException(
            "Database:Provider deve ser SqlServer ou PostgreSql. " +
            "Em variáveis de ambiente, use Database__Provider.");
    }

    private static string GetRequiredConnectionString(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:Default não configurada. Defina a string de conexão " +
                "em appsettings.Development.local.json ou na variável " +
                "ConnectionStrings__Default.");
        }

        return connectionString;
    }
}
