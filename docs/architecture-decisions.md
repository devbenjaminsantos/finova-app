# Decisões de Arquitetura

Este documento registra decisões importantes do Héstia. A ideia é manter o contexto vivo: não apenas o que foi feito, mas também por que foi feito desse jeito.

## README como porta de entrada

O README principal fica em inglês para facilitar leitura internacional e apresentação pública do projeto. A versão em português fica em `README-pt-BR.md`.

Informações extensas sobre planejamento, versões e raciocínio técnico ficam em `docs/`. Isso mantém o README direto e evita que a primeira leitura vire um documento longo demais.

## Frontend e backend separados

O projeto mantém frontend React/Vite e backend ASP.NET Core em diretórios separados.

Motivos:

- permitir deploy independente entre interface e API
- manter responsabilidades claras
- facilitar testes e configuração local
- permitir que o frontend aponte para diferentes APIs por ambiente

## Rewrite `/api` como contrato de produção

Em produção, a Vercel encaminha `/api/*` para a Railway conforme
`vercel.json`. O frontend usa esse caminho relativo por padrão, preservando
cookies e evitando expor um host de API no bundle.

`VITE_API_URL` permanece opcional para ambientes que precisam chamar uma API
diretamente e deve sempre terminar em `/api`. Ele é incorporado no build do
Vite e nunca deve conter segredo.

## PostgreSQL em produção e migrations separadas

O runtime de produção usa PostgreSQL no Neon. SQL Server permanece apenas como
compatibilidade para desenvolvimento local e para o histórico de migrations
arquivado.

A API usa `ConnectionStrings__Default` com privilégio mínimo. Migrations
controladas usam `ConnectionStrings__Migration`, uma conexão administrativa
separada, habilitada apenas durante um deploy de schema. Isso limita o impacto
de uma credencial de runtime e evita conceder DDL ao serviço web.

## JWT, confirmação de e-mail e recuperação de senha

A autenticação usa JWT para manter o frontend desacoplado da API. Confirmação de e-mail e recuperação de senha foram adicionadas para aproximar o produto de um fluxo SaaS real.

Impactos:

- os fluxos de autenticação dependem de configuração correta de e-mail
- tokens e URLs públicas precisam respeitar o ambiente atual
- ações sensíveis devem continuar registradas em auditoria

## Provedor de e-mail abstraído

Os fluxos de negócio dependem de `IEmailSender`. O runtime registra
`DisabledEmailSender` enquanto `Email__Enabled=false`, `BrevoEmailSender` quando
a Brevo é selecionada e `ResendEmailSender` apenas como contingência inativa.
Os adapters ativos usam APIs HTTPS; o adapter SMTP legado e a dependência
direta do Azure Communication Services Email permanecem removidos. O envio
continua na API ASP.NET Core da Railway.

Motivos:

- usar o mesmo contrato em desenvolvimento e produção
- evitar acoplamento do domínio a um SDK de nuvem
- permitir trocar o provedor sem reescrever os fluxos de negócio
- manter chave, tokens e regras de envio fora do frontend e da Vercel
- aproveitar timeout, resposta estruturada, webhooks e idempotência da API do
  provedor

Impactos:

- o modo desativado precisa inicializar sem credenciais e sem simular entrega
- chave, remetente e segredo de webhook precisam existir somente na Railway
- falhas de envio não devem invalidar links anteriores ainda válidos
- aceite do provedor e entrega real são estados distintos
- a entrega real precisa ser validada depois de cada mudança de infraestrutura

O detalhamento e a ordem de ativação estão em
[`EMAIL_DELIVERY_ROADMAP.md`](EMAIL_DELIVERY_ROADMAP.md).

## Contas financeiras como camada central

Contas financeiras não são apenas um filtro visual. Elas formam uma camada importante para saldo, transferências, importações e futuras integrações de Open Finance.

Impactos:

- transações devem preservar vínculo com conta quando aplicável
- filtros por conta precisam ser consistentes em dashboard, listas e relatórios
- integrações externas devem manter rastreabilidade da conta de origem

## Importação com revisão

Importações devem favorecer revisão humana antes da consolidação dos dados.

Motivos:

- reduzir risco de duplicidade
- evitar categorias incorretas sem contexto
- permitir correção antes de afetar relatórios, metas e previsões

## Recorrências e parcelas com idempotência

Lançamentos recorrentes e compras parceladas exigem cuidado para não gerar registros duplicados.

Direção:

- preservar metadados que identifiquem origem, regra e competência
- tratar geração automática como operação idempotente
- deixar claro quando um lançamento é real, previsto ou derivado

## Insights e metas baseados em transações

Metas, alertas e insights são derivados das transações registradas. Isso mantém a leitura financeira auditável e evita indicadores desconectados da base real.

Impactos:

- alterações em transações podem mudar metas, gráficos e alertas
- filtros de período precisam ser consistentes
- mensagens prescritivas devem explicar a causa do insight

## Painel público somente leitura

O painel público existe para compartilhamento controlado sem autenticação direta do visitante.

Direção:

- usar tokens específicos para compartilhamento
- manter o escopo de dados reduzido
- permitir revogação ou rotação do acesso
- evitar qualquer ação de escrita por esse fluxo

## Auditoria com foco em eventos relevantes

A auditoria deve registrar eventos sensíveis e úteis para diagnóstico, mas evitar excesso de ruído técnico.

Motivos:

- facilitar investigação de alterações importantes
- proteger a leitura operacional contra logs irrelevantes
- separar logs técnicos de eventos de negócio quando possível
