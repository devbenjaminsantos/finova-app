# Transição operacional Finova -> Héstia

Este documento coordena o rebranding técnico depois do redesign. A migração
preserva dados, mantém uma janela de rollback e evita configurar e-mail antes
do domínio definitivo.

## Identidade de destino

| Camada | Destino |
| --- | --- |
| Marca visível | `Héstia` |
| Slug técnico | `hestia` |
| GitHub | `devbenjaminsantos/hestia-app` |
| Vercel | projeto `hestia-app` |
| Railway | projeto `Hestia`, serviço `hestia-api` |
| Neon | projeto `Hestia` |
| Domínio próprio | pendente de definição |

O acento fica restrito à marca visível. URLs, nomes de repositório, serviços,
cookies, eventos, pacotes e chaves locais usam `hestia` sem acento.

## Fronteiras de compatibilidade

- o banco, a branch, as roles e migrations existentes no Neon não serão
  recriados nem renomeados nesta transição; esses identificadores são internos
  e alterar ownership ou connection strings aumenta o risco sem mudar a marca;
- o namespace e assembly `FinanceDashboard.Api` continuam estáveis para evitar
  uma alteração estrutural sem benefício operacional;
- o cookie de autenticação passa a ser `hestia_auth`, mas a API aceita
  temporariamente `finova_auth` e o remove no logout para não derrubar sessões
  durante o primeiro deploy;
- preferências locais passam para chaves `hestia-*`/`hestia:*`, migrando os
  valores antigos uma vez antes de removê-los;
- classes CSS e eventos do frontend passam de `finova-*` para `hestia-*` no
  mesmo build, sem alterar contratos HTTP ou dados;
- documentos arquivados podem citar Finova quando registram fatos históricos.

## Ordem de execução e rollback

- [x] Criar ponto de retorno local antes do rebranding (`f9d2abd`).
- [x] Remover automações Azure obsoletas para impedir deploy paralelo.
- [x] Migrar identidade no código, configurações e documentação ativa.
- [x] Validar testes do frontend e API, build de produção e Docker.
- [x] Publicar o commit no repositório atual.
- [x] Renomear o repositório para `hestia-app` e atualizar o remote local.
- [x] Renomear Vercel, Railway e Neon sem recriar recursos.
- [x] Atualizar URLs públicas, CORS e base URL em ordem coordenada.
- [x] Validar frontend, API, autenticação, CSRF, demo e consulta ao Neon.
- [x] Registrar os identificadores finais e encerrar a janela de rollback.

Durante o cutover, uma falha de smoke permitiria reapontar URLs e variáveis e
redeployar o commit `f9d2abd`. Com a validação concluída e o alias Finova
removido, um rollback futuro deve partir desse commit e recriar explicitamente
os apontamentos necessários. O banco não entra no rollback porque nenhuma
alteração destrutiva ou de schema fez parte desta etapa.

## E-mail

O Resend pela API HTTPS foi escolhido como alvo para os e-mails transacionais,
substituindo o plano anterior de Brevo por SMTP. Qualquer remetente de produção
permanece desativado: conta, chave, webhook e DNS só serão configurados depois
da definição do domínio próprio. A implementação, os cuidados com cold start,
idempotência, SPF, DKIM e DMARC estão em
[`EMAIL_DELIVERY_ROADMAP.md`](EMAIL_DELIVERY_ROADMAP.md).

## Evidências locais de 2026-08-31

- lint do frontend aprovado;
- build Vite de produção aprovado;
- 35 arquivos e 129 testes do frontend aprovados;
- API compilada e 92 de 93 testes aprovados;
- a falha restante, em
  `TransactionsControllerTests.Import_RejectsMoreThanMaximumItemsWithoutPersistingTransactions`,
  também falhou isoladamente e está em arquivo não alterado pelo rebranding;
- o build Docker resolveu as imagens e chegou ao `dotnet publish`, mas foi
  interrompido depois de seis minutos sem progresso; o build da Railway será o
  gate da imagem de produção.

## Evidências de infraestrutura de 2026-08-31

- GitHub preservou o repositório de ID `1160143836` em
  `devbenjaminsantos/hestia-app`;
- Vercel preservou o projeto `prj_P1glSeFVr9lIK3ZdRtR0cMAzZjD2` com o nome
  `hestia-app` e acompanhou o repositório renomeado pelo ID;
- Railway preservou projeto, ambiente, serviço e variáveis; o projeto passou a
  `Hestia`, a origem passou a `devbenjaminsantos/hestia-app` e o domínio do
  serviço passou a `hestia-api-production.up.railway.app`;
- o deploy Railway `9332fbda-042f-4bdd-9d0b-c8099c542d1d`, referente ao commit
  `2010289`, terminou em `SUCCESS`;
- Neon preservou o projeto `quiet-band-28264410`, PostgreSQL 17, branch, banco,
  roles e connection strings, alterando somente o nome visível para `Hestia`;
- o deploy Railway `f55eaf33-10cf-40c1-9353-e967dec79606`, referente ao commit
  `02aac74`, terminou em `SUCCESS` depois da atualização de CORS e
  `Client__BaseUrl`; projeto e serviço aparecem como `Hestia` e `hestia-api`;
- a produção Vercel usa `hestia-app-benjamin-santos.vercel.app`; login e CSRF
  responderam `200`, enquanto previews e URLs imutáveis de deploy exigem SSO;
- o alias `finova-app-six.vercel.app` foi removido e passou a responder `404`;
- URLs históricas de deploy com o nome Finova foram preservadas para auditoria
  e rollback, mas deixaram de ser públicas e respondem com redirecionamento SSO;
- o link público do repositório GitHub aponta para a produção Héstia;
- o preflight da API respondeu `204` para a nova origem, com credenciais e
  cabeçalhos CSRF permitidos;
- um smoke real criou uma sessão demo isolada, confirmou perfil e cinco
  transações persistidas no Neon e encerrou a sessão com `204`;
- o Neon confirmou o projeto `Hestia` (`quiet-band-28264410`) em PostgreSQL 17;
  banco e roles internos permaneceram estáveis conforme a fronteira definida;
- nove cenários Playwright de login, cadastro, rotas protegidas, desktop e
  mobile passaram; o cenário de PDF também passou com dados e inspeção visual;
- Resend e notificações por e-mail continuam desativados até o domínio próprio;
  nenhum secret ou recurso remoto do provedor foi criado nesta decisão.
