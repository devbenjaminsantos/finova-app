# Finova

Finova é uma aplicação full stack de controle financeiro pessoal criada para tornar a gestão do dinheiro mais clara, segura e fácil de acompanhar. O projeto começou como um painel financeiro e evoluiu para um produto com cara de SaaS: autenticação, conta demo, gestão de transações, gráficos, metas, recorrências, parcelamentos, contas financeiras, exportações, notificações, painel público em modo leitura e deploy em produção no Azure.

English version: [README.md](README.md)

## O que o Finova faz

O Finova permite:

- criar conta e fazer login com JWT
- confirmar e-mail no cadastro
- recuperar e redefinir senha por e-mail
- explorar o produto com uma conta demo
- cadastrar, editar, remover, filtrar, importar e exportar transações
- acompanhar receitas, despesas, saldo, categorias e tags
- organizar contas financeiras e filtrar dados por conta
- definir metas mensais gerais e por categoria
- acompanhar lançamentos recorrentes e compras parceladas
- visualizar gráficos, comparativos, previsões e insights prescritivos
- receber alertas de metas e resumo mensal por e-mail
- compartilhar um painel público somente leitura
- revisar histórico de auditoria para fluxos sensíveis
- alternar entre tema claro e escuro

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
- JWT Bearer Authentication
- Scalar.AspNetCore
- Azure Communication Services Email ou SMTP
- Estrutura de integração Pluggy para fluxos de Open Finance

### Infraestrutura

- Azure Static Web Apps
- Azure App Service
- Azure SQL Database
- Azure Communication Services Email
- Application Insights

## Arquitetura em resumo

```text
Finova/
|-- client/                          # Frontend React/Vite
|-- server/
|   |-- FinanceDashboard.Api/        # API ASP.NET Core
|   |-- docker-compose.yml           # SQL Server local
|   `-- .env.example                 # Exemplo de env do banco local
|-- tests/
|   `-- FinanceDashboard.Api.Tests/  # Testes automatizados do backend
|-- docs/
|   |-- azure-deploy.md              # Guia de deploy no Azure
|   |-- roadmap.md                   # Roadmap técnico e de produto
|   |-- changelog.md                 # Histórico por marco de entrega
|   `-- architecture-decisions.md    # Decisões e racional do projeto
`-- finance-dashboard-react.sln
```

O frontend chama a API por meio de `VITE_API_URL`. Em produção, essa variável deve apontar para a URL do App Service com `/api`.

## Produção

Recursos atuais:

- Frontend: `Azure Static Web Apps`
- Backend: `Azure App Service`
- Banco: `Azure SQL Database`

Links atuais:

- Frontend: `https://polite-ground-038630210.7.azurestaticapps.net`
- Health check da API: `https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/health`

O domínio customizado planejado é `finovawallet`.

## Como rodar localmente

### 1. Banco de dados

Crie `server/.env` com base em `server/.env.example` e defina:

```env
SA_PASSWORD=SuaSenhaForteAqui
```

Suba o SQL Server:

```powershell
cd server
docker compose up -d
```

### 2. Backend

A API pode ser configurada com variáveis de ambiente ou com um arquivo local ignorado pelo Git, como `appsettings.Development.local.json`.

Configurações esperadas:

- `ConnectionStrings__Default`
- `Jwt__Key`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Cors__AllowedOrigins__0`
- `Client__BaseUrl`
- `Email__Provider`
- `AzureCommunicationServices__Email__ConnectionString`
- `AzureCommunicationServices__Email__SenderAddress`
- `AzureCommunicationServices__Email__SenderName`
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
- `Demo__Email`
- `Demo__Password`
- `Pluggy__ClientId`
- `Pluggy__ClientSecret`

Você pode usar `server/FinanceDashboard.Api/appsettings.Development.local.example.json` como base.

Execute a API:

```powershell
cd server/FinanceDashboard.Api
dotnet run
```

URL padrão da API:

```text
http://localhost:5278
```

### 3. Frontend

```powershell
cd client
npm install
npm run dev
```

URL padrão do frontend:

```text
http://localhost:5173
```

Em desenvolvimento local, `client/src/lib/api/http.js` usa o fallback:

```text
http://localhost:5278/api
```

Em builds de produção, configure:

```text
VITE_API_URL=https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/api
```

## Migrações

Para aplicar as migrations:

```powershell
cd server/FinanceDashboard.Api
dotnet ef database update
```

Esse passo é necessário sempre que uma nova migration alterar o schema do banco.

## Testes

Backend:

```powershell
dotnet test tests/FinanceDashboard.Api.Tests/FinanceDashboard.Api.Tests.csproj
```

Frontend:

```powershell
cd client
npm test
```

End-to-end:

```powershell
cd client
npm run test:e2e
```

## Documentação

- [Guia de deploy no Azure](docs/azure-deploy.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](docs/changelog.md)
- [Decisões de arquitetura](docs/architecture-decisions.md)

## Segurança

- Não versionar segredos.
- Manter configurações locais do backend fora do Git.
- Guardar senhas do SQL Server apenas em ambientes seguros.
- Não expor links de redefinição de senha em logs de produção.
- Invalidar sessões quando o token expirar ou quando houver inatividade prolongada.
