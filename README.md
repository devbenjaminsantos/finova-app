# Finova

Finova is a full-stack personal finance application built to make day-to-day money management clearer, safer, and easier to inspect. It started as a finance dashboard and evolved into a SaaS-style product with authentication, demo access, transaction management, financial charts, budgets, recurring entries, account organization, exports, notifications, public read-only sharing, and deployment workflows targeting Azure.

Portuguese version: [README-pt-BR.md](README-pt-BR.md)

## Preview

| Home | Transactions |
| --- | --- |
| ![Finova home dashboard preview](media/inicio.png) | ![Finova transactions page preview](media/transacoes.png) |

| Analyses | Profile |
| --- | --- |
| ![Finova analyses page preview](media/analises.png) | ![Finova profile page preview](media/perfil.png) |

## What It Does

Finova helps users:

- create an account and sign in with JWT authentication protected by an `HttpOnly` cookie
- confirm email addresses during registration
- recover and reset passwords by email
- explore the product through a demo account
- create, edit, remove, filter, import, and export transactions
- track income, expenses, balance, categories, and tags
- manage financial accounts and account-scoped views
- define monthly budget goals, including category goals
- follow recurring entries and installment purchases
- review charts, comparisons, forecasts, and prescriptive insights
- receive goal alerts and monthly summaries by email
- share a public read-only dashboard link
- review relevant audit history for sensitive flows
- switch between light and dark themes

## Stack

### Frontend

- React 19
- Vite
- React Router
- Bootstrap 5
- Recharts
- i18next / react-i18next
- Vitest, Testing Library, Playwright

### Backend

- ASP.NET Core 10
- Entity Framework Core 10
- SQL Server
- JWT in an `HttpOnly` cookie, with Bearer support for external clients
- Scalar.AspNetCore
- SMTP email delivery behind an `IEmailSender` abstraction
- Pluggy backend foundation for future Open Finance flows

### Infrastructure

- Azure Static Web Apps
- Azure App Service
- Azure SQL Database
- GitHub Actions for validated frontend and API deployments

## Architecture At A Glance

```text
Finova/
|-- client/                          # React/Vite frontend
|-- server/
|   |-- FinanceDashboard.Api/        # ASP.NET Core API
|   |-- docker-compose.yml           # Local SQL Server
|   `-- .env.example                 # Local environment example
|-- tests/
|   `-- FinanceDashboard.Api.Tests/  # Backend test project
|-- docs/
|   |-- azure-deploy.md              # Azure deployment guide
|   |-- roadmap.md                   # Product and technical roadmap
|   |-- changelog.md                 # Delivery history by milestone
|   `-- architecture-decisions.md    # Design decisions and rationale
`-- finance-dashboard-react.sln
```

The frontend calls the API through `VITE_API_URL`. In production, this value must point to the App Service API URL, including `/api`.

## Deployment

The repository is prepared for this Azure architecture:

- Frontend: `Azure Static Web Apps`
- Backend: `Azure App Service`
- Database: `Azure SQL Database`

Deployment URLs are environment-specific and intentionally not hardcoded here. After a resource transfer or recreation, use the commands and post-deployment checklist in the [Azure deployment guide](docs/azure-deploy.md) before treating an environment as active.

The planned custom domain is `finovawallet`.

## Running Locally

### 1. Database

Create `server/.env` from `server/.env.example` and define:

```env
SA_PASSWORD=YourStrongPasswordHere
```

Start SQL Server:

```powershell
cd server
docker compose up -d
```

### 2. Backend

The API can be configured with environment variables or with a local Git-ignored file such as `appsettings.Development.local.json`.

Expected configuration:

- `ConnectionStrings__Default`
- `Jwt__Key`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Cors__AllowedOrigins__0`
- `Client__BaseUrl`
- `Notifications__Enabled`
- `Notifications__ProcessingIntervalMinutes`
- `Smtp__Host`
- `Smtp__Port`
- `Smtp__Username`
- `Smtp__Password`
- `Smtp__FromEmail`
- `Smtp__FromName`
- `Smtp__EnableSsl`
- `Demo__Enabled`
- `Demo__Name`
- `Demo__Email`
- `Demo__ResetLockTimeoutSeconds`
- `Demo__SessionLifetimeHours`
- `Pluggy__ClientId`
- `Pluggy__ClientSecret`

You can use `server/FinanceDashboard.Api/appsettings.Development.local.example.json` as a base.

Run the API:

```powershell
cd server/FinanceDashboard.Api
dotnet run
```

Default API URL:

```text
http://localhost:5278
```

### 3. Frontend

```powershell
cd client
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

For local frontend development, `client/src/lib/api/http.js` falls back to:

```text
http://localhost:5278/api
```

For production builds, configure the active App Service URL:

```text
VITE_API_URL=https://YOUR-API-HOST.azurewebsites.net/api
```

## Database Migrations

Apply migrations with:

```powershell
cd server/FinanceDashboard.Api
dotnet ef database update
```

Run this whenever a new migration changes the database schema.

## Tests

Backend:

```powershell
dotnet test tests/FinanceDashboard.Api.Tests/FinanceDashboard.Api.Tests.csproj
```

Frontend:

```powershell
cd client
npm run lint
npm test
npm run build
```

End-to-end:

```powershell
cd client
npm run test:e2e
```

## Documentation

- [Azure deployment guide](docs/azure-deploy.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](docs/changelog.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [Security and reliability checklist](docs/security-hardening-checklist.md)

## Security Notes

- Do not commit secrets.
- Keep local backend configuration out of Git.
- Store SQL Server passwords only in safe local or cloud secret stores.
- Keep password reset links out of logs in production.
- Keep `Client__BaseUrl` pinned to the trusted frontend origin.
- Keep rate limiting enabled on public authentication endpoints.
- Invalidate sessions when tokens expire or when the user stays inactive for too long.
