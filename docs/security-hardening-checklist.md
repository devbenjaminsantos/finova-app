# Checklist de segurança e confiabilidade

Este checklist transforma os achados da revisão técnica em incrementos pequenos e verificáveis. Um item só deve ser marcado como concluído depois de implementação, testes automatizados e validação do comportamento no ambiente correspondente.

## Concluído na revisão

- [x] Revisar pontos de XSS, SQL manual, autorização de endpoints, código sem uso e documentação desatualizada.
- [x] Remover a dependência de runtime do Azure Communication Services e manter envio de e-mail atrás de `IEmailSender`.
- [x] Validar builds, lint, testes de frontend, testes de backend, auditorias de dependências e smoke tests no navegador.

## Prioridade imediata

- [ ] Remover o JWT do `localStorage`.
  - [x] Emitir o JWT somente em cookie `HttpOnly`, `Secure` em produção e com expiração definida.
  - [x] Enviar cookies nas chamadas do frontend sem construir `Authorization` no navegador.
  - [x] Proteger métodos mutáveis com token antiforgery e CORS com origens explícitas.
  - [x] Encerrar o cookie no logout da API e limpar o estado não sensível do cliente.
  - [x] Manter `Authorization: Bearer` apenas como compatibilidade para clientes externos autenticados.
  - [x] Cobrir login, logout, cookie, CSRF e ausência de JWT no armazenamento com testes.
  - [ ] Validar cookies entre o Static Web App e o App Service no domínio final.
- [ ] Invalidar sessões existentes após redefinição ou troca de senha.
  - [x] Persistir uma versão de sessão por usuário e incluí-la no JWT.
  - [x] Rejeitar tokens sem versão ou com versão diferente da registrada no banco.
  - [x] Encerrar todas as sessões após redefinição por link.
  - [x] Revogar as demais sessões e renovar a atual após troca de senha no perfil.
  - [x] Criar migration e cobrir validação, redefinição e troca de senha com testes.
  - [ ] Aplicar a migration e validar a revogação no ambiente Azure ativo.
- [ ] Substituir o identificador previsível do painel público por token revogável.
  - [x] Gerar token aleatório de 256 bits e persistir somente o hash SHA-256.
  - [x] Exibir o valor bruto somente na emissão ou rotação.
  - [x] Permitir rotação e revogação imediata pela tela de perfil.
  - [x] Cobrir emissão, consulta, rotação e revogação com testes de API e frontend.
  - [ ] Aplicar a migration e gerar novos links para painéis que já estavam ativos na Azure.

## Confiabilidade operacional

- [ ] Reduzir duplicidade de notificações em múltiplas instâncias da API.
  - [x] Coordenar cada entrega com `sp_getapplock` e registro transacional no Azure SQL.
  - [x] Liberar nova tentativa quando o provedor rejeitar o envio.
  - [x] Cobrir orquestração de entrega única, repetição e falha com testes unitários.
  - [ ] Validar duas instâncias concorrentes contra o Azure SQL ativo.
  - [x] Fechar a janela entre o aceite externo e o commit local com a chave
    idempotente do Resend e um estado de entrega persistido antes do envio.
  - [x] Persistir o key ring de Data Protection no Neon antes de escalar a API,
    preservando tokens protegidos, antiforgery e cookies durante redeploys.
- [x] Confirmar persistência compartilhada do ASP.NET Core Data Protection entre instâncias do mesmo slot no Azure App Service.
- [ ] Adotar key ring externo antes de usar troca de deployment slots, pois slots diferentes não compartilham chaves.
- [ ] Isolar a conta demo, com expiração e proteção contra uso concorrente abusivo.
  - [x] Criar uma conta efêmera independente por acesso, sem compartilhar dados entre visitantes.
  - [x] Expirar cada conta após duas horas e remover contas vencidas no acesso seguinte.
  - [x] Serializar criação e limpeza entre instâncias com `sp_getapplock` e transação `Serializable`.
  - [x] Não apagar nenhuma conta apenas por coincidir com o e-mail-base configurado.
  - [x] Limitar o endpoint anônimo a cinco chamadas por minuto por IP.
  - [x] Excluir contas demo da automação de e-mail.
  - [x] Cobrir preservação de usuários reais, isolamento, expiração lógica e acessos concorrentes com testes unitários.
  - [ ] Identificar e remover manualmente a antiga conta compartilhada somente após confirmar seu ID e propriedade no banco ativo.
  - [ ] Validar criação e limpeza contra o Azure SQL ativo e monitorar abuso do endpoint anônimo.
- [x] Implementar e verificar entrega real de cadastro e confirmação pelo Resend
  com remetente temporário e URL da Vercel.
- [ ] Verificar recuperação de senha pelo Resend e migrar para o domínio
  autenticado antes de tratar o envio como produção. Notificações financeiras
  ficam para cron/worker posterior.

## Desempenho e manutenção

- [x] Dividir o bundle do frontend por rota e medir o carregamento inicial novamente.
  - [x] Carregar páginas com `React.lazy` e fallback acessível.
  - [x] Confirmar build com núcleo de 467,81 kB e gráficos em chunk separado de 370,86 kB.
- [x] Repetir a revisão de endpoints, dependências e documentação antes da próxima versão pública.
