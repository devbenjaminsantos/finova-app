# Roadmap

Este roadmap organiza a evolução do Finova em frentes de produto e tecnologia. Ele não substitui issues ou tarefas operacionais; a intenção é preservar a lógica de evolução do projeto e explicar por que cada bloco importa.

## Base atual

O projeto já possui uma base funcional consolidada e uma arquitetura de deploy no Azure. Após transferências ou recriações de recursos, o ambiente precisa passar pela validação pós-deploy documentada antes de ser apresentado como produção ativa:

- autenticação com JWT, confirmação de e-mail e recuperação de senha
- conta demo para apresentação do produto
- CRUD, filtros, importação e exportação de transações
- dashboard com indicadores, gráficos, comparativos e insights
- metas gerais e por categoria
- contas financeiras e filtros por conta
- suporte a lançamentos recorrentes, parcelamentos e tags
- notificações por e-mail para alertas e resumos
- painel público somente leitura
- auditoria para fluxos sensíveis
- workflows de deploy para frontend e API, com banco Azure SQL

## Direção de produto

### 1. Gestão financeira mais estrutural

O objetivo é evoluir o Finova de um dashboard de transações para um sistema que represente melhor a vida financeira real do usuário.

Prioridades:

- consolidar contas financeiras como camada central de navegação
- melhorar transferências entre contas
- detalhar dívidas, parcelas, recorrências e cartões
- separar melhor lançamento real, previsão e compromisso futuro
- permitir análises por categoria, tag, conta e período

### 2. Previsão e decisão

O Finova deve ajudar o usuário a decidir, não apenas registrar.

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
- integrar uma plataforma de métricas e rastreamento, como Application Insights
- documentar rotinas de backup e recuperação
- revisar tratamento de erro em frontend e backend
- manter health checks simples e confiáveis

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

## Próximos marcos sugeridos

### Marco A: Polimento de produto

- finalizar revisão textual e i18n
- revisar estados vazios, erros e carregamentos
- validar responsividade dos fluxos principais
- confirmar consistência entre conta demo e conta real

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
