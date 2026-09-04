# Checklist de segurança e confiabilidade

Este checklist acompanha o estado ativo do Héstia. Material de Azure e
SQL Server histórico está fora deste documento; a operação atual usa Vercel,
Railway, Neon PostgreSQL e Brevo.

Um item só deve ser marcado como concluído depois de implementação, testes
adequados e validação no ambiente correspondente.

## Controles concluídos

- [x] JWT emitido em cookie `HttpOnly`, `Secure` em produção, com versão de
  sessão validada no banco; `Bearer` permanece apenas para clientes externos.
- [x] Operações mutáveis protegidas por antiforgery e CORS limitado a origens
  explícitas.
- [x] Rate limiting global, de autenticação e de conta demo com resposta `429`
  e `Retry-After`.
- [x] Dashboard público usa token aleatório de 256 bits, persistido como hash,
  com rotação e revogação.
- [x] Sessões são invalidadas após redefinição/troca de senha e tokens com
  versão antiga são rejeitados.
- [x] Key ring de Data Protection, outbox transacional e dados da aplicação
  persistidos no Neon.
- [x] Conexão de runtime do Neon separada da conexão administrativa usada para
  migrations controladas.
- [x] Brevo configurada atrás de `IEmailSender`; confirmação, recuperação,
  reenvio limitado, `Delivered` e `Seen` validados manualmente.
- [x] Conta demo isolada por acesso, expira logicamente, não compartilha dados
  entre visitantes e está fora da automação de e-mail.
- [x] Cabeçalhos de segurança, neutralização de fórmulas CSV e autorização por
  usuário cobertos pela revisão atual.

## Prioridade alta

- [ ] Impedir reutilização da senha atualmente ativa durante a redefinição.
  O item e os critérios de aceite estão em
  [`HESTIA_REDESIGN_ROADMAP.md`](HESTIA_REDESIGN_ROADMAP.md#correções-e-polimentos).
- [ ] Validar o intervalo de proxies confiáveis da Railway e reduzir a
  configuração atual ao menor conjunto suportado. Confirmar que
  `X-Forwarded-For` não altera auditoria nem a partição do rate limit quando
  enviado diretamente por um cliente.
- [ ] Verificar cookies, CSRF, logout, expiração e revogação no domínio
  definitivo, depois do cutover de DNS.
- [ ] Adicionar timeout, estado de espera e retry seguro no frontend para cold
  start, sem repetir automaticamente operações mutáveis.

## E-mail e privacidade

- [ ] Autenticar o domínio de envio na Brevo com SPF, DKIM e DMARC; iniciar
  DMARC em observação antes de `quarantine` ou `reject`.
- [ ] Criar webhook Brevo com validação de assinatura sobre o corpo bruto,
  limite de payload e deduplicação do evento.
- [ ] Processar `delivered`, bounce, complaint e suppression sem confiar na
  ordem de chegada dos eventos.
- [ ] Definir retenção e exclusão para tokens expirados, auditoria e registros
  de entrega, sem guardar token bruto, corpo de e-mail ou dados financeiros.
- [ ] Rotacionar imediatamente qualquer chave que apareça fora de um cofre de
  secrets e nunca colocá-la em GitHub, Vercel, frontend, logs ou documentação.

## Operação e escala

- [ ] Validar os locks transacionais PostgreSQL de conta demo e notificações
  com duas instâncias concorrentes contra o Neon.
- [ ] Separar liveness de readiness para que saúde da API, acesso ao Neon e
  schema esperado possam ser observados sem tratar um `200` isolado como prova
  de disponibilidade completa.
- [ ] Definir monitoramento, backup e restauração para Vercel, Railway e Neon.
- [ ] Manter notificações financeiras desativadas até adotar worker/cron com
  outbox, coordenação idempotente e retenção definida.

## Observações de deploy atuais

- `libgssapi_krb5.so.2` ausente na imagem Railway não bloqueou a conexão atual
  por credencial; investigar apenas se GSSAPI/Kerberos ou falha de banco
  relacionada surgir.
- `Failed to determine the https port for redirect` ocorre atrás do proxy TLS
  da Railway. O healthcheck HTTPS funciona; revisar forwarded headers e redirect
  se aparecer loop, URL HTTP ou falha de cookie.
