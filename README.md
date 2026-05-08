# Finova

Aplicacao full stack para controle financeiro pessoal, com autenticacao, graficos financeiros, metas mensais, exportacao de relatorios e deploy em producao no Azure.

O projeto foi pensado para evoluir de um painel financeiro simples para um produto com cara de SaaS: conta demo, recuperacao de senha, confirmacao de e-mail, monitoramento basico, historico e estrutura pronta para expansao.

## Visao Geral

O Finova permite:

- criar conta e fazer login com JWT
- confirmar e-mail no cadastro
- recuperar senha por e-mail
- usar uma conta demo com dados prontos
- cadastrar, editar e remover transacoes
- acompanhar receitas, despesas e saldo
- definir metas mensais de gasto
- receber alertas visuais e insights automaticos
- exportar transacoes em CSV e PDF
- alternar entre tema claro e escuro
- registrar logs de auditoria para acoes sensiveis

## Stack

### Front-End

- React 19
- Vite
- React Router
- Bootstrap 5
- Recharts

### Back-End

- ASP.NET Core 10
- Entity Framework Core 10
- JWT Bearer Authentication
- SQL Server
- Scalar.AspNetCore

### Testes

- xUnit
- EF Core InMemory
- Microsoft.NET.Test.Sdk
- Vitest
- Testing Library
- Playwright

### Infraestrutura

- Azure Static Web Apps
- Azure App Service
- Azure SQL Database
- Azure Communication Services Email
- Application Insights

## Funcionalidades Entregues

### Autenticacao e seguranca

- cadastro com validacao de e-mail
- login com JWT
- bloqueio de login para contas nao confirmadas
- reenvio de e-mail de confirmacao
- recuperacao de senha com token de uso unico
- redefinicao de senha
- tela de perfil com alteracao de nome e senha
- bloqueio temporario apos excesso de tentativas invalidas de login
- politica de senha fortalecida
- gerenciamento de sessao com expiracao, inatividade e retorno para rota protegida

### Experiencia de produto

- conta demo com dados prontos para exploracao
- onboarding inicial com opt-in
- area de graficos com resumo financeiro
- filtro por periodo na area de graficos
- comparativo entre meses
- insights automaticos
- insights prescritivos
- tema claro e escuro
- mensagens de erro e sucesso revisadas

### Gestao financeira

- cadastro de receitas e despesas
- categorias separadas para receita e despesa
- filtros por texto, tipo, categoria, mes e ordenacao
- metas mensais gerais e por categoria
- expansao das metas por categoria com navegacao mensal e sugestoes automaticas
- alerta visual de gasto
- gastos recorrentes mensais
- alertas de meta por e-mail
- resumo mensal automatico por e-mail

### Relatorios e rastreabilidade

- exportacao de transacoes em CSV
- exportacao de transacoes em PDF sem depender da impressao do navegador
- logs de auditoria para fluxos sensiveis
- tela de historico no frontend

### Qualidade e operacao

- testes automatizados para autenticacao
- testes automatizados para transacoes
- testes automatizados de frontend com Vitest
- suite E2E inicial com Playwright
- monitoramento basico configurado no Azure

## Estrutura do Projeto

```text
finance-dashboard-react/
|-- client/                          # Frontend React/Vite
|-- server/
|   |-- FinanceDashboard.Api/        # API ASP.NET Core
|   |-- docker-compose.yml           # SQL Server local via Docker
|   `-- .env.example                 # Exemplo para o banco local
|-- tests/
|   `-- FinanceDashboard.Api.Tests/  # Testes automatizados do backend
|-- docs/
|   `-- azure-deploy.md              # Guia de deploy e infraestrutura Azure
`-- finance-dashboard-react.sln
```

## Ambiente de Producao

Estado atual da publicacao:

- front-end: `Azure Static Web Apps`
- back-end: `Azure App Service`
- banco: `Azure SQL Database`

Links atuais:

- front-end: `https://polite-ground-038630210.2.azurestaticapps.net`
- health da API: `https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/health`

O dominio customizado planejado para a proxima etapa e `finovawallet`.

## Como Rodar Localmente

### 1. Banco de dados

Crie o arquivo `server/.env` com base em `server/.env.example` e defina:

```env
SA_PASSWORD=SuaSenhaForteAqui
```

Depois suba o SQL Server local:

```powershell
cd server
docker compose up -d
```

### 2. Back-End

Voce pode configurar a API local de duas formas:

- usando variaveis de ambiente
- usando um arquivo local ignorado pelo Git, como `appsettings.Development.local.json`

Variaveis esperadas:

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
- `Pluggy__ClientId`
- `Pluggy__ClientSecret`

Se preferir, use o arquivo de exemplo `server/FinanceDashboard.Api/appsettings.Development.local.example.json` como base para montar seu `appsettings.Development.local.json`.

Exemplo de execucao:

```powershell
cd server/FinanceDashboard.Api
dotnet run
```

A API sobe, por padrao, em:

```text
http://localhost:5278
```

### 3. Front-End

```powershell
cd client
npm install
npm run dev
```

O front-end sobe, por padrao, em:

```text
http://localhost:5173
```

## Banco e Migrations

Para aplicar as migrations:

```powershell
cd server/FinanceDashboard.Api
dotnet ef database update
```

Esse passo e necessario sempre que entrar uma nova migration, por exemplo em:

- recuperacao de senha
- confirmacao de e-mail
- metas mensais
- logs de auditoria
- protecao contra tentativas de login

## Testes Automatizados

Para rodar a suite do backend:

```powershell
dotnet test tests/FinanceDashboard.Api.Tests/FinanceDashboard.Api.Tests.csproj
```

Para rodar a suite do frontend:

```powershell
cd client
npm test
```

Para rodar os testes E2E:

```powershell
cd client
npm run test:e2e
```

Atualmente os testes cobrem:

- autenticacao
- confirmacao de e-mail
- recuperacao e redefinicao de senha
- fluxo de transacoes
- protecao por usuario nas operacoes de transacao
- helpers de sessao, storage e exportacao
- area de graficos e modal de transacoes
- smoke tests com Playwright para rotas publicas e protecao de rotas

## Configuracoes Importantes

### Front-End

No deploy, o front-end espera:

- `VITE_API_URL`

Exemplo:

```text
https://finova-api-b9g4bpcadyegheed.brazilsouth-01.azurewebsites.net/api
```

### Back-End

No App Service, as configuracoes principais sao:

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

### Integracao bancaria com Pluggy

Para habilitar a conexao bancaria real da V5:

- configure `Pluggy__ClientId`
- configure `Pluggy__ClientSecret`
- cadastre uma conta financeira com provedor `Pluggy`
- use o botao `Conectar com Pluggy`
- conclua a conexao no widget do Pluggy
- depois execute `Sincronizar` para importar as transacoes no Finova

Em `Connection Strings`, a API usa:

- `Default`

## Conta Demo

O projeto inclui uma conta demo para exploracao rapida do produto.

Objetivo:

- permitir avaliacao sem cadastro
- demonstrar graficos, categorias, metas, filtros e relatorios
- acelerar apresentacoes e validacoes

O fluxo da demo usa a mesma sessao JWT da conta real, o que ajuda a validar o comportamento do app sem excecoes artificiais no front-end.

## Documentacao Complementar

Guias extras:

- deploy e infraestrutura Azure: [docs/azure-deploy.md](/c:/Users/user/Desktop/Dashboard%20Financeiro/finance-dashboard-react/docs/azure-deploy.md)

## Observacoes de Seguranca

- segredos nao devem ser versionados
- o arquivo local de configuracao do back-end deve permanecer fora do Git
- a senha do SQL deve ser mantida apenas em ambiente seguro
- o fluxo de recuperacao de senha nao deve expor o link de redefinicao em producao aberta
- a sessao deve ser invalidada quando o token expirar ou quando houver inatividade prolongada

## Planejamento Tecnico da V6

Antes de avancar para a V6, vale tratar a etapa como uma evolucao estrutural do produto, nao apenas como um conjunto de telas novas. A base atual ja cobre autenticacao, transacoes, contas financeiras, metas, recorrencias simples, importacao e envio de e-mails, mas a maior parte das ideias da V6 exige revisar modelo de dados, automacao e regras de negocio.

### O que o projeto ja tem e pode ser reaproveitado

- `Transaction` ja possui:
  - `FinancialAccountId`
  - `Source`
  - `SourceReference`
  - `ImportedAtUtc`
  - `IsRecurring`
  - `RecurrenceEndDate`
  - `RecurrenceGroupId`
- `FinancialAccount` ja cobre:
  - provedor
  - instituicao
  - nome da conta
  - mascara
  - sincronizacao e vinculacao com agregador
- existe envio de e-mail via `IEmailSender` e `SmtpEmailSender`
- o envio agora pode usar `SmtpEmailSender` ou `AzureCommunicationServicesEmailSender`, conforme `Email:Provider`
- existe historico de acoes sensiveis com `AuditLog`
- existe base de filtros, importacao, exportacao e conciliacao de transacoes no frontend
- existe i18n inicial, o que ajuda bastante em recursos compartilhaveis e notificacoes futuras

### O que precisa ser refatorado antes das features da V6

- `Transaction` hoje acumula responsabilidades de:
  - lancamento manual
  - importacao
  - recorrencia simples
  - sincronizacao bancaria
- recorrencia atual funciona como geracao imediata de serie no `TransactionsController`
  - isso nao atende recorrencia automatica real, com geracao mensal sem intervencao
- `FinancialAccount` ainda nao diferencia de forma explicita:
  - conta corrente
  - carteira
  - dinheiro fisico
  - cartao de credito
  - conta de passagem
- `IEmailSender` hoje cobre apenas:
  - redefinicao de senha
  - confirmacao de e-mail
  - alerta de meta mensal
  - relatorio mensal automatico
- a infraestrutura inicial de agendamento ja existe com worker hospedado e controle de entregas
- ainda vale evoluir monitoramento, retry e operacao para workloads maiores

### O que precisa ser criado do zero

#### Gestao financeira avancada

- `FinancialAccountType` ou campo equivalente para diferenciar:
  - banco
  - carteira
  - dinheiro
  - cartao de credito
  - conta manual
- transferencias entre contas com tratamento proprio
- entidade para parcelamentos e dividas
  - ex.: `InstallmentPlan`, `InstallmentPayment`, `DebtPlan`
- tags livres por usuario
  - ex.: `TransactionTag` e tabela de associacao `TransactionTagLink`
- regra recorrente real
  - ex.: `RecurringRule`
- modulo de previsao futura
  - ex.: `CashFlowForecastSnapshot` ou servico dedicado de forecast

#### Notificacoes e alertas proativos

- preferencias de notificacao por usuario
  - ex.: `NotificationPreference`
- historico de notificacoes enviadas
  - ex.: `NotificationDelivery`
- gerador de relatorio mensal
- links publicos compartilhaveis com token e expiracao
  - ex.: `SharedDashboardLink`

### Checklist tecnico por iniciativa

#### 1. Contas e carteiras separadas

Precisa revisar:

- adicionar tipo da conta no backend e no frontend
- revisar tela de contas para mostrar natureza da conta
- decidir se cartao de credito entra como conta, passivo ou ambos
- criar fluxo de transferencia entre contas sem duplicar saldo

Dependencias:

- migration nova
- ajustes em `FinancialAccountsController`
- ajustes em importacao e sincronizacao bancaria
- filtro por conta na pagina de transacoes e nos dashboards

#### 2. Dividas e parcelamentos

Precisa revisar:

- se cada parcela vira transacao persistida ou projeção derivada
- como mostrar saldo restante, parcela atual e parcela futura
- como relacionar parcelamento com conta/cartao e categoria

Precisa criar:

- entidade principal de parcelamento
- endpoint proprio
- UI dedicada
- impacto em dashboard, comparativos e metas

Risco atual:

- tentar encaixar parcelamento apenas em `Transaction` tende a deixar a modelagem fragil

#### 3. Tags livres nas transacoes

Precisa revisar:

- se tags sao totalmente livres por usuario
- se tera autocomplete e deduplicacao por nome
- como isso afeta filtros, importacao e exportacao

Precisa criar:

- entidade de tag
- relacao N:N entre transacao e tag
- filtro por tags
- exibicao de tags em tabela, modal e exportacao

#### 4. Recorrencias automaticas reais

Estado atual:

- hoje a recorrencia e gerada no momento da criacao, com serie fechada

Para a V6:

- substituir ou complementar essa abordagem por regras recorrentes persistidas
- executar geracao automatica periodica
- garantir idempotencia para nao gerar duplicados
- tratar excecoes:
  - pausa
  - encerramento
  - exclusao de uma ocorrencia isolada

Precisa criar:

- `RecurringRule`
- job agendado
- logs de execucao
- possivel tabela de ocorrencias geradas

#### 5. Planejamento futuro com previsao

Precisa revisar:

- se a previsao inicial sera:
  - media simples dos ultimos meses
  - media ponderada
  - mistura entre recorrencias futuras e historico recente
- como separar previsao confiavel de chute exploratorio

Precisa criar:

- servico de forecast
- cards ou pagina propria de previsao
- indicacao visual de confianca

Dependencia forte:

- recorrencias e contas bem modeladas melhoram muito a qualidade da previsao

#### 6. Alerta por e-mail ao atingir percentual da meta

Estado atual:

- usuario ja pode ativar alertas por e-mail no perfil
- o processamento automatico ja avalia metas do mes
- o envio ja registra `NotificationDelivery` para evitar duplicidade

Ainda pode evoluir:

- em qual percentual dispara
- se dispara uma vez por mes ou varias vezes
- quais metas entram:
  - geral
  - por categoria
  - ambas

#### 7. Relatorio mensal automatico

Estado atual:

- usuario ja pode ativar o resumo mensal no perfil
- o worker automatico ja envia o resumo do mes anterior
- o historico de envios fica salvo para consulta no sistema

Ainda pode evoluir:

- quando roda exatamente:
  - primeiro dia do mes
  - horario fixo
  - timezone do usuario ou timezone do servidor
- o que entra no resumo:
  - total de receitas
  - total de despesas
  - economia
  - metas batidas ou estouradas
  - categorias de maior peso

#### 8. Dashboard publico compartilhavel via link

Decisoes tomadas:

- o painel publico fica em modo somente leitura
- o link pode ser desativado manualmente pelo usuario no Perfil
- a visualizacao publica mostra resumo e graficos, sem acesso a area autenticada
- o token do link e assinado no backend

Entregue:

- token de compartilhamento
- endpoint publico somente leitura
- tela publica separada
- camada de seguranca para nao reaproveitar o dashboard autenticado sem filtros

Maior cuidado da V6:

- essa e a feature mais sensivel em privacidade e deve entrar por ultimo

### Infraestrutura que precisa ser decidida antes de comecar

Para a V6, o projeto passa a precisar de execucao automatica e agendada. Antes de implementar, decidir:

- `Hangfire`, `Quartz.NET`, `BackgroundService` ou cron externo
- estrategia de retry
- estrategia de idempotencia
- onde registrar falhas
- como monitorar jobs em producao

Sem isso, as features de recorrencia automatica, alerta por e-mail e relatorio mensal tendem a ficar instaveis.

### Ordem recomendada de implementacao

Para reduzir retrabalho, a V6 pode seguir esta ordem:

1. tipagem real de contas e carteiras
2. tags livres nas transacoes
3. dividas e parcelamentos
4. recorrencias automaticas reais
5. previsao futura
6. alerta por e-mail ligado a metas
7. relatorio mensal automatico
8. dashboard publico compartilhavel

### Status recomendado da V6 no backlog

#### Pronto para detalhar

- contas e carteiras separadas
- tags livres nas transacoes

#### Precisa fechar regra de negocio antes

- dividas e parcelamentos
- recorrencias automaticas reais
- planejamento futuro com previsao

#### Precisa fechar infraestrutura antes

- dashboard publico compartilhavel via link

#### Precisa fechar seguranca e privacidade antes

- dashboard publico compartilhavel via link

## Checklist por Versao

### V1

- [x] Deploy completo no Azure
- [x] Autenticacao base com JWT
- [x] Perfil do usuario
- [x] Conta demo
- [x] Recuperacao de senha
- [x] Confirmacao de e-mail
- [x] Area inicial de graficos
- [x] Metas mensais
- [x] Exportacao em CSV e PDF
- [x] Monitoramento basico

### V2

- [x] Melhorias de UX no fluxo de autenticacao
- [x] Estados de loading e feedback visual mais claros
- [x] Refinamento da conta demo
- [x] Filtros por periodo na area de graficos
- [x] Metas mensais por categoria
- [x] Alerta de gastos
- [x] Logs de auditoria no backend
- [x] Testes automatizados do backend
- [x] Tema claro e escuro

### V3

- [x] Tela de auditoria no frontend
- [x] Comparativo entre meses
- [x] Insights automaticos
- [x] Insights prescritivos
- [x] Onboarding inicial com opt-in
- [x] Gastos recorrentes
- [x] Expansao das metas por categoria
- [x] Testes de frontend com Vitest
- [x] Suite inicial E2E com Playwright
- [x] Protecao contra tentativas de login
- [x] Politica de senha fortalecida
- [x] Gerenciamento de sessao

### V4

- [x] Otimizar a pagina de auditoria para mostrar apenas eventos mais relevantes
- [x] Renomear Auditoria para Historico
- [x] Separar graficos, insights, comparativos e metas em paginas proprias
- [x] Ocultar automaticamente o mini tutorial quando ele for concluido
- [x] Criar uma Home personalizavel, com widgets escolhidos pelo usuario
- [x] Melhorar a exportacao em PDF sem depender da impressao/extensao do navegador

### V5

- [ ] Suporte a multiplos idiomas
- [x] Integracao bancaria manual inicial
- [x] V5.1 Importacao manual via CSV
- [x] V5.2 Importacao manual via OFX
- [x] V5.3 Tela de revisao antes da confirmacao da importacao
- [x] V5.4 Conciliacao de transacoes importadas com transacoes manuais
- [x] V5.5 Categorizacao assistida para lancamentos importados
- [x] V5.6 Preparar arquitetura para integracao automatica com Open Finance/agregador
- [x] V5.7 Sincronizacao automatica com conta bancaria
- [x] 2FA descartado nesta etapa para manter o produto mais enxuto
- [ ] Dominio customizado como fechamento final da experiencia

### V6

- [x] Contas e carteiras separadas por tipo
- [x] Tags livres nas transacoes
- [x] Dividas e parcelamentos com saldo por parcela
- [x] Parcelamento basico com geracao de parcelas mensais, identificacao por grupo e edicao/remocao em lote
- [x] Recorrencias automaticas reais com geracao mensal
- [x] Planejamento futuro com previsao baseada em historico
- [x] Alerta por e-mail ao atingir percentual da meta
- [x] Relatorio mensal automatico no primeiro dia do mes
- [x] Dashboard publico compartilhavel via link somente leitura

## Autor

Benjamin Montenegro
