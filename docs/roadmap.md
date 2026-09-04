# Roadmap

Este roadmap organiza a evolução do Héstia em frentes de produto e tecnologia. Ele não substitui issues ou tarefas operacionais; a intenção é preservar a lógica de evolução do projeto e explicar por que cada bloco importa.

## Base atual

O projeto possui uma base funcional consolidada e uma arquitetura ativa em
Vercel, Railway e Neon. A validação pós-deploy está centralizada no
[`production-runbook.md`](production-runbook.md):

- autenticação com JWT, confirmação de e-mail e recuperação de senha
- conta demo para apresentação do produto
- CRUD, filtros, importação e exportação de transações
- dashboard com indicadores, gráficos, comparativos e insights
- metas gerais e por categoria
- contas financeiras e filtros por conta
- suporte a lançamentos recorrentes, parcelamentos e tags
- confirmação e recuperação por e-mail pela Brevo; alertas financeiros ainda
  permanecem desativados
- painel público somente leitura
- auditoria para fluxos sensíveis
- deploy integrado para frontend Vercel e API Railway, com PostgreSQL no Neon

## Direção de produto

### 1. Gestão financeira mais estrutural

O objetivo é evoluir o Héstia de um dashboard de transações para um sistema que represente melhor a vida financeira real do usuário.

Prioridades:

- consolidar contas financeiras como camada central de navegação
- melhorar transferências entre contas
- detalhar dívidas, parcelas, recorrências e cartões
- separar melhor lançamento real, previsão e compromisso futuro
- permitir análises por categoria, tag, conta e período

### 2. Previsão e decisão

O Héstia deve ajudar o usuário a decidir, não apenas registrar.

Prioridades:

- previsões por saldo, orçamento e comportamento recente
- alertas mais contextuais para metas e gastos
- insights prescritivos com explicação clara
- resumo mensal acionável
- comparação entre períodos com leitura simples

### 3. Automação com revisão

A importação e as integrações devem reduzir esforço sem tirar controle do usuário.

Prioridades:

- fortalecer o fluxo de revisão de importações
- melhorar deduplicação e categorização sugerida
- amadurecer a integração Pluggy/Open Finance
- manter rastreabilidade de origem, conta e lote importado
- evitar qualquer criação automática difícil de desfazer

### 4. Compartilhamento seguro

O painel público deve ser útil para leitura externa sem expor dados sensíveis além do necessário.

Prioridades:

- revisar escopo dos dados públicos
- permitir rotação e revogação de tokens
- melhorar explicação visual do modo somente leitura
- preparar o recurso para cenários de consultoria, prestação de contas ou acompanhamento familiar

## Direção técnica

### 1. Confiabilidade operacional

Prioridades:

- ampliar testes automatizados dos fluxos críticos
- definir observação de logs, erros, disponibilidade e latência compatível com
  Vercel, Railway e Neon
- documentar rotinas de backup e recuperação
- revisar tratamento de erro em frontend e backend
- manter health checks simples e confiáveis
- medir a latência fim a fim de cadastro e e-mail sem confundir aceite do
  provedor com entrega

### 2. Contratos e consistência

Prioridades:

- manter DTOs e validações alinhados entre frontend e API
- reduzir divergências de idioma em mensagens e i18n
- padronizar nomes de campos e filtros financeiros
- registrar decisões relevantes em `architecture-decisions.md`

### 3. Segurança

Prioridades:

- revisar expiração e rotação de tokens
- garantir que fluxos públicos sejam somente leitura
- manter segredos fora do repositório
- validar CORS e URLs de produção em cada deploy
- continuar separando configuração local, staging e produção
- manter a role de runtime do banco sem DDL e a conexão administrativa restrita
  a migrations controladas

## Próximos marcos sugeridos

### Marco A: Polimento de produto

- finalizar revisão textual e i18n
- revisar estados vazios, erros e carregamentos
- validar responsividade dos fluxos principais
- confirmar consistência entre conta demo e conta real
- tratar os itens de [Correções e polimentos](HESTIA_REDESIGN_ROADMAP.md#correções-e-polimentos)
  descobertos em validações manuais

### Marco B: Finanças avançadas

- consolidar recorrências e parcelas
- melhorar metas por categoria
- refinar contas financeiras e transferências
- expandir previsão e análise por período

### Marco C: Integrações e operação

- amadurecer Pluggy/Open Finance
- melhorar monitoramento e alertas técnicos
- documentar operação de produção
- fortalecer testes end-to-end dos fluxos públicos e autenticados
- autenticar o domínio de envio e processar webhooks transacionais com
  assinatura e deduplicação
