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
- [ ] Renomear Vercel, Railway e Neon sem recriar recursos.
- [ ] Atualizar URLs públicas, CORS e base URL em ordem coordenada.
- [ ] Validar frontend, API, autenticação, CSRF, demo e consulta ao Neon.
- [ ] Registrar os identificadores finais e encerrar a janela de rollback.

Se o smoke falhar, o rollback deve reapontar URLs e variáveis para os domínios
anteriores e redeployar o commit `f9d2abd`. O banco não entra no rollback porque
nenhuma alteração destrutiva ou de schema faz parte desta etapa.

## E-mail

Brevo e qualquer remetente de produção permanecem desativados. A configuração
só será retomada depois da definição e validação do domínio próprio, incluindo
SPF, DKIM e DMARC.

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
- `GET /health` no novo domínio Railway e a emissão de CSRF pela Vercel
  responderam `200` antes da remoção dos aliases antigos;
- o nome visível do serviço Railway e a promoção do alias Héstia a produção
  pública ainda precisam ser concluídos antes do fechamento do cutover.
