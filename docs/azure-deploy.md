# Deploy no Azure

O Finova usa recursos independentes para frontend, API e banco:

- React/Vite no `Azure Static Web Apps`
- ASP.NET Core no `Azure App Service`
- SQL Server no `Azure SQL Database`
- SMTP externo para e-mails transacionais e notificações

Os nomes e hosts podem mudar após transferência de assinatura ou recriação de recursos. Por isso, este guia não trata URLs históricas como atuais.

## Descobrir os recursos ativos

Confirme primeiro a assinatura selecionada:

```powershell
az account show --query "{name:name,id:id,tenantId:tenantId}" --output table
```

Liste os recursos disponíveis:

```powershell
az group list --query "[].{name:name,location:location}" --output table
az staticwebapp list --query "[].{name:name,group:resourceGroup,host:defaultHostname}" --output table
az webapp list --query "[].{name:name,group:resourceGroup,host:defaultHostName,state:state}" --output table
az sql server list --query "[].{name:name,group:resourceGroup,host:fullyQualifiedDomainName}" --output table
```

Depois de identificar o grupo e o servidor SQL:

```powershell
az sql db list --resource-group <GRUPO> --server <SERVIDOR-SQL> --output table
```

Não coloque IDs de assinatura, tokens, perfis de publicação, senhas ou connection strings na documentação.

## Frontend

O workflow versionado está em:

```text
.github/workflows/azure-static-web-apps-thankful-dune-0335cc110.yml
```

Antes do deploy, ele executa `npm ci`, auditoria de dependências, lint, testes e build. O artefato `client/dist` é publicado sem um segundo build dentro da action do Azure.

Secrets necessários no GitHub Actions:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DUNE_0335CC110`
- `VITE_API_URL`

`VITE_API_URL` deve terminar em `/api`:

```text
https://<HOST-DO-APP-SERVICE>/api
```

Se o Static Web App for recriado ou movido, copie um deployment token do recurso ativo e atualize o secret correspondente:

```text
Azure Portal > Static Web App > Manage deployment token
GitHub > Settings > Secrets and variables > Actions
```

O erro abaixo normalmente indica token associado a outro recurso:

```text
No matching Static Web App was found or the api key was invalid.
```

## Backend

O workflow versionado está em:

```text
.github/workflows/main_finova-api.yml
```

Ele restaura, compila, testa, audita dependências e publica:

```text
server/FinanceDashboard.Api/FinanceDashboard.Api.csproj
```

Secret necessário:

- `AZURE_WEBAPP_PUBLISH_PROFILE`

Após mover ou recriar o App Service, gere um novo perfil de publicação e substitua o secret. Um perfil antigo permanece vinculado ao recurso anterior.

Como melhoria futura, o perfil de publicação pode ser substituído por autenticação OIDC. Essa troca exige criar a credencial federada na conta Azure ativa antes de alterar o workflow.

## Variáveis da API

No `App Service > Configuração > Variáveis de ambiente`, configure:

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
- `Demo__Email`
- `Demo__Password`
- `Pluggy__ClientId`, quando a integração estiver em uso
- `Pluggy__ClientSecret`, quando a integração estiver em uso

Valores não secretos de referência:

```text
Jwt__Issuer=FinanceDashboard
Jwt__Audience=FinanceDashboard
Cors__AllowedOrigins__0=https://<HOST-DO-FRONTEND>
Client__BaseUrl=https://<HOST-DO-FRONTEND>
Notifications__Enabled=true
Notifications__ProcessingIntervalMinutes=60
Smtp__Port=587
Smtp__FromName=Finova
Smtp__EnableSsl=true
Demo__Enabled=true
Demo__Email=demo@finova.app
```

`Client__BaseUrl` é obrigatório e deve ser uma URL absoluta confiável. Ele é usado nos links de confirmação, redefinição de senha e painel público.

A autenticação do navegador usa cookie `HttpOnly`. Em produção, o cookie é enviado com `Secure` e `SameSite=None`, enquanto o frontend envia as requisições com credenciais e antiforgery. Por isso:

- publique a API e o frontend na mesma janela ao alterar esse contrato de autenticação; versões antigas e novas misturadas podem interromper temporariamente o login;
- `Cors__AllowedOrigins__0` deve conter exatamente a origem ativa do frontend;
- não use `*` em CORS quando credenciais estiverem habilitadas;
- valide login, logout e requisições `POST`, `PUT` e `DELETE` no domínio final;
- prefira domínios customizados de frontend e API sob o mesmo site registrável, reduzindo dependência de cookies tratados pelo navegador como terceiros.

Se o App Service usar mais de uma instância, persista o key ring do ASP.NET Core Data Protection antes de considerar o antiforgery estável entre instâncias.

O backend usa somente SMTP por meio de `IEmailSender`. Não há dependência de runtime do Azure Communication Services.

## Banco de dados

Configure a connection string com o nome `Default` no App Service. O código também aceita a variável:

```text
ConnectionStrings__Default
```

Use criptografia e não registre o valor real no repositório:

```text
Server=tcp:<SERVIDOR>.database.windows.net,1433;Initial Catalog=<BANCO>;Persist Security Info=False;User ID=<USUARIO>;Password=<SENHA>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

Depois de uma migration nova:

```powershell
dotnet ef database update --project server/FinanceDashboard.Api/FinanceDashboard.Api.csproj
```

A migration `AddUserSessionVersion` precisa ser aplicada antes de publicar a API que valida versões de sessão. Após essa implantação, JWTs emitidos pela versão anterior não terão a nova claim e serão rejeitados; esse novo login único é esperado. Trocas de senha posteriores revogam as demais sessões do usuário, e redefinições por link revogam todas.

## E-mail e recuperação de senha

Valide o SMTP com uma conta controlada antes de abrir o cadastro ao público. Em produção, quando o envio de um novo link falha, o token recém-criado é removido e links anteriores ainda válidos são preservados.

Somente em desenvolvimento controlado é possível expor a URL de redefinição na resposta:

```text
PasswordReset__ExposeResetUrlInResponse=true
```

Nunca deixe essa opção ativa em produção pública.

## Transferência ou recriação

Após mover recursos para outra conta ou assinatura:

1. Selecione a assinatura correta com `az account set --subscription <ID-OU-NOME>`.
2. Consulte os novos hosts com os comandos deste guia.
3. Atualize `VITE_API_URL` no GitHub.
4. Atualize `Cors__AllowedOrigins__0` e `Client__BaseUrl` no App Service.
5. Gere novos deployment token e publish profile.
6. Reaplique variáveis, connection string, regras de rede e credenciais SMTP.
7. Revise DNS e domínios customizados.
8. Execute todas as validações abaixo.

## Validação pós-deploy

Confirme, nesta ordem:

1. `https://<HOST-DA-API>/health` responde `200` com `{"status":"ok"}`.
2. O frontend carrega sem erro no console.
3. Cadastro envia o e-mail de confirmação.
4. Confirmação permite login.
5. Recuperação envia um link utilizável uma única vez.
6. Rotas autenticadas rejeitam chamadas sem o cookie de sessão ou um Bearer token válido.
7. O navegador não possui JWT no `localStorage`, o logout remove o cookie e mutações sem antiforgery são rejeitadas.
8. Alterar a senha no perfil mantém a sessão atual e encerra uma sessão aberta em outro navegador.
9. Redefinir a senha por link encerra todas as sessões anteriores.
10. Conta demo, CRUD de transações, importação e exportação funcionam.
11. Os workflows do GitHub terminam sem pular lint ou testes.

## Rede

Na arquitetura atual, o frontend precisa alcançar a API pela internet. O App Service pode manter acesso público, enquanto JWT, CORS, rate limit e autorização protegem a superfície da aplicação.

Não habilite uma configuração exclusivamente privada sem preparar a integração de rede necessária entre todos os componentes; isso torna a API inacessível ao Static Web App.
