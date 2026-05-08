# Deploy no Azure

Este projeto usa três recursos separados no Azure:

- frontend React/Vite em `Azure Static Web Apps`
- backend ASP.NET Core em `Azure App Service`
- banco em `Azure SQL Database`

## Recursos

- Grupo de recursos: `rg-finova`
- Static Web App: `polite-ground-038630210.7.azurestaticapps.net`
- App Service: `finova-api`
- Azure SQL Server: `finovasqlserver.database.windows.net`
- Azure SQL Database: `finova-db`

## Frontend

O workflow real do frontend está em:

```text
.github/workflows/azure-static-web-apps-polite-ground-038630210.yml
```

Configuração do Static Web Apps:

- `App location`: `client`
- `Api location`: vazio
- `Output location`: `dist`

Secrets do GitHub Actions:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_POLITE_GROUND_038630210`
- `VITE_API_URL`

Valor atual de `VITE_API_URL`:

```text
https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/api
```

## Backend

O workflow da API está em:

```text
.github/workflows/deploy-api-azure.yml
```

Ele publica o projeto:

```text
server/FinanceDashboard.Api/FinanceDashboard.Api.csproj
```

Secret do GitHub Actions:

- `AZURE_WEBAPP_PUBLISH_PROFILE`

Esse valor vem de:

```text
Azure Portal > App Service > Visão geral > Obter perfil de publicação
```

## Erro: token inválido do Static Web Apps

Se o deploy do frontend falhar com:

```text
No matching Static Web App was found or the api key was invalid.
```

confirme estes pontos:

1. O workflow ativo deve ser `.github/workflows/azure-static-web-apps-polite-ground-038630210.yml`.
2. O workflow deve usar o secret `AZURE_STATIC_WEB_APPS_API_TOKEN_POLITE_GROUND_038630210`.
3. Esse secret deve conter o deployment token do recurso `polite-ground-038630210` no Azure Static Web Apps.

Para gerar/copiar o token correto:

```text
Azure Portal > Static Web App polite-ground-038630210 > Manage deployment token
```

Depois atualize o valor em:

```text
GitHub > Settings > Secrets and variables > Actions > Repository secrets
```

## Variáveis da API no App Service

No `Azure Portal > App Service > Configurações > Variáveis de ambiente`, configure:

- `Jwt__Key`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Cors__AllowedOrigins__0`
- `Client__BaseUrl`
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

Valores esperados:

```text
Jwt__Issuer=FinanceDashboard
Jwt__Audience=FinanceDashboard
Cors__AllowedOrigins__0=https://polite-ground-038630210.7.azurestaticapps.net
Client__BaseUrl=https://polite-ground-038630210.7.azurestaticapps.net
Smtp__Port=587
Smtp__FromName=Finova
Smtp__EnableSsl=true
Demo__Enabled=true
Demo__Email=demo@finova.app
```

`Demo__Password` pode ser uma senha forte interna; o usuário final não precisa digitá-la quando usa o botão de demonstração.

Em `Cadeias de conexão`, configure:

- `Nome`: `Default`
- `Tipo`: `SQLAzure`

Exemplo de valor:

```text
Server=tcp:finovasqlserver.database.windows.net,1433;Initial Catalog=finova-db;Persist Security Info=False;User ID=finovadmin;Password=SUA-SENHA;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## Recuperação de senha

O fluxo usa tokens de uso único na tabela `PasswordResetTokens`.

Depois de publicar a API, aplique a migration nova:

```powershell
cd server\FinanceDashboard.Api
dotnet ef database update
```

Para produção, configure SMTP no `App Service`; sem SMTP, o token é gerado, mas o e-mail não será enviado.

Para testes controlados, é possível habilitar temporariamente:

```text
PasswordReset__ExposeResetUrlInResponse=true
```

Não deixe essa configuração ativa em produção aberta.

## Domínio Customizado

Para trocar o domínio do frontend:

1. Compre ou use um domínio existente.
2. No `Static Web App`, abra `Custom domains`.
3. Adicione o domínio desejado.
4. Configure os registros DNS indicados pelo Azure.
5. Aguarde a validação e emissão do certificado.
6. Atualize no `App Service`:
   - `Cors__AllowedOrigins__0=https://SEU-DOMINIO`
   - `Client__BaseUrl=https://SEU-DOMINIO`
7. Atualize links/documentação do projeto.

Se também quiser customizar o domínio da API, configure um domínio separado, por exemplo:

```text
api.seu-dominio.com
```

Depois atualize no GitHub Actions:

```text
VITE_API_URL=https://api.seu-dominio.com/api
```

## Validações

Teste estes endereços depois do deploy:

- frontend: `https://polite-ground-038630210.7.azurestaticapps.net`
- health da API: `https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/health`
- recuperação: `/forgot-password`
- redefinição: `/reset-password?token=...`

## Observação Sobre Acesso Público

O `App Service` deve ficar `Public` no acesso de rede para o frontend conseguir chamar a API. A proteção dos endpoints continua sendo feita pelo JWT da própria aplicação.
