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
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;
using System.Threading.RateLimiting;

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
builder.Services.AddScoped<AuthCookieService>();
builder.Services.AddScoped<CookieAntiforgeryFilter>();
builder.Services.AddScoped<SessionValidationService>();
builder.Services.AddScoped<PasswordResetTokenService>();
builder.Services.AddScoped<AuditLogService>();
builder.Services.AddScoped<BankSyncService>();
builder.Services.AddScoped<RecurringTransactionGenerationService>();
builder.Services.AddScoped<PublicDashboardTokenService>();
builder.Services.AddScoped<FinanceDashboard.Api.Services.Notifications.FinancialEmailAutomationService>();
builder.Services.AddScoped<IBankSyncProvider, PluggyBankSyncProvider>();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHostedService<FinanceDashboard.Api.Services.Notifications.FinancialEmailAutomationHostedService>();

var jwtKey = GetRequiredJwtKey(builder.Configuration);
var allowedOrigins = GetAllowedCorsOrigins(builder.Configuration);
_ = GetRequiredClientBaseUrl(builder.Configuration);

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
        OnMessageReceived = context =>
        {
            if (string.IsNullOrWhiteSpace(context.Token) &&
                context.Request.Cookies.TryGetValue(AuthCookieService.CookieName, out var cookieToken))
            {
                context.Token = cookieToken;
            }

            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var sessionValidator = context.HttpContext.RequestServices
                .GetRequiredService<SessionValidationService>();

            if (context.Principal is null ||
                !await sessionValidator.IsCurrentAsync(
                    context.Principal,
                    context.HttpContext.RequestAborted))
            {
                context.Fail("Sessão revogada.");
            }
        },
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
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddAntiforgery(options =>
{
    var isDevelopment = builder.Environment.IsDevelopment();
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "finova_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
    options.Cookie.SecurePolicy = isDevelopment
        ? CookieSecurePolicy.None
        : CookieSecurePolicy.Always;
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Muitas solicitações. Aguarde um momento antes de tentar novamente."
        }, cancellationToken: cancellationToken);
    };

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"{httpContext.Connection.RemoteIpAddress}:{httpContext.Request.Path.Value?.ToLowerInvariant()}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 30,
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
});

builder.Services.AddControllers(options =>
{
    options.Filters.AddService<CookieAntiforgeryFilter>();
});
builder.Services.AddAuthorization();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var app = builder.Build();

ValidateSmtpConfiguration(app);

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

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.Use(async (context, next) =>
    {
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers.XFrameOptions = "DENY";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        context.Response.Headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
        await next();
    });
}

app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.Run();

static void ValidateSmtpConfiguration(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("EmailConfiguration");
    logger.LogInformation("Provedor de e-mail configurado: SMTP.");

    var smtpHost = app.Configuration["Smtp:Host"];
    var smtpFromEmail = app.Configuration["Smtp:FromEmail"];

    if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpFromEmail))
    {
        const string message = "SMTP incompleto. Verifique Smtp__Host e Smtp__FromEmail.";

        if (!app.Environment.IsDevelopment())
        {
            throw new InvalidOperationException(message);
        }

        logger.LogWarning(message);
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

static string GetRequiredClientBaseUrl(IConfiguration configuration)
{
    var clientBaseUrl = configuration["Client:BaseUrl"]?.TrimEnd('/');

    if (!Uri.TryCreate(clientBaseUrl, UriKind.Absolute, out var clientUri) ||
        clientUri.Scheme is not ("http" or "https"))
    {
        throw new InvalidOperationException(
            "Client:BaseUrl não configurada. Defina uma URL absoluta para o frontend.");
    }

    return clientBaseUrl;
}
