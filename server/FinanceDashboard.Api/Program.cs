using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Configuration;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.Auth;
using FinanceDashboard.Api.Services.BankSync;
using FinanceDashboard.Api.Services.BankSync.Pluggy;
using FinanceDashboard.Api.Services.CurrentUser;
using FinanceDashboard.Api.Services.Email;
using FinanceDashboard.Api.Services.PublicDashboard;
using FinanceDashboard.Api.Services.Recurring;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile(
    "appsettings.Development.local.json",
    optional: true,
    reloadOnChange: true);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        GetRequiredConnectionString(builder.Configuration),
        sqlOptions =>
        {
            // Azure SQL serverless pode falhar na primeira tentativa
            // enquanto o banco sai do estado pausado. O retry cobre
            // essas falhas transitórias sem exigir nova tentativa manual.
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null);
        }));

builder.Services.Configure<PluggyOptions>(
    builder.Configuration.GetSection(PluggyOptions.SectionName));
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.Configure<AzureCommunicationServicesEmailOptions>(
    builder.Configuration.GetSection(AzureCommunicationServicesEmailOptions.SectionName));
builder.Services.Configure<NotificationOptions>(
    builder.Configuration.GetSection(NotificationOptions.SectionName));
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<IPluggyClient, PluggyClient>((serviceProvider, client) =>
{
    var options = serviceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<PluggyOptions>>()
        .Value;

    client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/'));
});

builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<PasswordPolicyService>();
builder.Services.AddScoped<JwTokenService>();
builder.Services.AddScoped<PasswordResetTokenService>();
builder.Services.AddScoped<AuditLogService>();
builder.Services.AddScoped<BankSyncService>();
builder.Services.AddScoped<RecurringTransactionGenerationService>();
builder.Services.AddScoped<PublicDashboardTokenService>();
builder.Services.AddScoped<FinanceDashboard.Api.Services.Notifications.FinancialEmailAutomationService>();
builder.Services.AddScoped<IBankSyncProvider, PluggyBankSyncProvider>();
builder.Services.AddScoped<IBankSyncProvider, PlaceholderBankSyncProvider>();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<SmtpEmailSender>();
builder.Services.AddScoped<AzureCommunicationServicesEmailSender>();
builder.Services.AddScoped<IEmailSender>(serviceProvider =>
{
    var options = serviceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<EmailOptions>>()
        .Value;

    return string.Equals(options.Provider, "AzureCommunicationServices", StringComparison.OrdinalIgnoreCase)
        ? serviceProvider.GetRequiredService<AzureCommunicationServicesEmailSender>()
        : serviceProvider.GetRequiredService<SmtpEmailSender>();
});
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHostedService<FinanceDashboard.Api.Services.Notifications.FinancialEmailAutomationHostedService>();

var jwtKey = GetRequiredJwtKey(builder.Configuration);
var allowedOrigins = GetAllowedCorsOrigins(builder.Configuration);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
    };

    options.Events = new JwtBearerEvents
    {
        OnChallenge = async context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/problem+json";

            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Sessão expirada ou token inválido."
            });
        },
        OnForbidden = async context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/problem+json";

            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Você não tem permissão para acessar este recurso."
            });
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddAuthorization();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var app = builder.Build();

LogEmailConfigurationStatus(app);

app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        if (exception is not null)
        {
            app.Logger.LogError(exception, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);
        }

        var statusCode = exception switch
        {
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            BadHttpRequestException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = statusCode switch
            {
                StatusCodes.Status401Unauthorized => "Acesso não autorizado.",
                StatusCodes.Status400BadRequest => "Requisição inválida.",
                _ => "Ocorreu um erro inesperado."
            }
        };

        if (app.Environment.IsDevelopment() && exception is not null)
        {
            problemDetails.Detail = exception.Message;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsJsonAsync(problemDetails);
    });
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.Title = "FinanceDashboard API";
        options.AddHttpAuthentication("Bearer", auth =>
        {
            auth.Token = string.Empty;
        });
    });
}

app.UseCors("frontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.Run();

static void LogEmailConfigurationStatus(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("EmailConfiguration");
    var provider = app.Configuration["Email:Provider"] ?? "Smtp";

    logger.LogInformation("Provedor de e-mail configurado: {Provider}.", provider);

    if (string.Equals(provider, "AzureCommunicationServices", StringComparison.OrdinalIgnoreCase))
    {
        var connectionString = app.Configuration["AzureCommunicationServices:Email:ConnectionString"];
        var senderAddress = app.Configuration["AzureCommunicationServices:Email:SenderAddress"];

        if (string.IsNullOrWhiteSpace(connectionString) || string.IsNullOrWhiteSpace(senderAddress))
        {
            logger.LogWarning(
                "Azure Communication Services Email incompleto. Verifique AzureCommunicationServices__Email__ConnectionString e AzureCommunicationServices__Email__SenderAddress.");
        }

        return;
    }

    var smtpHost = app.Configuration["Smtp:Host"];
    var smtpFromEmail = app.Configuration["Smtp:FromEmail"];

    if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpFromEmail))
    {
        logger.LogWarning(
            "SMTP incompleto. Como Email__Provider não está definido como AzureCommunicationServices, a API tentará usar SMTP. Verifique Smtp__Host e Smtp__FromEmail.");
    }
}

static string GetRequiredConnectionString(IConfiguration configuration)
{
    var connectionString = configuration.GetConnectionString("Default");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:Default não configurada. Defina a string de conexão em appsettings.Development.local.json ou na variável ConnectionStrings__Default.");
    }

    return connectionString;
}

static string GetRequiredJwtKey(IConfiguration configuration)
{
    var jwtKey = configuration["Jwt:Key"];

    if (string.IsNullOrWhiteSpace(jwtKey))
    {
        throw new InvalidOperationException(
            "Jwt:Key não configurada. Defina a chave em appsettings.Development.local.json ou na variável Jwt__Key.");
    }

    return jwtKey;
}

static string[] GetAllowedCorsOrigins(IConfiguration configuration)
{
    var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();

    if (allowedOrigins is null || allowedOrigins.Length == 0)
    {
        throw new InvalidOperationException(
            "Cors:AllowedOrigins não configurado. Defina pelo menos uma origem permitida para o frontend.");
    }

    return allowedOrigins;
}
