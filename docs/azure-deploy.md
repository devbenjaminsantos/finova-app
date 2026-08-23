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
- `Demo__Name`
- `Demo__Email`
- `Demo__ResetLockTimeoutSeconds`
- `Demo__SessionLifetimeHours`
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
Demo__Name=Conta Demo
Demo__Email=demo@finova.app
Demo__ResetLockTimeoutSeconds=15
Demo__SessionLifetimeHours=2
```

`Client__BaseUrl` é obrigatório e deve ser uma URL absoluta confiável. Ele é usado nos links de confirmação, redefinição de senha e painel público.

A autenticação do navegador usa cookie `HttpOnly`. Em produção, o cookie é enviado com `Secure` e `SameSite=None`, enquanto o frontend envia as requisições com credenciais e antiforgery. Por isso:

- publique a API e o frontend na mesma janela ao alterar esse contrato de autenticação; versões antigas e novas misturadas podem interromper temporariamente o login;
- `Cors__AllowedOrigins__0` deve conter exatamente a origem ativa do frontend;
- não use `*` em CORS quando credenciais estiverem habilitadas;
- valide login, logout e requisições `POST`, `PUT` e `DELETE` no domínio final;
- prefira domínios customizados de frontend e API sob o mesmo site registrável, reduzindo dependência de cookies tratados pelo navegador como terceiros.

No Azure App Service, o ASP.NET Core persiste automaticamente o key ring em `%HOME%/ASP.NET/DataProtection-Keys`, armazenamento de rede compartilhado entre as instâncias do mesmo deployment slot. Isso atende o antiforgery quando a API escala horizontalmente dentro do slot atual.

Deployment slots diferentes não compartilham esse key ring. Antes de introduzir staging com slot swap, configure um provedor externo comum, como Azure Blob Storage, Key Vault, SQL ou Redis, e valide a leitura das chaves pelos dois slots. As chaves automáticas do App Service também não ficam protegidas em repouso; trate um key ring externo com proteção explícita como endurecimento necessário antes de ampliar a estratégia de slots.

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

As migrations `AddUserSessionVersion`, `AddPublicDashboardTokenHash` e `AddIsolatedDemoAccounts` precisam ser aplicadas antes de publicar esta versão da API. Após a primeira, JWTs emitidos pela versão anterior não terão a nova claim e serão rejeitados; esse novo login único é esperado. Trocas de senha posteriores revogam as demais sessões do usuário, e redefinições por link revogam todas.

A migration do painel público invalida os links legados baseados no ID do usuário. Para cada painel que já estava ativo, abra o perfil e use **Gerar novo link** uma vez depois do deploy. O token bruto aparece somente nessa emissão ou em uma rotação; o banco armazena apenas o hash.

## E-mail e recuperação de senha

Valide o SMTP com uma conta controlada antes de abrir o cadastro ao público. Em produção, quando o envio de um novo link falha, o token recém-criado é removido e links anteriores ainda válidos são preservados.

Somente em desenvolvimento controlado é possível expor a URL de redefinição na resposta:

```text
PasswordReset__ExposeResetUrlInResponse=true
```

Nunca deixe essa opção ativa em produção pública.

As notificações financeiras usam um lock transacional do SQL Server para impedir que instâncias concorrentes processem a mesma referência ao mesmo tempo. Uma falha SMTP libera a entrega para nova tentativa. Ainda existe uma janela rara de duplicidade se o provedor aceitar o e-mail e o processo terminar antes do commit no banco; monitore os logs e o histórico de entregas, pois SMTP e Azure SQL não participam da mesma transação distribuída.

## Conta demo

Cada chamada aceita por `POST /api/auth/demo-login` cria uma conta efêmera própria, com e-mail interno derivado de `Demo__Email`, senha aleatória inacessível e cinco transações de apresentação. Visitantes simultâneos não compartilham movimentações, preferências, links públicos nem histórico de auditoria.

A sessão deixa de ser aceita depois de `Demo__SessionLifetimeHours`, limitado pelo código entre uma e duas horas para acompanhar a validade do cookie e do JWT. No acesso demo seguinte, contas vencidas e todos os seus dados são removidos. Contas demo não participam da automação SMTP.

Criação e limpeza usam a execution strategy do EF, transação serializável e `sp_getapplock`, coordenando instâncias conectadas ao mesmo Azure SQL. O endpoint possui ainda um limite próprio de cinco chamadas por minuto por IP. Como a limpeza acontece no acesso seguinte, configure uma rotina independente de retenção se a demo deixar de receber acessos por longos períodos.

Esta versão não exclui automaticamente a conta compartilhada usada no fluxo antigo, porque um endereço configurado incorretamente poderia pertencer a um usuário real. Depois do deploy, localize o registro com o antigo `Demo__Email`, confirme manualmente seu ID e seus dados e só então remova ou desative essa conta.

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
10. Ativar o painel público emite um link, rotacioná-lo invalida o anterior e revogá-lo retorna `404` em seguida.
11. A conta demo restaura os dados sem alterar contas reais; CRUD de transações, importação e exportação funcionam.
12. Duas execuções concorrentes da automação não registram nem enviam a mesma referência duas vezes.
13. Os workflows do GitHub terminam sem pular lint ou testes.

## Rede

Na arquitetura atual, o frontend precisa alcançar a API pela internet. O App Service pode manter acesso público, enquanto JWT, CORS, rate limit e autorização protegem a superfície da aplicação.

Não habilite uma configuração exclusivamente privada sem preparar a integração de rede necessária entre todos os componentes; isso torna a API inacessível ao Static Web App.
