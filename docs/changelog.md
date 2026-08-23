# Changelog

Este changelog registra os principais marcos de entrega do Finova. Ele é escrito em linguagem de produto para facilitar a leitura por pessoas técnicas e não técnicas.

## Base atual de entrega

- Arquitetura de deploy preparada para Azure Static Web Apps, App Service e Azure SQL.
- Health check público disponível para validar a API.
- Configuração de produção baseada em `VITE_API_URL`, apontando o frontend diretamente para a API com `/api`.
- Logs estruturados da API e eventos de auditoria para fluxos relevantes.

## Segurança e portabilidade

- Validação de propriedade de contas financeiras em criação, edição e importação de transações.
- Vínculo Pluggy restrito ao `clientUserId` do usuário autenticado.
- Rate limit nos endpoints públicos de autenticação.
- Respostas de login neutras para reduzir enumeração de contas.
- Preservação de links válidos quando um novo envio de e-mail falha.
- Neutralização de fórmulas em arquivos CSV exportados.
- Cabeçalhos de segurança no frontend e na API.
- Dependências npm e NuGet atualizadas e auditadas.
- Substituição do Azure Communication Services Email por SMTP genérico.
- Workflows de frontend e API com build, testes e auditoria antes do deploy.

## Autenticação e acesso

- Cadastro e login com JWT.
- Confirmação de e-mail no fluxo de criação de conta.
- Recuperação e redefinição de senha por e-mail.
- Conta demo para apresentação do produto.
- Auditoria para ações sensíveis.

## Gestão financeira

- Cadastro, edição, remoção e listagem de transações.
- Filtros por período, tipo, categoria, conta e outros critérios.
- Importação de transações com revisão e tratamento de duplicidades.
- Exportação de dados financeiros.
- Exportação em PDF com valor monetário preservado e metadados localizados em PT/EN.
- Organização por categorias, tags e contas financeiras.
- Suporte a metas mensais, metas por categoria, lançamentos recorrentes e compras parceladas.

## Dashboard e análise

- Indicadores de receitas, despesas, saldo e evolução financeira.
- Gráficos e comparativos por período.
- Insights prescritivos para orientar decisões.
- Previsões e leituras agregadas do comportamento financeiro.
- Painel público somente leitura para compartilhamento controlado.

## Notificações

- Envio de e-mails por SMTP por meio de uma abstração de domínio.
- Alertas relacionados a metas.
- Resumos mensais.
- Estrutura de preferências de notificação.

## Internacionalização e polimento textual

- Base de i18n para português e inglês.
- Revisão de textos, acentuação e mensagens de interface.
- Ajustes para reduzir mistura de idiomas entre frontend, backend e documentação.
- Catálogo único PT/EN com teste automatizado de paridade e placeholders.
- Rótulos de formulários associados aos controles e smoke E2E portátil no Chromium.

## Documentação

- README principal em inglês.
- README em português brasileiro.
- Guia de deploy no Azure.
- Roadmap de produto e tecnologia.
- Registro de decisões de arquitetura.
