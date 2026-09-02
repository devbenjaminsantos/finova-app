using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FinanceDashboard.Api.Data;

public enum HestiaDatabaseProvider
{
    SqlServer,
    PostgreSql
}

public static class DatabaseConfiguration
{
    public static IServiceCollection AddHestiaDatabase(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var provider = ResolveProvider(configuration["Database:Provider"]);
        var configuredConnectionString = GetRequiredConnectionString(configuration);
        var connectionString = provider == HestiaDatabaseProvider.PostgreSql
            ? NormalizePostgreSqlConnectionString(configuredConnectionString)
            : configuredConnectionString;

        services.AddDbContext<AppDbContext>(options =>
        {
            switch (provider)
            {
                case HestiaDatabaseProvider.SqlServer:
                    options.UseSqlServer(
                        connectionString,
                        sqlOptions => sqlOptions.EnableRetryOnFailure(
                            maxRetryCount: 5,
                            maxRetryDelay: TimeSpan.FromSeconds(10),
                            errorNumbersToAdd: null));
                    break;

                case HestiaDatabaseProvider.PostgreSql:
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

    public static HestiaDatabaseProvider ResolveProvider(string? configuredProvider)
    {
        if (string.Equals(
                configuredProvider,
                nameof(HestiaDatabaseProvider.SqlServer),
                StringComparison.OrdinalIgnoreCase))
        {
            return HestiaDatabaseProvider.SqlServer;
        }

        if (string.Equals(
                configuredProvider,
                nameof(HestiaDatabaseProvider.PostgreSql),
                StringComparison.OrdinalIgnoreCase))
        {
            return HestiaDatabaseProvider.PostgreSql;
        }

        throw new InvalidOperationException(
            "Database:Provider deve ser SqlServer ou PostgreSql. " +
            "Em variáveis de ambiente, use Database__Provider.");
    }

    public static string NormalizePostgreSqlConnectionString(string connectionString)
    {
        var candidate = connectionString.Trim();

        if (!candidate.StartsWith("postgres", StringComparison.OrdinalIgnoreCase))
        {
            return candidate;
        }

        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("postgres" or "postgresql") ||
            string.IsNullOrWhiteSpace(uri.Host) ||
            string.IsNullOrWhiteSpace(uri.AbsolutePath.Trim('/')))
        {
            throw new InvalidOperationException(
                "A conexão do PostgreSQL precisa estar em um formato válido.");
        }

        var userInfoSeparator = uri.UserInfo.IndexOf(':');
        if (userInfoSeparator <= 0 || userInfoSeparator == uri.UserInfo.Length - 1)
        {
            throw new InvalidOperationException(
                "A conexão do PostgreSQL precisa informar usuário e senha.");
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/')),
            Username = Uri.UnescapeDataString(uri.UserInfo[..userInfoSeparator]),
            Password = Uri.UnescapeDataString(uri.UserInfo[(userInfoSeparator + 1)..])
        };

        foreach (var parameter in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separatorIndex = parameter.IndexOf('=');
            var name = Uri.UnescapeDataString(
                separatorIndex < 0 ? parameter : parameter[..separatorIndex]);
            var value = Uri.UnescapeDataString(
                separatorIndex < 0 ? string.Empty : parameter[(separatorIndex + 1)..]);

            switch (name.ToLowerInvariant())
            {
                case "sslmode":
                    builder["Ssl Mode"] = value;
                    break;
                case "channel_binding":
                    builder["Channel Binding"] = value;
                    break;
                case "application_name":
                    builder.ApplicationName = value;
                    break;
                case "connect_timeout":
                    if (!int.TryParse(value, out var timeout) || timeout < 0)
                    {
                        throw new InvalidOperationException(
                            "A conexão do PostgreSQL contém connect_timeout inválido.");
                    }

                    builder.Timeout = timeout;
                    break;
            }
        }

        return builder.ConnectionString;
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
