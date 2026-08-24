# Trilha de Migração: Azure -> Vercel + Railway + Neon

> Documento operacional para migrar o Finova com baixo risco, preservar uma janela de rollback e reduzir o custo de infraestrutura durante períodos sem acesso.

**Última revisão:** 24 de agosto de 2026

**Estado:** planejamento; nenhuma etapa deste documento implica que a migração já foi executada.

## Objetivo

Migrar o ecossistema atualmente hospedado na Azure para:

| Camada | Origem | Destino |
| --- | --- | --- |
| Frontend React/Vite | Azure Static Web Apps | Vercel |
| API ASP.NET Core | Azure App Service | Railway |
| Banco SQL Server | Azure SQL | Neon PostgreSQL |
| Código e deploy | GitHub + workflows Azure | GitHub + integrações Vercel/Railway |

O resultado deve manter:

- frontend sempre disponível por CDN;
- API capaz de dormir quando estiver ociosa;
- banco capaz de escalar para zero;
- autenticação por JWT em cookie `HttpOnly`;
- proteção CSRF, CORS restrito e conta demo funcional;
- envio de e-mail, integração bancária e automações operantes;
- backups verificáveis e possibilidade de rollback;
- custo baixo ou nulo quando o projeto estiver sem acessos.

## Arquitetura-alvo

```text
GitHub
  |-- client/ --------------------> Vercel
  |                                  app.seudominio.com
  |
  `-- server/FinanceDashboard.Api -> Railway
                                     api.seudominio.com
                                          |
                                          `-> Neon PostgreSQL
```

Fluxo autenticado:

```text
Navegador -> Vercel -> Railway -> Neon
                  login/operação   dados
```

O frontend carrega imediatamente. Quando uma operação exige a API, o Railway e o Neon podem precisar acordar. A interface deve apresentar loading, timeout tratável e opção de nova tentativa.

### Decisão de domínio

Preferir domínios sob o mesmo domínio registrável:

- `app.seudominio.com` para a Vercel;
- `api.seudominio.com` para o Railway.

Isso reduz problemas de cookies entre sites. Ainda será necessário manter `credentials: include`, CORS com origens exatas, HTTPS e as proteções CSRF atuais.

## Regras de execução

1. Executar uma fase por vez.
2. Validar cada fase antes de marcar o checklist.
3. Nunca expor secrets em commits, logs, capturas ou comandos compartilhados.
4. Não alterar o DNS antes de concluir os testes integrados.
5. Não excluir recursos da Azure antes do cutover, da observação e da janela de rollback.
6. Registrar os IDs de deploy, backups e URLs usados em cada marco.
7. Conferir preços e limites nos painéis antes de contratar ou promover planos.

## Ponto crítico: Azure SQL não é PostgreSQL

O banco atual usa SQL Server. Portanto, a migração para Neon **não** pode ser feita trocando apenas a connection string ou usando `pg_dump` na origem.

O repositório possui dependências e SQL específicos de SQL Server:

- `Microsoft.EntityFrameworkCore.SqlServer` e `UseSqlServer`;
- migrations com tipos e annotations `SqlServer:*`;
- `sys.sp_getapplock` nas coordenações da conta demo e das notificações;
- filtro de índice com sintaxe `[PublicDashboardTokenHash] IS NOT NULL`;
- constraints, identity columns, datas e comparações que precisam ser validadas no PostgreSQL.

O cutover do banco só pode acontecer depois de adaptar o código, criar migrations Npgsql e migrar os dados com validação.

---

## Fase 0 - Inventário da Azure

**Status:** em andamento desde 24 de agosto de 2026.

- [x] Registrar nome, resource group, região, SKU e URL do Static Web App.
- [x] Registrar nome, resource group, região, SKU e URL da API.
- [x] Registrar servidor, banco, SKU, firewall e tamanho do Azure SQL.
- [ ] Listar variáveis e secrets por serviço sem copiar valores para este documento.
- [ ] Listar domínios, DNS, certificados e TTLs atuais.
- [ ] Registrar CORS, callbacks, webhooks e URLs públicas.
- [ ] Identificar storage, arquivos persistentes e filas fora do banco.
- [ ] Registrar jobs, hosted services e automações agendadas.
- [ ] Registrar o custo mensal atual para comparação.
- [ ] Confirmar responsável e janela prevista para o cutover.

**Saída da fase:** inventário revisado e nenhum recurso removido.

### Inventário confirmado pelo repositório

| Área | Evidência confirmada | Impacto na migração |
| --- | --- | --- |
| Frontend | React 19, Vite 7 e Node 22 no workflow; fonte em `client` e artefato em `client/dist` | Projeto Vercel deve usar `client` como raiz e `dist` como saída |
| Frontend Azure | Workflow `.github/workflows/azure-static-web-apps-thankful-dune-0335cc110.yml` publica o artefato no Azure Static Web Apps | Manter ativo até o fim da janela de rollback |
| Rotas e headers | `client/public/staticwebapp.config.json` contém fallback de SPA e headers de segurança | Traduzir o fallback para `client/vercel.json` e revalidar os headers na Vercel |
| API | ASP.NET Core e EF Core 10; projeto em `server/FinanceDashboard.Api` | Imagem Railway precisa suportar .NET 10 |
| API Azure | Workflow `.github/workflows/main_finova-api.yml` publica no App Service `finova-api` | Nome do workflow não confirma que esse ainda seja o recurso ativo |
| Banco | `UseSqlServer`, pacote EF Core SQL Server, migrations SQL Server e SQL Server 2022 no ambiente local | Migração para Neon exige adaptação de provider, migrations e dados |
| Persistência | Não foi encontrado armazenamento persistente da aplicação fora do banco | Confirmar no Azure Portal se não há Storage Account, mount ou recurso externo não versionado |
| Autenticação | JWT em cookie `HttpOnly`, antiforgery, CORS com credenciais e validação de sessão no banco | Domínios Vercel/Railway e key ring precisam ser validados em conjunto |
| E-mail | SMTP por `IEmailSender` | Migrar variáveis SMTP e testar entrega real no Railway |
| Integração externa | Pluggy por `HttpClient`, quando habilitado | Railway precisa de saída HTTPS e das credenciais do ambiente |
| Processamento em background | `FinancialEmailAutomationHostedService` executa notificações periodicamente | Pode impedir o sleep; decidir entre desabilitar, cron ou worker separado |
| Conta demo e notificações | Coordenação concorrente usa `sys.sp_getapplock` | Substituir por lock compatível com PostgreSQL antes do Neon |
| Secrets locais | `.env` e `appsettings.Development.local.json` estão ignorados pelo Git | Preservar a regra e migrar apenas pelos painéis dos provedores |
| URLs fixas | Não foram encontrados hosts Azure fixados no código de runtime | Ainda é necessário conferir URLs efetivas no GitHub e na Azure |

### Static Web App confirmado na Azure

Dados conferidos no Azure Portal em 24 de agosto de 2026:

| Campo | Valor |
| --- | --- |
| Recurso | `finova-app` |
| Tipo | Azure Static Web Apps |
| Assinatura | `Finova Subscription` |
| Resource Group | `rg-finova` |
| Localização | Global |
| SKU | Free |
| Status | Paused |
| URL padrão | `https://thankful-dune-0335cc110.7.azurestaticapps.net/` |
| Repositório | `https://github.com/devbenjaminsantos/finova-app` |
| Branch | `main` |
| Ambientes | Production |
| Domínios customizados | Nenhum; somente o domínio padrão da Azure |
| Application settings | Nenhum |

O status `Paused` foi registrado como estado observado, sem reativação ou outra alteração no recurso. A ausência de Application Settings no SWA é coerente com o deploy atual: `VITE_API_URL` é incorporada ao bundle pelo workflow do GitHub Actions durante o build.

### App Service confirmado na Azure

Dados conferidos no Azure Portal em 24 de agosto de 2026:

| Campo | Valor |
| --- | --- |
| Recurso | `finova-api` |
| Tipo | Azure App Service |
| Assinatura | `Finova Subscription` |
| Resource Group | `rg-finova` |
| Localização | Brazil South |
| Status | Admin Disabled |
| Domínio padrão | `https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net` |
| App Service Plan | `asp-finova-free` |
| Pricing tier/SKU | Free F1 |
| Sistema operacional | Windows |
| Runtime Stack | .NET 10 |
| Domínios customizados | Nenhum |
| Variáveis de ambiente | Existem, mas o Portal bloqueia a consulta enquanto o recurso estiver administrativamente desabilitado |

O estado `Admin Disabled` foi registrado sem tentativa de inicialização ou alteração. O Portal exige a regularização de um débito antes de permitir a reativação e o acesso às variáveis efetivas. Nenhum valor foi consultado ou registrado.

#### Bloqueio financeiro e retenção

A documentação da Microsoft informa que uma assinatura desabilitada deixa de permitir criação e gerenciamento de recursos. Dependendo do tipo de assinatura, ela pode permanecer desabilitada por um período entre 1 e 90 dias antes da exclusão permanente. Portanto:

- não pagar ou reativar apenas para consultar variáveis;
- confirmar no Portal o estado exato da assinatura e qualquer prazo exibido;
- tratar o acesso aos dados do Azure SQL como prioridade;
- não presumir que recursos e dados serão preservados indefinidamente.

Referência: [Azure subscription states](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/subscription-states).

### Azure SQL confirmado na Azure

Dados conferidos no Azure Portal em 24 de agosto de 2026:

| Campo | Valor |
| --- | --- |
| Banco | `finova-db` |
| Servidor lógico | `finovasqlserver` |
| Hostname | `finovasqlserver.database.windows.net` |
| Tipo | Azure SQL Database |
| Resource Group | `rg-finova` |
| Localização | Brazil South |
| Status | Available |
| Pricing tier | F1 |
| Armazenamento máximo | 32 GB |
| Espaço alocado | 32 MB |
| Espaço usado | 8 MB |
| Zone redundancy | Disabled |
| Public network access | Selected networks |
| Allow Azure services | Yes |
| Private endpoints | Nenhum |
| Frequência de backup | 12 horas |
| PITR retention | 7 dias |
| Long-term retention | Disabled |
| Backup storage redundancy | Locally-redundant |
| Demais configurações de backup | Sem valores configurados |

O volume usado é pequeno, mas disponibilidade no painel não comprova que consultas ou exportações estejam liberadas.

#### Teste de acesso aos dados

Em 24 de agosto de 2026, uma tentativa de conexão pelo Query Editor falhou informando que `finova-db` não estava disponível no servidor. O identificador de rastreamento da sessão não foi armazenado neste documento.

Conclusão atual:

- o recurso permanece visível no plano de controle da Azure;
- o plano de dados está indisponível para consultas;
- não é possível inventariar tabelas nem exportar dados neste estado;
- não foram encontrados arquivos `.bak`, `.bacpac`, `.sql`, dumps ou backups no repositório;
- não foi encontrado container nem volume Docker local do Finova com uma cópia persistida do SQL Server;
- os dados atuais foram classificados pelo responsável como descartáveis;
- a migração seguirá com um banco Neon novo, sem reativar a Azure apenas para recuperar o conteúdo do banco antigo.

#### Decisão de dados

Em 24 de agosto de 2026, foi decidido iniciar o Neon com uma base limpa. Consequências aceitas:

- usuários, sessões, tokens, contas e transações do Azure SQL não serão migrados;
- o schema será criado por migrations Npgsql novas;
- a conta demo será gerada pelo fluxo atual da aplicação;
- qualquer conta real deverá ser cadastrada novamente;
- chaves JWT e demais secrets serão rotacionados na nova infraestrutura;
- a indisponibilidade do Azure SQL deixa de bloquear a migração.

### Contratos de configuração identificados

Frontend:

- `VITE_API_URL`.

API:

- `ConnectionStrings__Default`;
- `Jwt__Key`, `Jwt__Issuer` e `Jwt__Audience`;
- `Cors__AllowedOrigins__N` e `Client__BaseUrl`;
- `Notifications__Enabled` e `Notifications__ProcessingIntervalMinutes`;
- `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`, `Smtp__FromEmail`, `Smtp__FromName` e `Smtp__EnableSsl`;
- `Demo__Enabled`, `Demo__Name`, `Demo__Email`, `Demo__ResetLockTimeoutSeconds` e `Demo__SessionLifetimeHours`;
- `Pluggy__BaseUrl`, `Pluggy__ClientId` e `Pluggy__ClientSecret`;
- `PasswordReset__ExposeResetUrlInResponse`, que deve permanecer desabilitada em produção.

GitHub Actions durante a permanência na Azure:

- `VITE_API_URL`;
- `AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DUNE_0335CC110`;
- `AZURE_WEBAPP_PUBLISH_PROFILE`.

Somente os nomes foram inventariados. Valores continuam fora da documentação.

### Confirmações pendentes na Azure

Não há Azure CLI instalada neste ambiente local. Usar o Azure Portal ou o Cloud Shell, sem colar IDs ou secrets neste arquivo, para confirmar:

- [ ] assinatura e tenant ativos; a assinatura `Finova Subscription` já foi confirmada para o SWA, mas o tenant ainda não foi registrado;
- [ ] resource groups usados pelo Finova;
- [x] nome, host, região e SKU do Static Web App;
- [x] nome, host, região, plano e SKU do App Service;
- [x] servidor, banco, região, tier, tamanho, rede e backup do Azure SQL;
- [ ] domínios customizados, provedor DNS, registros atuais e TTLs;
- [ ] Storage Accounts, mounts, Application Insights, Log Analytics, IPs ou recursos auxiliares;
- [ ] variáveis realmente configuradas em produção, verificando presença sem exibir valores; consulta bloqueada pelo estado administrativo da assinatura;
- [ ] custo dos últimos 30 dias por recurso;
- [x] backup e política de retenção atuais do banco.

## Fase 1 - Preparar configuração e portabilidade

- [ ] Confirmar que o frontend usa apenas `VITE_API_URL` para localizar a API.
- [ ] Confirmar que a API usa `ConnectionStrings__Default`.
- [ ] Confirmar que `Jwt__Key`, SMTP e credenciais de terceiros existem apenas no servidor.
- [ ] Manter `.env`, arquivos locais e credenciais fora do Git.
- [ ] Atualizar arquivos de exemplo somente com placeholders.
- [ ] Confirmar `GET /health` independente do banco e retornando `200`.
- [ ] Confirmar logs em `stdout`/`stderr` sem dados pessoais ou secrets.
- [ ] Definir configurações separadas para development, preview/staging e production.

### Matriz de variáveis

Vercel, somente valores públicos incorporados ao bundle:

| Variável | Exemplo |
| --- | --- |
| `VITE_API_URL` | `https://api.seudominio.com/api` |

Railway, valores de servidor:

| Grupo | Chaves esperadas |
| --- | --- |
| Banco | `ConnectionStrings__Default` |
| JWT | `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience` |
| Frontend/CORS | `Client__BaseUrl`, `Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1` |
| SMTP | `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`, `Smtp__FromEmail` |
| Integrações | chaves Pluggy e demais provedores usados pelo projeto |
| Automações | configurações de notificação e processamento |

**Saída da fase:** aplicação local funcionando sem URLs ou credenciais da Azure fixadas no código.

## Fase 2 - Adaptar a API de SQL Server para PostgreSQL

Executar esta fase em incrementos isolados e manter a compatibilidade com SQL Server apenas enquanto ela for útil para a validação local.

- [x] Adicionar `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, compatível com .NET/EF Core 10.
- [x] Adicionar seleção explícita de provedor e configurar `UseNpgsql` para o Neon por meio de `Database__Provider=PostgreSql`.
- [x] Definir retry para falhas transitórias de conexão e cold start nos dois provedores.
- [ ] Remover ou isolar dependências diretas de `Database.IsSqlServer()`.
- [x] Adaptar o lock da conta demo para `pg_try_advisory_xact_lock`, preservando timeout, commit e rollback.
- [x] Adaptar o lock de notificações para `pg_try_advisory_xact_lock`, preservando a idempotência sem espera.
- [x] Adaptar o filtro de índice de `PublicDashboardTokenHash` para SQL Server e PostgreSQL, com testes da metadata EF.
- [x] Revisar constraints, defaults, identity/sequence e tipos: constraints usam delimitadores por provedor, datas civis usam `date`, instantes UTC usam `timestamp with time zone` no PostgreSQL e valores financeiros permanecem em centavos inteiros.
- [x] Tratar tags e categorias sem diferença entre maiúsculas e minúsculas: PostgreSQL usa `citext`, preserva a grafia exibida e reforça a unicidade por índice.
- [x] Adaptar a detecção de e-mail duplicado para `PostgresException` com unique violation, além de `SqlException`.
- [ ] Revisar as demais comparações de strings e tamanhos no PostgreSQL real.
- [x] Criar uma migration inicial limpa para PostgreSQL em vez de aplicar o histórico SQL Server no Neon.
- [x] Arquivar as migrations SQL Server em `docs/archive/sqlserver-migrations`, fora do assembly da API.
- [ ] Executar testes unitários e de integração contra PostgreSQL real.

### Bloqueios específicos do Finova

- [ ] `DatabaseNotificationDeliveryCoordinator` funciona com concorrência no PostgreSQL.
- [ ] `DemoAccountPreparationService` preserva isolamento e idempotência no PostgreSQL.
- [ ] O timeout concorrente da conta demo foi verificado contra PostgreSQL real.
- [x] O índice único de `PublicDashboardTokenHash` aceita múltiplos valores nulos e rejeita tokens repetidos.
- [x] Todas as migrations Npgsql sobem do zero e podem ser revertidas em ambiente descartável.
- [ ] Login, revogação de sessão e conta demo continuam funcionando.

### Evidências locais da migration PostgreSQL

Validação executada em 24 de agosto de 2026 com PostgreSQL 17.11 descartável:

- migration `20260824162004_InitialPostgreSql` aplicada em banco vazio, revertida para `0` e reaplicada;
- extensão `citext`, 12 tabelas da aplicação e histórico do EF criados sem artefatos SQL Server;
- `Mercado` e `MERCADO` foram tratados como a mesma categoria pelo índice único;
- duas linhas com `PublicDashboardTokenHash` nulo foram aceitas e um token não nulo repetido foi rejeitado;
- limites das colunas `citext` foram preservados por constraints de `char_length` e validados no banco;
- `dotnet ef migrations has-pending-model-changes` não encontrou divergência entre o modelo e o snapshot;
- suíte da API aprovada: 89 testes, 0 falhas, 0 avisos.

**Saída da fase:** API compatível com PostgreSQL e migrations Npgsql verificadas em banco descartável.

## Fase 3 - Criar e preparar o Neon

- [ ] Criar projeto Neon na região mais próxima do Railway escolhido.
- [ ] Criar banco, role de aplicação e branch de validação.
- [ ] Guardar as connection strings em cofre; nunca no repositório.
- [ ] Exigir SSL na conexão.
- [ ] Escolher conscientemente entre endpoint direto e pooled.
- [ ] Usar endpoint direto para migrations e operações administrativas.
- [ ] Validar o endpoint usado pela API com transações, locks e migrations.
- [ ] Confirmar scale-to-zero e limites de autoscaling.
- [ ] Testar reconexão depois de o compute suspender.
- [ ] Definir política de backup/exportação externa além da retenção do plano.

### Criação do esquema e dos dados iniciais

Como os dados do Azure SQL foram classificados como descartáveis, a estratégia é:

1. Criar o esquema vazio no Neon com uma migration inicial Npgsql.
2. Validar constraints, índices, sequences, tipos e valores default no PostgreSQL.
3. Gerar uma conta demo pelo fluxo da própria aplicação.
4. Criar uma conta de teste pelo fluxo público, incluindo confirmação de e-mail.
5. Executar operações financeiras representativas e conferir totais e recorrências.

Checklist de dados novos:

- [ ] Nenhum usuário, hash de senha, token ou sessão do Azure SQL foi importado.
- [ ] Conta demo criada e renovada corretamente pela aplicação.
- [ ] Cadastro, confirmação de e-mail, login e redefinição de senha validados.
- [ ] Contas, transações, categorias, metas e recorrências persistidas.
- [ ] Relacionamentos e constraints válidos.
- [ ] IDs e sequences avançando corretamente.
- [ ] Datas e timezones conferidos.
- [ ] Decimais e totais financeiros conferidos.
- [ ] Índices presentes.
- [ ] Consultas principais dentro de tempo aceitável.

**Saída da fase:** banco Neon limpo e validado, ainda sem tráfego de produção.

## Fase 4 - Preparar a API para Railway

Preferir um `Dockerfile` multi-stage reproduzível para a API .NET 10.

- [ ] Criar e testar o `Dockerfile` da API.
- [ ] Executar como usuario sem privilégios quando a imagem permitir.
- [ ] Fazer a aplicação escutar em `0.0.0.0` e na variável `PORT` fornecida pelo Railway.
- [ ] Confirmar que `/health` responde sem consultar Neon.
- [ ] Confirmar que o container encerra corretamente com `SIGTERM`.
- [ ] Confirmar que logs saem em `stdout`/`stderr`.
- [ ] Definir migrations como etapa controlada de release, não como efeito colateral concorrente de cada réplica.

### Hosted service e modo Serverless

O `FinancialEmailAutomationHostedService` executa periodicamente. Se estiver habilitado dentro da API, pode gerar tráfego de saída e impedir o sleep.

Antes de habilitar Serverless:

- [ ] decidir se a automação fica desabilitada no serviço web;
- [ ] ou mover o processamento para cron/worker separado;
- [ ] impedir execução duplicada durante deploys e escalonamento;
- [ ] preservar idempotência das notificações;
- [ ] validar que pooling, telemetria e keep-alive não mantêm a API acordada.

### Data Protection

- [ ] Persistir o key ring do ASP.NET Core em armazenamento durável ou aceitar e documentar a invalidação de tokens CSRF em redeploys.
- [ ] Testar redeploy com sessão ativa.
- [ ] Revalidar a estratégia antes de usar mais de uma réplica.

**Saída da fase:** imagem local sobe, responde em `PORT` dinâmica e encerra sem erros.

## Fase 5 - Publicar a API no Railway

- [ ] Criar projeto e serviço conectado ao GitHub.
- [ ] Configurar o diretório raiz ou caminho do `Dockerfile` para a API.
- [ ] Selecionar a mesma região lógica do Neon, quando disponível.
- [ ] Adicionar variáveis e secrets pelo painel do Railway.
- [ ] Configurar `/health` como health check.
- [ ] Gerar domínio temporário do Railway.
- [ ] Executar migrations Npgsql de forma controlada.
- [ ] Definir limite de uso e alerta de custo.
- [ ] Confirmar RAM e CPU dentro do plano escolhido.

Validação da API temporária:

- [ ] `/health` retorna `200`.
- [ ] Login válido e inválido funcionam.
- [ ] Cookie JWT e token CSRF possuem atributos esperados.
- [ ] Revogação de sessão funciona.
- [ ] Conta demo funciona e permanece isolada.
- [ ] CRUD financeiro persiste no Neon.
- [ ] Dashboard público funciona.
- [ ] E-mail funciona sem registrar credenciais.
- [ ] Integração Pluggy funciona, se habilitada no ambiente.
- [ ] Logs não apresentam erros recorrentes.

**Saída da fase:** API homologada no Railway usando Neon, sem alterar a produção.

## Fase 6 - Habilitar e testar Railway Serverless

- [ ] Habilitar Serverless no serviço web.
- [ ] Confirmar ausência de tráfego de saída por pelo menos 10 minutos.
- [ ] Confirmar que o serviço entra em sleep.
- [ ] Medir o primeiro request após sleep.
- [ ] Tratar eventual `502` inicial com UX/retry limitado e seguro.
- [ ] Confirmar que o pool de conexões libera conexões ociosas.
- [ ] Confirmar que Neon volta a suspender depois da inatividade.
- [ ] Monitorar uso após 7 e 30 dias.

Railway Free deve ser a primeira tentativa, mas não uma promessa de custo zero. Na revisão deste documento, o plano oferece US$ 1 de crédito mensal, 0,5 GB de RAM e 1 vCPU por serviço; confirme os valores atuais antes do deploy.

**Saída da fase:** sleep/wake medido e consumo compatível com o plano escolhido.

## Fase 7 - Revisar autenticação e cookies

O Finova atual usa JWT em cookie `HttpOnly`, proteção CSRF e validação de versão de sessão no banco. Logo, o JWT não elimina necessariamente consultas ao Neon em toda requisição autenticada.

- [ ] JWT contém apenas claims necessárias e possui expiração.
- [ ] Chave de assinatura existe somente no Railway.
- [ ] Cookie de autenticação permanece `HttpOnly` e `Secure` em produção.
- [ ] CSRF continua obrigatório nas operações mutáveis.
- [ ] `Client__BaseUrl` usa o domínio final da Vercel.
- [ ] CORS aceita somente origens explicitas.
- [ ] Fluxo de expiração e revogação apresenta mensagem amigável.
- [ ] Nenhum token volta para `localStorage` ou `sessionStorage`.
- [ ] Preview deployments não recebem acesso irrestrito a produção.

**Saída da fase:** autenticação validada com os domínios temporários e finais.

## Fase 8 - Otimizar a conta demo e o cold start

Manter a demo real para apresentar integração completa, com feedback imediato:

- [ ] Botão entra em loading no primeiro clique.
- [ ] Texto de progresso não promete tempo exato.
- [ ] Timeout não é curto demais para um cold start real.
- [ ] Falha apresenta mensagem amigável e retry.
- [ ] Cliques repetidos não criam sessões ou dados duplicados.
- [ ] A conta demo não possui privilégios administrativos.
- [ ] O reset da demo continua idempotente e isolado.

Uma demo estática pode existir como fallback visual, mas deve ser identificada como demonstração e não substituir silenciosamente a integração real.

## Fase 9 - Migrar o frontend para Vercel

Criar um projeto Vercel conectado ao mesmo repositório:

- [ ] Definir **Root Directory** como `client`.
- [ ] Confirmar framework **Vite**.
- [ ] Usar `npm ci` como instalação.
- [ ] Usar `npm run build` como build command.
- [ ] Confirmar `dist` como output directory.
- [ ] Configurar `VITE_API_URL` separadamente em Preview e Production.
- [ ] Fazer primeiro deploy de Preview.
- [ ] Validar o bundle sem secrets ou connection strings.

### Rotas da SPA

Como o frontend usa rotas internas, adicionar `client/vercel.json` antes do deploy:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Validar na URL de Preview:

- [ ] Home e assets.
- [ ] Responsividade e temas.
- [ ] Login, logout e conta demo.
- [ ] Rotas autenticadas.
- [ ] Refresh direto em rota interna sem `404`.
- [ ] Dashboard público.
- [ ] Páginas de erro e estados vazios.

Deploys de Preview usam URLs variáveis. Preferir uma API de staging e origens fixas; não liberar wildcard amplo de `*.vercel.app` com credenciais.

**Saída da fase:** Preview da Vercel aprovado contra API de homologação.

## Fase 10 - CORS e domínios finais

Durante a transição, a API pode aceitar temporariamente:

- domínio atual da Azure;
- domínio fixo de homologação da Vercel;
- domínio final da Vercel;
- localhost apenas quando necessário.

Checklist:

- [ ] Adicionar o domínio do frontend ao projeto Vercel.
- [ ] Adicionar o domínio da API ao Railway.
- [ ] Configurar os registros DNS indicados por cada provedor.
- [ ] Reduzir o TTL antes da janela de cutover.
- [ ] Validar HTTPS e certificados.
- [ ] Atualizar `VITE_API_URL` de Production e gerar novo deploy.
- [ ] Atualizar `Client__BaseUrl` e `Cors__AllowedOrigins` no Railway.
- [ ] Atualizar callbacks, links de e-mail e webhooks.
- [ ] Testar cookies nos navegadores principais.
- [ ] Remover origens antigas depois da janela de rollback.

Não é necessário transferir o registro do domínio para a Vercel. Ele pode continuar no registrador atual; configure apenas os registros exigidos pelo painel.

**Saída da fase:** domínios finais verificados, ainda sem desativar a Azure.

## Fase 11 - Testes de cold start

Executar e registrar três cenários:

| Cenário | Estado inicial | Medir |
| --- | --- | --- |
| Quente | API e banco ativos | login e operação de API |
| API dormindo | Railway em sleep | primeiro request e retry |
| API e banco dormindo | Railway e Neon suspensos | tempo total até dashboard funcional |

Em todos os cenários:

- [ ] UI mostra loading imediatamente.
- [ ] Não ocorre tela branca.
- [ ] Não aparece mensagem técnica ao usuario.
- [ ] Timeout e retry se comportam como esperado.
- [ ] Uma nova tentativa não duplica operações.

## Fase 12 - Teste funcional completo

Visitante:

- [ ] Home, navegação pública e dashboard compartilhado.
- [ ] Conta demo.
- [ ] Páginas de login, cadastro, verificação e recuperação de senha.

Autenticação:

- [ ] Login válido e inválido.
- [ ] Cadastro e disparo de e-mail.
- [ ] Verificação de e-mail.
- [ ] Recuperação de senha.
- [ ] Expiração, revogação e logout.

Aplicação:

- [ ] Contas, transações, categorias, metas e recorrências.
- [ ] Importação e indexação.
- [ ] Operações `GET`, `POST`, `PUT/PATCH` e `DELETE` aplicáveis.
- [ ] Erros de validação e banco.
- [ ] E-mails financeiros e preferências.
- [ ] Integração bancária quando habilitada.

Banco:

- [ ] Persistência, relacionamentos, constraints e índices.
- [ ] Concorrência e idempotência.
- [ ] Encoding, acentos, datas, timezones e decimais.

## Fase 13 - Segurança

- [ ] Secrets somente nos ambientes de servidor.
- [ ] Nenhuma connection string no bundle da Vercel.
- [ ] Nenhuma chave JWT no frontend.
- [ ] HTTPS obrigatório.
- [ ] CORS restrito e sem refletir origens arbitrárias.
- [ ] Cookies, CSRF e headers de segurança validados.
- [ ] Usuário do banco com privilégios mínimos.
- [ ] Logs sem credenciais, tokens ou dados financeiros sensíveis.
- [ ] Conta demo sem privilégios administrativos.
- [ ] Rate limiting de autenticação e demo ativo.
- [ ] Dependências e imagens sem vulnerabilidades conhecidas de alta severidade.

## Fase 14 - Observabilidade mínima

Manter:

- logs da API e de deploy;
- health check do Railway;
- erros de conexão com Neon;
- erros de autenticação e e-mail relevantes;
- consumo mensal do Railway e Neon;
- histórico de deploys da Vercel.

Evitar health checks externos frequentes, telemetria e jobs que mantenham a API acordada sem necessidade.

## Fase 15 - Ensaio de migração

Antes do cutover real:

- [ ] Restaurar um snapshot recente do Azure SQL em ambiente de teste.
- [ ] Executar a ferramenta de exportação/importacao completa.
- [ ] Medir duração e registrar comandos seguros.
- [ ] Comparar contagens e totais financeiros.
- [ ] Executar smoke tests na Vercel + Railway + Neon.
- [ ] Executar rollback de ensaio.
- [ ] Corrigir o runbook com o que foi aprendido.

## Fase 16 - Cutover

Iniciar somente quando Vercel, Railway e Neon estiverem homologados.

1. [ ] Comunicar e iniciar a janela de manutenção.
2. [ ] Confirmar que o Neon de produção contém apenas o esquema e os dados de teste aprovados.
3. [ ] Remover ou invalidar as contas de teste que não devem permanecer.
4. [ ] Apontar a API de produção do Railway para o Neon final.
5. [ ] Executar smoke tests diretamente no domínio Railway.
6. [ ] Promover o deploy aprovado da Vercel para produção.
7. [ ] Atualizar DNS e aguardar verificação.
8. [ ] Executar teste funcional completo pelos domínios finais.
9. [ ] Encerrar a janela de manutenção somente com evidências registradas.

## Fase 17 - Janela de rollback

Não excluir imediatamente:

- Azure SQL;
- Azure App Service/API;
- Azure Static Web Apps;
- backups externos e configurações antigas.

Checklist:

- [ ] URLs antigas registradas.
- [ ] Banco antigo preservado sem receber escritas divergentes.
- [ ] Backup final armazenado fora do recurso de origem.
- [ ] TTL e procedimento de reversão conhecidos.
- [ ] Critérios objetivos de rollback definidos.
- [ ] Responsável pela decisão disponível durante a janela.

Se houver falha crítica, interromper escritas no novo ambiente antes de retornar o DNS. Dados gravados no Neon depois do cutover precisam ser reconciliados; reverter apenas o DNS pode causar perda ou divergência.

## Fase 18 - Monitoramento após o corte

- [ ] Monitorar erros e latência nas primeiras horas.
- [ ] Testar cold start após inatividade real.
- [ ] Confirmar cadastro, e-mail e conta demo diariamente durante a janela.
- [ ] Registrar consumo Railway e Neon após 7 dias.
- [ ] Registrar consumo após 30 dias.
- [ ] Comparar o custo real com a Azure.
- [ ] Decidir entre Railway Free e Hobby com base em dados.

Meta inicial de custo:

| Serviço | Meta |
| --- | --- |
| Vercel | plano gratuito, se elegível e suficiente |
| Railway | Free dentro do crédito mensal; Hobby se o uso real exigir |
| Neon | Free dentro dos limites de compute e storage |

Planos gratuitos não constituem SLA e podem mudar. O custo final deve ser confirmado nos painéis depois da migração.

## Fase 19 - Desativar a Azure

Somente depois da janela de rollback:

- [ ] Confirmar backup final e teste de restauração.
- [ ] Confirmar produção estável e DNS propagado.
- [ ] Confirmar ausência de tráfego e escritas na Azure.
- [ ] Exportar configurações e logs que precisam ser preservados.
- [ ] Excluir recursos pagos não utilizados.
- [ ] Verificar resource groups, IPs, storage, logs e recursos ocultos.
- [ ] Remover secrets e service principals antigos.
- [ ] Desabilitar workflows de deploy da Azure.
- [ ] Conferir Billing da Azure no ciclo seguinte.
- [ ] Atualizar README, arquitetura e documentação de deploy.

## Critério de conclusão

A migração estará concluída quando:

- [ ] frontend estiver servido pela Vercel nos domínios finais;
- [ ] API estiver no Railway e responder corretamente após sleep;
- [ ] banco PostgreSQL estiver no Neon e suspender quando ocioso;
- [ ] dados e totais estiverem reconciliados;
- [ ] login, cookie JWT, CSRF e revogação funcionarem;
- [ ] conta demo, e-mails e integrações funcionarem;
- [ ] operações financeiras persistirem sem regressão;
- [ ] CORS estiver restrito;
- [ ] backups e rollback tiverem sido testados;
- [ ] observabilidade e limites de custo estiverem ativos;
- [ ] Azure não mantiver recursos pagos desnecessários;
- [ ] custo mensal novo estiver registrado.

## Referências oficiais

### Vercel

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Environment variables](https://vercel.com/docs/environment-variables)
- [Adding and configuring a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Rewrites](https://vercel.com/docs/routing/rewrites)

### Railway

- [Plans and pricing](https://docs.railway.com/pricing/plans)
- [Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Health checks](https://docs.railway.com/deployments/healthchecks)
- [Serverless](https://docs.railway.com/deployments/serverless)
- [Cost control](https://docs.railway.com/pricing/cost-control)

### Neon e PostgreSQL

- [Neon pricing](https://neon.com/pricing)
- [Connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Npgsql EF Core provider](https://www.npgsql.org/efcore/)

## Princípio da arquitetura

O frontend deve permanecer acessível imediatamente. API e banco trabalham quando existe uma operação que realmente precisa deles. O plano gratuito é a primeira tentativa, não uma premissa: desempenho, segurança, confiabilidade e custo real determinam a permanência ou o upgrade.
