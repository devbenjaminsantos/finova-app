# Checklist de segurança e confiabilidade

Este checklist transforma os achados da revisão técnica em incrementos pequenos e verificáveis. Um item só deve ser marcado como concluído depois de implementação, testes automatizados e validação do comportamento no ambiente correspondente.

## Concluído na revisão

- [x] Revisar pontos de XSS, SQL manual, autorização de endpoints, código sem uso e documentação desatualizada.
- [x] Remover a dependência de runtime do Azure Communication Services e manter envio de e-mail atrás de `IEmailSender` com SMTP.
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
- [ ] Permitir rotação e revogação do token do painel público.

## Confiabilidade operacional

- [ ] Garantir idempotência das notificações em múltiplas instâncias da API.
- [ ] Persistir as chaves do ASP.NET Core Data Protection antes de escalar a API horizontalmente.
- [ ] Isolar melhor a conta demo compartilhada, com política de limpeza e proteção contra uso concorrente abusivo.
- [ ] Verificar entrega real de cadastro, confirmação, recuperação de senha e notificações após a migração da Azure.

## Desempenho e manutenção

- [ ] Dividir o bundle do frontend por rota e medir o carregamento inicial novamente.
- [ ] Repetir a revisão de endpoints, dependências e documentação antes da próxima versão pública.
