# Changelog

Este changelog registra os principais marcos de entrega do Finova. Ele é escrito em linguagem de produto para facilitar a leitura por pessoas técnicas e não técnicas.

## Base atual de produção

- Aplicação publicada no Azure com frontend em Static Web Apps, API em App Service e banco em Azure SQL.
- Health check público disponível para validar a API.
- Configuração de produção baseada em `VITE_API_URL`, apontando o frontend diretamente para a API com `/api`.
- Estrutura inicial de observabilidade com Application Insights.

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
- Organização por categorias, tags e contas financeiras.
- Suporte a metas mensais, metas por categoria, lançamentos recorrentes e compras parceladas.

## Dashboard e análise

- Indicadores de receitas, despesas, saldo e evolução financeira.
- Gráficos e comparativos por período.
- Insights prescritivos para orientar decisões.
- Previsões e leituras agregadas do comportamento financeiro.
- Painel público somente leitura para compartilhamento controlado.

## Notificações

- Envio de e-mails por SMTP ou Azure Communication Services Email.
- Alertas relacionados a metas.
- Resumos mensais.
- Estrutura de preferências de notificação.

## Internacionalização e polimento textual

- Base de i18n para português e inglês.
- Revisão de textos, acentuação e mensagens de interface.
- Ajustes para reduzir mistura de idiomas entre frontend, backend e documentação.

## Documentação

- README principal em inglês.
- README em português brasileiro.
- Guia de deploy no Azure.
- Roadmap de produto e tecnologia.
- Registro de decisões de arquitetura.

