# Héstia - roadmap de redesign e rebranding

Este documento transforma o `Hestia_UI_UX_Spec_v1.pdf` em uma trilha de
implementação incremental para o frontend atual. O spec continua sendo a fonte
de verdade visual e conceitual; este roadmap registra impacto técnico, ordem de
execução e critérios de aceite.

## Estado atual

- [x] Revisar as 13 páginas do spec.
- [x] Mapear rotas, componentes, estilos, i18n e contratos preservados.
- [ ] Criar a identidade gráfica de Héstia.
- [x] Iniciar a migração visual do frontend pela fundação da Etapa 1.

O ambiente publicado continua apresentando a marca Finova. O checkout local já
contém um protótipo parcial de rebranding para Héstia, mas ele ainda não
representa uma etapa concluída: símbolo, favicon e parte dos testes ainda não
estão alinhados. Essas alterações devem permanecer tratadas como exploração até
o gate da Etapa 0 ser aprovado.

## Contratos preservados

O redesign não deve alterar, nesta etapa:

- API, banco de dados e regras financeiras;
- autenticação, cookies, sessão e antiforgery;
- `TransactionsProvider` e clientes HTTP;
- analytics, formatadores, importação e exportação;
- Recharts e modelos de dados existentes;
- i18n, dark mode e rotas públicas;
- namespaces `FinanceDashboard.Api`, eventos e classes internas `finova-*` que
  ainda forem úteis durante a migração.

Toda alteração de texto visível deve manter paridade entre PT-BR e inglês.

Também devem permanecer verdadeiros durante todo o redesign:

- JWT apenas em cookie `HttpOnly`, com versão de sessão validada no banco;
- antiforgery nas operações mutáveis e CORS restrito a origens explícitas;
- consultas e mutações sempre limitadas ao usuário autenticado;
- token do dashboard público aleatório, revogável e persistido somente como hash;
- imagem da API executada sem privilégios de root;
- coordenação idempotente de notificações mantida no banco.

## Baseline técnico confirmado

Arquitetura publicada observada antes do redesign:

```text
GitHub
  |-- frontend React/Vite --> Vercel
  |                            `-- /api/* --> Railway
  `-- API ASP.NET Core ------> Railway --> Neon PostgreSQL
```

Evidências da baseline:

- [x] frontend público respondeu `200` na Vercel;
- [x] `/health` e emissão de token CSRF responderam `200` na Railway;
- [x] uma consulta pública inválida e sem dados reais percorreu
  Vercel -> Railway -> Neon e retornou `404` sem cache;
- [x] CORS aceitou a origem da Vercel e não refletiu uma origem arbitrária;
- [x] headers CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` e `Permissions-Policy` estão presentes no frontend;
- [x] 89 testes da API passaram;
- [x] lint, build e 6 smokes E2E públicos do frontend passaram;
- [x] restaurar a suíte unitária do frontend para verde: após a Etapa 2, os 101
  testes passaram sem timeouts ou divergências determinísticas;
- [x] auditorias npm e NuGet não encontraram vulnerabilidades conhecidas na
  baseline analisada.

## Mapa do frontend atual

| Atual | Direção Héstia |
| --- | --- |
| `components/Navbar.jsx` | `layout/AppShell`, `Sidebar`, `Topbar` e navegação mobile |
| `components/BrandMark.jsx` | símbolo, wordmark e variações Héstia |
| `index.css` | tokens, globais e estilos de componentes separados gradualmente |
| `pages/Home.jsx` | tela-piloto da nova linguagem visual |
| `pages/Dashboard.jsx` e `/graficos` | visualizações incorporadas a `/analises` |
| `BudgetGoalsSection` | base da nova área `/planejamento` |
| `pages/Transactions.jsx` | lista densa e criação rápida com progressive disclosure |
| `pages/FinancialAccounts.jsx` | área Contas dentro do novo shell |
| `translations.js` | rebranding visível e nova arquitetura em PT-BR e inglês |

Rotas antigas devem continuar funcionando por redirecionamento durante e após a
migração. Nenhuma etapa pode quebrar links de confirmação, redefinição de senha
ou dashboard público.

## Etapa 0 - identidade gráfica

- [ ] Explorar símbolos abstratos derivados de lar, centro e chama.
- [ ] Escolher uma direção sem deusa, templo, mascote ou avatar.
- [ ] Validar legibilidade do símbolo em 16 px.
- [x] Produzir símbolo, wordmark, versões horizontal e compacta.
- [ ] Produzir variações para fundos light e dark.
- [x] Gerar favicon e ícones necessários ao frontend.
- [x] Atualizar `BrandMark`, metadados e textos visíveis PT-BR/inglês.
- [ ] Substituir o losango textual provisório por um ativo aprovado.
- [x] Remover ou substituir os favicons e logos antigos da Finova.
- [ ] Definir a grafia oficial da marca, incluindo uso de acento em português e
  inglês, nomes de arquivo e metadados.
- [ ] Interromper trocas globais adicionais de Finova para Héstia até a direção
  visual ser escolhida.
- [ ] Decidir quais identificadores técnicos `finova-*` permanecem internos para
  evitar uma renomeação mecânica arriscada.

**Gate:** a marca precisa funcionar no login, no futuro sidebar e como favicon
antes da troca global de Finova para Héstia.

**Evidência do primeiro incremento (2026-08-27):**

- o asset fornecido foi otimizado não destrutivamente em
  `client/src/assets/icone/hestia-mark-optimized.webp` e passou a alimentar o
  `BrandMark` no login, áreas públicas e shell autenticado; o PNG original foi
  preservado como fonte;
- a versão compacta do favicon simplifica casa, barras de crescimento e curva
  ascendente do mesmo asset para 16 px, sem reutilizar o antigo favicon da
  Finova;
- o losango provisório foi removido do código, mas o item de aprovação visual
  permanece aberto até a confirmação explícita da direção de marca;
- a grafia continua `Héstia` em PT-BR e inglês. Nome técnico, nomes de arquivos
  e metadados finais continuam pendentes de aprovação da identidade.
- a versão otimizada tem 27 kB, transparência real e cantos transparentes
  validados, substituindo o custo de cerca de 852 kB do PNG original. Lint, dois
  testes de `BrandMark`, build e nove smokes Playwright passaram.

## Etapa 1 - fundação visual

- [x] Adotar Manrope com fallback local seguro.
- [x] Corrigir a divergência atual em que o HTML carrega Manrope, mas o CSS ainda
  declara Inter.
- [x] Criar tokens light com warm white, ink, sage e cores semânticas.
- [x] Criar tokens dark naturais e equivalentes.
- [x] Remover gradientes, glows e sombras decorativas da fundação.
- [x] Definir spacing, bordas, raios de até 8 px e elevação discreta.
- [ ] Definir foco visível e contraste acessível para todos os controles.
- [x] Respeitar `prefers-reduced-motion`.
- [x] Manter letter spacing em `0`.
- [x] Garantir que a aparência validada seja reproduzível apenas a partir dos
  arquivos-fonte; screenshots ou bundles antigos não contam como evidência.
- [x] Regerar screenshots light/dark depois de um build limpo e manter apenas os
  artefatos exigidos para revisão.

**Evidência do primeiro incremento (2026-08-26):**

- `npm run lint`, `npm run build` e os seis smokes Playwright passaram;
- screenshots foram regenerados para login desktop light/dark, cadastro mobile
  light e Home autenticada mobile dark, sem versionar artefatos temporários;
- as quatro renderizações não apresentaram overlay, erro de console ou overflow
  horizontal;
- os contrastes principais medidos ficaram entre `5.38:1` e `15.24:1`, e os
  botões primários ficaram acima de `6.4:1` nos dois temas;
- a suíte unitária permaneceu fora do gate: 93 de 100 testes passaram, com seis
  timeouts funcionais e uma expectativa antiga `finova-transacoes` divergindo do
  nome atual `hestia-transacoes`;
- a auditoria de foco e contraste em todos os tipos de controle e em todas as
  rotas permanece pendente antes de encerrar a etapa.

**Gate:** login, cadastro e uma página autenticada devem permanecer legíveis e
operantes nos dois temas, em desktop e mobile.

## Etapa 2 - app shell

- [x] Criar `AppShell`, `Sidebar`, `Topbar` e `PageHeader`.
- [x] Usar sidebar permanente no desktop, com aproximadamente 240 px.
- [x] Mover perfil e preferências para o rodapé da sidebar.
- [x] Criar navegação inferior mobile com ação central de nova transação.
- [x] Manter áreas públicas e de autenticação fora do shell autenticado.
- [x] Adotar ícones Lucide com tooltips quando o significado não for óbvio.
- [x] Remover a navbar horizontal sem alterar auth ou carregamento de rotas.

**Evidência de conclusão (2026-08-27):**

- `AppShell` mantém sidebar e topbar montados durante o carregamento lazy das
  páginas, evitando o salto de layout entre rotas;
- o sidebar mediu 240 px no desktop e a navegação inferior mobile preservou
  cinco alvos, com a ação central abrindo o modal existente de nova transação;
- login, cadastro, recuperação de senha e dashboard compartilhado permanecem
  no `PublicLayout`, fora do shell autenticado;
- rota ativa, navegação por teclado, tema, idioma, logout, proteção de rotas e
  responsividade passaram em nove smokes Playwright;
- `npm run lint`, `npm run build` e os 101 testes unitários passaram;
- cinco renderizações reais cobriram desktop/mobile, light/dark, menu expandido,
  modal de transação e login público, sem erro de console ou overflow horizontal;
- o frontend foi o único subsistema alterado: API, banco e Brevo permaneceram
  deliberadamente fora deste incremento.

**Gate:** navegação por teclado, rota ativa, logout, idioma, tema e responsividade
devem funcionar sem sobreposição ou salto de layout.

## Etapa 3 - Home como tela-piloto

- [x] Criar hero financeiro com saldo, entradas, saídas e resultado.
- [x] Destacar uma visualização principal de evolução financeira.
- [x] Criar assinatura contextual `Héstia percebeu` sem depender de IA.
- [x] Exibir categorias de maior gasto com hierarquia comparável.
- [x] Resumir planejamento e atividade recente no canvas da página.
- [x] Reduzir cards a agrupamentos ou ações que realmente precisam de moldura.
- [x] Preservar estados demo, vazio, carregamento, erro e onboarding.

**Evidência do primeiro incremento (2026-08-27):**

- o topo da Home agora reúne saldo registrado, entradas, saídas e resultado do
  período selecionado, mantendo os filtros de período e conta no mesmo contexto;
- a evolução mensal é renderizada em SVG leve a partir das transações já
  carregadas, sem nova chamada à API ou inclusão de Recharts no bundle da Home;
- estados de carregamento e vazio possuem cópia própria no hero, enquanto
  onboarding, widgets, atalhos, comparativos, metas e histórico foram mantidos;
- PT-BR e inglês receberam as novas chaves; 102 testes unitários, nove smokes
  Playwright, lint e build passaram;
- a inspeção de desktop claro e mobile escuro confirmou hero e tendência sem
  erro de console ou overflow horizontal.

**Evidência do segundo incremento (2026-08-27):**

- `Héstia percebeu` prioriza uma leitura determinística das receitas, despesas,
  recorrências e categorias do recorte; não chama modelo, não armazena conversa
  e não altera decisões financeiras;
- a hierarquia mostra até quatro categorias por valor e participação nas saídas,
  usando o mesmo filtro de período e conta do hero;
- a inspeção em desktop claro e mobile escuro não encontrou erro de console,
  overlay ou overflow horizontal; 103 testes unitários, nove smokes Playwright,
  lint e build passaram.

**Evidência do terceiro incremento e conclusão (2026-08-27):**

- planejamento e atividade recente agora compartilham uma única seção da Home,
  com divisões tipográficas e de borda sutis em vez de dois cards de conteúdo
  aninhado;
- metas, histórico, leitura financeira e categorias têm cópias explícitas para
  carregamento, vazio e erro; o estado demo e a retomada opcional do onboarding
  continuam disponíveis;
- a atualização das metas deixou de depender do próprio estado de carregamento,
  eliminando uma dependência que podia disparar nova busca a cada renderização;
- PT-BR e inglês foram atualizados em paridade. `npm run lint`, 107 testes
  unitários em execução serial, nove smokes Playwright e `npm run build`
  passaram;
- o navegador disponível fora do sandbox não alcançou a mesma instância Vite
  local desta sessão, portanto a checagem visual direta deste incremento não foi
  registrada como evidência. Os smokes autenticados em Chromium passaram no
  servidor de teste controlado pelo Playwright.

**Gate:** a página deve responder em poucos segundos "como estou?", "por que?"
e "o que merece atenção?" sem remover funcionalidades existentes.

## Etapa 4 - componentes reutilizáveis

- [x] Criar `Button`, `Input`, `Select`, `Modal`, `Toast` e `EmptyState`.
- [x] Criar `Metric`, `MoneyDelta`, `TransactionRow` e `CategoryRow`.
- [x] Criar `BudgetProgress`, `InsightCard` e `ChartContainer`.
- [x] Substituir alertas grandes por feedback discreto quando apropriado.
- [x] Evitar cards aninhados e componentes puramente decorativos.

**Evidência do primeiro incremento (2026-08-27):**

- `Button`, `Input` e `Select` foram criados como primitivos controlados, sem
  estado próprio de formulário; cobrem loading, disabled, foco, rótulo, ajuda e
  erro acessível;
- Cadastro e Recuperação de senha passaram a usar `Input` e `Button`, mantendo
  os mesmos IDs, validação de senha, redirecionamento de e-mail existente e
  chamadas de autenticação;
- `Modal`, `Toast`, `EmptyState` e os componentes financeiros permanecem para
  os próximos incrementos, portanto o checklist consolidado da etapa continua
  aberto;
- lint, quatro testes unitários focados, build e os smokes Playwright de
  Cadastro e Recuperação passaram.

**Evidência do segundo incremento (2026-08-27):**

- `Button` passou a cobrir as ações nativas de onboarding e restauração da
  Home, login demo, login, redefinição de senha, personalização da Home e
  visibilidade de senha;
- as variantes primária e secundária concentram os estados disabled, loading e
  `aria-busy`, preservando textos, handlers e a semântica de links existentes;
- ações que ainda dependem de aparência de link, comportamento destrutivo ou
  fluxos de modal permanecem no HTML atual até suas variantes específicas;
- lint, 12 testes unitários focados, build e nove smokes Playwright passaram.

**Evidência do terceiro incremento (2026-08-27):**

- `Button` recebeu variantes de link e de ação destrutiva, com hover, foco,
  disabled e loading coerentes com os tokens da aplicação;
- exportação, edição e remoção da tabela de transações usam as variantes
  secundária e destrutiva; o reenvio de verificação no login usa a variante de
  link, preservando todos os handlers;
- 15 testes unitários focados em execução serial, build e nove smokes
  Playwright passaram. Os modais existentes continuam inalterados neste
  incremento.

**Evidência de conclusão (2026-08-27):**

- `Modal` oferece rótulo acessível, foco inicial, contenção de tabulação,
  Escape, clique no backdrop e restauração de foco; a remoção de uma meta agora
  exige essa confirmação em vez de `window.confirm`;
- `Toast` passou a exibir a confirmação de criação, edição ou remoção de meta
  como feedback discreto e dispensável. Erros de formulário permanecem
  contextuais, junto aos campos ou à operação que falhou;
- `EmptyState`, `Metric`, `MoneyDelta`, `TransactionRow`, `CategoryRow`,
  `BudgetProgress`, `InsightCard` e `ChartContainer` foram aplicados nos
  estados vazios, dashboard, Home, metas, gráficos e tabela de transações,
  preservando handlers, filtros, exportação e i18n existentes;
- os gráficos e as metas não mantêm mais uma superfície de card adicional ao
  redor de cards semânticos internos, reduzindo o aninhamento decorativo;
- lint, 119 testes unitários em execução serial, build e nove smokes Playwright
  passaram. Nenhum contrato de API, banco, autenticação ou Brevo foi alterado.

**Gate:** componentes devem ter estados normal, hover, focus, disabled, loading e
erro quando aplicáveis, sem duplicar regras em cada página.

## Etapa 5 - fluxos principais

- [x] Migrar Transações para lista densa e criação rápida.
- [x] Manter tags, recorrência e campos raros em `Mais opções`.
- [x] Consolidar gráficos e comparações em Análises.
- [x] Criar `/planejamento` para metas, orçamentos e compromissos.
- [x] Redirecionar `/graficos` e `/metas` sem quebrar favoritos antigos.
- [x] Migrar Contas para o novo shell e tom visual.
- [x] Preservar Perfil, Histórico e dashboard público como áreas secundárias.
- [x] Alinhar nomes de exportação CSV/PDF e suas asserções de teste com a marca
  aprovada.
- [x] Limitar a quantidade de itens aceita por importação na API e manter o
  limite de tamanho do arquivo no frontend.

**Evidência da fundação de Transações (2026-08-28):**

- o modal mantém à vista data, descrição, tipo, categoria, conta e valor para
  acelerar o lançamento comum; tags, parcelamento e recorrência passaram para
  o disclosure nativo `Mais opções` / `More options`;
- o payload, validações, edição, importação, filtros persistidos e atalho
  `/transacoes?nova=1` foram preservados. Nenhuma chamada de API, regra de
  banco ou configuração do Brevo foi alterada;
- lint, 15 testes unitários focados em execução serial, build e verificação de
  diff passaram. A lista densa, a confirmação de remoção de transações e a
  revisão dos blocos recorrentes/parcelados permanecem como próximos cortes.

**Evidência do segundo incremento de Transações (2026-08-28):**

- o histórico financeiro deixou a tabela de seis colunas e passou a usar uma
  lista densa sem cards por item: data, descrição, origem, tags, valor, tipo,
  categoria, conta e ações continuam disponíveis no mesmo lançamento;
- a lista usa semântica `ul`/`li`, preserva itens destacados após importação e
  aplica `content-visibility` para listas extensas, sem nova busca ou estado
  duplicado no frontend;
- exportação CSV/PDF, filtros, edição e remoção mantêm os mesmos handlers. lint,
  16 testes unitários focados em execução serial, build e verificação de diff
  passaram; API, banco e Brevo não foram alterados.

**Evidência do terceiro incremento de Transações (2026-08-28):**

- a exclusão de lançamento avulso e de compra parcelada deixou de depender de
  `window.confirm`: ambas usam o Modal compartilhado, com foco gerenciado,
  Escape/backdrop bloqueados durante a mutação e uma confirmação explícita;
- as mensagens de título, consequência e ação foram adicionadas em PT/EN. A
  confirmação só chama os mesmos handlers de remoção já existentes, sem alterar
  API, banco ou Brevo;
- lint e 14 testes focados em execução serial passaram, incluindo os dois fluxos
  de confirmação. O build foi iniciado e atingiu a geração de chunks, mas o
  executor local encerrou sua captura antes do resultado final; essa validação
  permanece pendente antes de fechar a etapa.

**Evidência de fechamento do bloco de Transações (2026-08-28):**

- recorrências e compras parceladas passaram a usar seções e listas densas,
  separadas do estado e dos filtros da página. As métricas, tags, categoria,
  valor, próxima ocorrência, saldo, progresso, edição e remoção continuam
  disponíveis no mesmo fluxo;
- o progresso de parcelamento usa o componente acessível compartilhado e os
  itens longos usam `content-visibility`, sem introduzir nova busca, estado
  duplicado, endpoint ou regra financeira;
- lint, 17 testes focados em execução serial, build de produção e verificação
  de diff passaram. A checagem visual automatizada ficou indisponível porque o
  executável `agent-browser` não está instalado neste ambiente. API, banco e
  Brevo seguem inalterados.

**Evidência de consolidação de Análises (2026-08-28):**

- os gráficos por categoria e por evolução mensal agora ficam em `/analises`,
  usando exatamente os mesmos filtros de período e escopo de conta dos
  insights, comparativos, previsão e metas;
- `/graficos` e o alias `/dashboard` passaram a redirecionar para `/analises`.
  A navegação e o atalho da Home deixam de oferecer uma área de gráficos
  duplicada; `/metas` já preservava o redirecionamento compatível;
- lint, 15 testes focados (rotas, Análises, Home e i18n), build de produção e
  verificação de diff passaram. Nenhuma chamada de API, regra de banco ou
  configuração do Brevo foi alterada.

**Evidência de limpeza do fluxo legado (2026-08-28):**

- `Dashboard.jsx` e seu teste, que já não possuíam rota nem importador após a
  consolidação em Análises, foram removidos. Os aliases `/graficos` e
  `/dashboard` continuam protegidos e redirecionam para `/analises`;
- Histórico foi movido para a navegação secundária no desktop e no menu
  `Mais` no mobile. Perfil já era secundário e o painel público continua fora
  da navegação autenticada;
- lint, cinco testes focados de rota/navegação, build de produção e verificação
  de diff passaram. API, banco e Brevo não foram alterados.

**Evidência da migração de Contas (2026-08-28):**

- os saldos agora usam as métricas compartilhadas do novo shell e as contas
  cadastradas uma lista densa, mantendo instituição, identificador, tipo,
  escopo e saldo visíveis;
- criação, edição e recarga dos lançamentos preservam os mesmos contratos. A
  remoção passou a usar o modal compartilhado, que deixa explícito quando há
  lançamentos vinculados antes de confirmar a ação;
- lint, seis testes focados (Contas e i18n), build de produção e verificação de
  diff passaram. Nenhuma chamada da API, regra de banco ou configuração do
  Brevo foi alterada.

**Evidência da correção de exportação (2026-08-28):**

- CSV e PDF usam os nomes exatos `hestia-transacoes-todos.csv` e
  `hestia-transacoes-todos.pdf` no fluxo sem filtro; as asserções cobrem ambos;
- o PDF usa Courier com `WinAnsiEncoding` e fonte de 9 pt. Isso preserva
  acentos e mantém data, descrição, categoria, tipo e valor dentro da página,
  sem a duplicação de largura causada pelo UTF-16 anterior;
- três testes unitários do gerador, dois testes focados de exportação e um fluxo
  Playwright no Chromium passaram. O último carregou dois lançamentos simulados,
  acionou o download e validou o PDF produzido. Lint, build e verificação de
  diff também passaram; API, banco e Brevo não foram alterados.

**Evidência do limite de importação (2026-08-28):**

- o contrato de importação declara e a action reforça no servidor o máximo de
  500 lançamentos. Uma tentativa com 501 itens recebe `400` controlado antes de
  persistir lançamentos ou registros de auditoria; o limite deixou de ser um
  número mágico no controller;
- o frontend continua recusando arquivos maiores que 2 MB antes de ler seu
  conteúdo. O teto de itens no servidor é deliberadamente independente da
  validação do navegador;
- a asserção automatizada para o caso de 501 itens foi adicionada e a checagem
  de diff passou. A execução de `dotnet test` ficou pendente: o executor local
  não iniciou a compilação e foi cancelado sem diagnosticar erro de código.

**Evidência de Planejamento (2026-08-28):**

- `/planejamento` concentra metas/orçamento existentes e compromissos
  recorrentes ou parcelados, sem criar endpoint, modelo ou cálculo financeiro
  paralelo. Parcelamentos aparecem em leitura e continuam editáveis somente em
  Transações;
- `/metas` preserva favoritos com redirecionamento para a nova rota. Análises
  deixou de duplicar metas e mantém apenas insights, gráficos, comparativos e
  previsão; a navegação desktop e mobile passou a expor Planejamento;
- quatro arquivos de teste, com dez cenários focados, lint e build de produção
  passaram. A inspeção visual automatizada não foi possível porque
  `agent-browser` não está instalado neste ambiente.

**Gate:** CRUD, filtros, importação, exportação, recorrências, metas e escopo de
conta devem manter o comportamento coberto pelos testes atuais.

## Etapa 6 - experiência mobile

- [ ] Tratar a lista de transações como experiência principal.
- [x] Abrir filtros avançados em sheet.
- [x] Implementar criação rápida sem formulário pesado.
- [ ] Validar alvos de toque, safe áreas e teclado virtual.
- [ ] Verificar ausência de overflow e sobreposições em larguras estreitas.

**Gate:** os fluxos principais devem ser concluídos sem depender de controles
ocultos ou de um layout desktop comprimido.

**Evidência do primeiro incremento mobile (2026-08-28):**

- em telas até 767 px, os filtros de Transações deixam de ocupar o canvas
  inteiro e passam a abrir em um sheet inferior, com backdrop, Escape, foco
  inicial na busca, bloqueio de scroll de fundo, área segura e ações fixas de
  limpar ou voltar aos resultados;
- os filtros continuam usando o mesmo estado persistido e a mesma lógica de
  aplicação imediata. Desktop preserva o card original, sem duplicar campos ou
  regras; o gatilho mobile informa a quantidade de filtros ativos em PT-BR e
  inglês;
- dois testes do sheet, 11 testes existentes de Transações, lint e build de
  produção passaram. A validação visual automatizada continua pendente porque
  `agent-browser` não está disponível neste ambiente.

**Evidência do segundo incremento mobile (2026-08-31):**

- o atalho fixo de nova transação (`/transacoes?nova=1`) abre um modo rápido:
  descrição, valor e tipo aparecem antes de qualquer detalhe, com botões de
  toque para despesa ou receita;
- data, categoria, conta, tags, recorrência e parcelamento permanecem no mesmo
  formulário e no mesmo contrato de criação, mas dentro de `Mais opções`. A
  criação comum e a edição preservam o formulário completo;
- 15 testes focados de modal e página de Transações, lint e build de produção
  passaram. A revisão visual em navegador continua pendente neste ambiente.

## Etapa 7 - camada Héstia e agentes

- [ ] Adicionar uma entrada unificada apenas após a UX financeira amadurecer.
- [ ] Rotear especialidades internamente, sem seletor obrigatório de agente.
- [ ] Identificar análises com Métis, Eunômia, Sofrósina, Kairos ou Plutus.
- [ ] Evitar chat flutuante, avatares, gamificação e cinco paletas concorrentes.
- [ ] Manter o produto plenamente funcional sem IA.

Esta etapa não autoriza ainda integrar modelo, armazenar conversas ou permitir
que um agente bloqueie decisões financeiras.

## Trilha paralela A - arquitetura, deploy e operação

Estes itens não fazem parte da alteração visual, mas são gates para considerar
o redesign pronto para produção.

### P0 - alinhar a arquitetura real

- [ ] Escolher um único contrato oficial para o frontend localizar a API:
  `VITE_API_URL` absoluto ou `/api` pelo rewrite da Vercel.
- [ ] Eliminar a possibilidade de um build alternar silenciosamente entre os
  dois contratos.
- [ ] Atualizar README, documentação de arquitetura e guia local para explicar
  Vercel -> Railway -> Neon e a compatibilidade local opcional com SQL Server.
- [ ] Corrigir a documentação da Vercel para refletir a localização real do
  `vercel.json`, o diretório raiz efetivo e os comandos de build atuais.
- [ ] Registrar como migrations PostgreSQL são aplicadas antes de cada release,
  sem executar `Database.Migrate()` concorrentemente no startup.
- [ ] Confirmar que a role de runtime do Neon continua com privilégios mínimos e
  que a credencial de owner é usada apenas em migrations administradas.

### P0 - eliminar pipelines conflitantes

- [ ] Decidir e documentar o fim da janela de rollback da Azure.
- [ ] Desabilitar ou arquivar os workflows antigos de Azure Static Web Apps e
  Azure App Service quando a janela terminar.
- [ ] Até lá, impedir que um push comum faça deploy simultâneo e não intencional
  em Azure, Vercel e Railway.
- [ ] Exigir lint, testes, build e auditorias antes das integrações automáticas de
  Vercel e Railway promoverem `main`.
- [ ] Registrar o commit e os IDs dos deploys aprovados para relacionar repo,
  frontend e API em cada release.

### P1 - saúde e cold start

- [ ] Separar liveness e readiness, mantendo um endpoint simples para processo e
  outro que confirme acesso ao Neon e schema esperado.
- [ ] Não tratar `/health=200` como prova isolada de que banco e migrations estão
  operacionais.
- [ ] Medir frontend, API e Neon nos estados quente, API adormecida e API+banco
  adormecidos.
- [ ] Implementar loading e retry limitado sem duplicar operações mutáveis.
- [ ] Persistir ou substituir a estratégia de Data Protection antes de usar mais
  de uma réplica; validar antiforgery durante redeploys.
- [ ] Manter a automação periódica desabilitada no serviço web para permitir
  sleep e planejar worker/cron dedicado antes de reativá-la.

## Trilha paralela B - segurança, privacidade e resiliência

### P0/P1 - autenticação e proxy

- [ ] Validar o range real dos proxies Railway e substituir a confiança ampla em
  `100.0.0.0/8` pelo menor conjunto documentado ou configurável.
- [ ] Confirmar que IP de auditoria e partições do rate limiter não podem ser
  alterados por `X-Forwarded-For` vindo de um cliente não confiável.
- [ ] Revisar o cadastro para não revelar desnecessariamente se um e-mail já
  existe, preservando um fluxo útil de recuperação de conta.
- [ ] Redesenhar o bloqueio após cinco senhas inválidas para reduzir negação de
  serviço direcionada sem enfraquecer proteção contra força bruta.
- [ ] Revalidar cookie JWT, CSRF, logout, expiração e revogação nos navegadores
  principais depois do novo domínio.
- [ ] Manter preview deployments fora do banco e das credenciais de produção.

**Evidência da fundação de rate limiting (2026-08-28):**

- a API passou a aplicar 120 requisições por minuto por IP como proteção global,
  com exceção de preflight e health check; autenticação usa 10 por minuto por
  IP e rota, e a conta demo preserva o limite de 5 por minuto;
- respostas `429` retornam `ProblemDetails` e `Retry-After`. As chaves usam
  somente `RemoteIpAddress` já processado pelo middleware, ignorando um
  `X-Forwarded-For` bruto vindo do cliente e normalizando IPv4 mapeado em IPv6;
- três testes focados da chave de partição e a suíte completa da API (92 testes)
  passaram. O range confiável de proxies Railway ainda precisa ser reduzido e
  validado antes de marcar o item P0 correspondente como concluído.

### P1 - dados públicos e entradas grandes

- [ ] Definir o período e o conjunto mínimo de dados exibidos no dashboard
  público.
- [ ] Adicionar paginação ou limite de transações ao dashboard público.
- [ ] Avaliar expiração opcional do compartilhamento além de rotação e revogação.
- [ ] Evitar vazamento do token do dashboard por histórico, referer, analytics ou
  logs; avaliar `Referrer-Policy: no-referrer` na rota compartilhada.
- [ ] Definir limite de itens e tamanho total para importações CSV/OFX também na
  API, independentemente da validação do navegador.
- [ ] Adicionar testes de payload excessivo e resposta `413`/`400` controlada.

### P2 - headers, segredos e retenção

- [ ] Restringir `connect-src` da CSP ao conjunto mínimo; com proxy same-origin,
  verificar se apenas `'self'` é suficiente.
- [ ] Reduzir `style-src 'unsafe-inline'` quando a migração de componentes
  permitir, sem quebrar Bootstrap ou estilos necessários.
- [ ] Adotar secret scanning dedicado no CI e continuar sem versionar `.env`,
  connection strings, chaves JWT ou credenciais de provedores.
- [ ] Definir retenção e limpeza de tokens expirados, auditoria e registros de
  entrega considerando privacidade e crescimento do banco.

## Trilha paralela C - domínio e e-mail Brevo

O Brevo está deliberadamente bloqueado neste momento. A identidade e o novo
domínio precisam ser decididos antes de configurar remetente, autenticação DNS,
links transacionais ou credenciais de produção. Nenhum item da seção
"depois do novo domínio" deve ser antecipado.

### Antes do novo domínio - somente preparação de código

- [ ] Introduzir uma configuração explícita para e-mail habilitado/desabilitado,
  sem exigir credenciais Brevo durante a pausa.
- [ ] Remover o acoplamento que derruba toda a API em produção quando SMTP está
  intencionalmente desabilitado.
- [ ] Definir respostas honestas para cadastro, reenvio e recuperação quando o
  e-mail estiver indisponível, sem afirmar que houve entrega.
- [ ] Decidir se cadastro público fica temporariamente indisponível enquanto a
  confirmação de e-mail não puder ser enviada.
- [ ] Adicionar timeout e cancelamento ao envio SMTP para não prender requisições
  HTTP indefinidamente.
- [ ] Manter apenas placeholders nos arquivos de exemplo; não criar nem inserir
  chave SMTP agora.
- [ ] Manter `Notifications__Enabled=false` no serviço web.

### Depois da aprovação da marca e do novo domínio

- [ ] Registrar o domínio definitivo e os subdomínios de app e API.
- [ ] Configurar o domínio no projeto Vercel e o domínio da API na Railway.
- [ ] Atualizar `Client__BaseUrl`, CORS, links de confirmação/redefinição,
  callbacks, webhooks e CSP.
- [ ] Validar HTTPS, certificados, redirects e cookies no domínio definitivo.
- [ ] Criar ou validar o remetente Héstia no Brevo.
- [ ] Autenticar o domínio no Brevo com SPF, DKIM e, quando aplicável, DMARC.
- [ ] Criar uma chave SMTP exclusiva para `production` e armazená-la somente nas
  variáveis privadas da Railway.
- [ ] Configurar `Smtp__Host`, porta, usuário, chave, remetente, nome e TLS.
- [ ] Fazer deploy e confirmar o diagnóstico de startup sem imprimir valores.
- [ ] Testar cadastro, confirmação, reenvio e recuperação com contas controladas.
- [ ] Confirmar `Delivered` no log transacional do Brevo; resposta `200`/`201` da
  API não é prova de entrega.
- [ ] Testar reputação, spam, bounce e tratamento de remetente inválido.
- [ ] Só então avaliar reativar alertas de metas e resumos mensais em worker ou
  cron dedicado, preservando idempotência no PostgreSQL.

**Gate:** o rebranding só pode ser publicado como Héstia quando domínio,
`Client__BaseUrl`, CORS, cookies e links transacionais apontarem para o mesmo
ambiente aprovado. O funcionamento do Brevo é um gate posterior à troca do
domínio, não um bloqueio para explorar e implementar o frontend localmente.

## Validação por incremento

Cada etapa deve terminar com:

- lint, testes unitários e build do frontend;
- verificação visual em light/dark;
- screenshots desktop e mobile das rotas afetadas;
- verificação de foco, contraste, overflow e sobreposições;
- smoke de cadastro, login, demo, logout e rotas protegidas quando o shell mudar;
- suíte unitária do frontend totalmente verde, sem aceitar timeouts como
  aprovação;
- 89 testes atuais da API ou mais, sem regressão de isolamento entre usuários;
- smoke público e autenticado pelo domínio definitivo quando ele existir;
- verificação separada de frontend -> proxy -> API e API -> PostgreSQL;
- `npm audit` e auditoria NuGet sem vulnerabilidades altas conhecidas;
- `git diff --check` e revisão de arquivos não rastreados antes do commit;
- atualização deste checklist somente após evidência funcional.

Screenshots precisam ser gerados novamente a partir do mesmo commit validado.
Artefatos antigos, ignorados pelo Git ou produzidos por uma versão temporária de
CSS não comprovam o estado atual.

## Ordem global de execução

1. [ ] Restaurar a baseline de testes do frontend e congelar novas trocas globais
   de nome.
2. [ ] Concluir a Etapa 0 e escolher a identidade Héstia.
3. [ ] Implementar a fundação visual e validar o primeiro gate light/dark.
4. [ ] Evoluir shell, Home, componentes e fluxos em incrementos isolados.
5. [ ] Executar em paralelo os hardenings P0/P1 que não dependem do domínio.
6. [ ] Escolher e configurar o novo domínio somente quando a marca estiver pronta.
7. [ ] Atualizar URLs, CORS, cookies e callbacks e executar smoke completo.
8. [ ] Configurar e validar o Brevo somente depois da troca do domínio.
9. [ ] Encerrar a janela de rollback e remover pipelines Azure conflitantes.
10. [ ] Publicar o rebranding apenas com todas as evidências do gate final.

## Próximo incremento

Criar três direções de identidade para o símbolo de Héstia, comparar presença em
16 px, sidebar, login e light/dark, e escolher uma antes de consolidar novas
alterações no frontend. O Brevo permanece fora deste incremento e só deve ser
configurado depois da definição e troca para o novo domínio.
