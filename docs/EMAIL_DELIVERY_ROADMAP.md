# Decisão e roadmap de e-mail transacional

**Última revisão:** 31 de agosto de 2026  
**Estado:** adapter Resend implementado e mantido desativado; configuração
remota e envio real adiados até a definição do domínio próprio da Héstia.

## Decisão

O provedor-alvo é o **Resend pela API HTTPS**, chamado pela API ASP.NET Core
hospedada na Railway e mantido atrás do contrato `IEmailSender`.

O envio não será movido para o frontend nem para uma Function da Vercel. A API
já é responsável por usuários, tokens, auditoria e regras de reenvio; manter o
segredo e a decisão de envio nessa camada evita duplicar regras e expor uma nova
superfície pública.

Também não será usada a integração do Marketplace da Vercel. Ela é adequada
quando o código servidor roda na própria Vercel, mas, no Héstia, a chave deve
existir somente na Railway.

A primeira implementação usará um `HttpClient` tipado contra a API REST do
Resend. O SDK oficial confirma suporte a .NET, mas o Héstia precisa apenas do
endpoint de envio neste corte; manter esse detalhe no adapter reduz dependências
e preserva o restante da aplicação caso o cliente do provedor mude. A chamada
direta deve enviar `Authorization: Bearer`, `User-Agent` e `Idempotency-Key`.
Templates continuarão versionados no backend, com versões texto e HTML. React
Email não será introduzido apenas para esse fluxo.

## Por que Resend

| Critério | Resend | Brevo | Impacto para o Héstia |
| --- | --- | --- | --- |
| Integração | API REST e SDK oficial para .NET | API REST, SDK C# e SMTP | ambos atendem; será preferida a API HTTPS |
| Idempotência | chave por envio mantida por 24 horas | chave por envio com janela de 15 minutos | Resend cobre melhor timeouts, cold boot e novas tentativas tardias |
| Eventos | webhooks assinados e eventos de entrega, bounce, complaint e suppression | webhooks transacionais e log de entrega | ambos atendem; assinatura e deduplicação fazem parte do aceite |
| Plano gratuito observado | 3.000 e-mails/mês, limite de 100/dia e até 3 domínios | 300 e-mails/dia | Brevo tem maior limite diário; o limite do Resend é suficiente para a fase inicial |
| Escopo do produto | focado em e-mail para aplicações | suíte de marketing e comunicação | Resend é mais simples para os fluxos transacionais atuais |

Postmark permanece como alternativa paga se a entregabilidade justificar o
custo no futuro. Amazon SES não será adotado agora: apesar do baixo custo por
volume, acrescentaria conta, permissões e operação AWS a uma arquitetura que já
usa Vercel, Railway e Neon.

Fontes consultadas para esta decisão:

- [Resend para .NET](https://resend.com/docs/send-with-dotnet)
- [Idempotency keys do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Planos e limites do Resend](https://resend.com/pricing)
- [API transacional do Brevo](https://developers.brevo.com/reference/send-transac-email)
- [Planos e limites do Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)

Preços, cotas e recursos devem ser conferidos novamente no dia da ativação.

## Cold start e fluxo escolhido

```text
Navegador -> Vercel -> Railway -> Neon -> Resend API
                         ^
                         `-- autenticação, token e auditoria
```

O Resend não elimina o cold start da Railway. A primeira chamada ainda precisa
acordar a API antes de criar o usuário e o token no Neon. A troca de SMTP por
HTTPS reduz a fragilidade da etapa seguinte e permite timeout, resposta
estruturada, idempotência e correlação pelo identificador retornado pelo
provedor.

Na primeira implementação, os e-mails de confirmação e recuperação podem ser
solicitados de forma síncrona depois do commit do token, com timeout curto e
cancelamento. A resposta da API deve distinguir:

- `aceito pelo provedor`: existe um identificador de mensagem;
- `entregue`: confirmado posteriormente por webhook;
- `pendente/resultado desconhecido`: timeout ou falha recuperável;
- `falhou`: rejeição conhecida que exige correção ou nova tentativa.

Um `200` ou `201` do cadastro não comprova entrega do e-mail. A interface não
deve usar “enviado” quando a API só conhece um estado pendente.

## Pontos adiados antes de ativar o provedor

- [x] Criar `Email__Enabled` com padrão seguro `false` e permitir que a API
  inicialize sem qualquer credencial de e-mail.
- [x] Substituir a validação SMTP obrigatória no startup por validação
  condicional do provedor habilitado.
- [x] Manter um remetente inativo explícito quando o recurso estiver desligado,
  sem simular sucesso.
- [x] Alterar `IEmailSender` para receber `CancellationToken`, tipo do evento e
  uma chave idempotente e retornar um resultado estruturado, sem acoplar
  controllers ao Resend.
- [x] Implementar `ResendEmailSender` com `HttpClient` tipado, timeout finito e
  respostas estruturadas; não registrar API key, token, URL sensível ou corpo.
- [x] Usar chaves determinísticas como
  `email-verification/{tokenId}` e `password-reset/{tokenId}`.
- [x] Tratar separadamente rejeição definitiva, indisponibilidade temporária e
  timeout de resultado desconhecido.
- [x] Não remover um token válido somente porque um timeout deixou incerto se o
  provedor aceitou a mensagem.
- [ ] Repetir uma entrega pendente usando o mesmo token e a mesma chave
  idempotente, sem gerar outro token a cada tentativa.
- [ ] Persistir o identificador do provedor e o estado mínimo da entrega para
  auditoria, sem guardar o token bruto nem o conteúdo completo do e-mail.
- [x] Ajustar cadastro, reenvio e recuperação para respostas honestas quando o
  serviço estiver desligado ou pendente.
- [ ] Adicionar timeout também às chamadas de autenticação do frontend e manter
  loading/retry adequados ao cold boot da Railway.
- [x] Manter `Notifications__Enabled=false`; alertas financeiros e resumo
  mensal continuam fora da primeira ativação.

## Ativação depois do domínio próprio

- [ ] Definir os hosts finais do app, API e subdomínio de envio.
- [ ] Atualizar `Client__BaseUrl`, CORS, cookies, CSP, callbacks e links antes de
  enviar qualquer mensagem real.
- [ ] Criar a conta Resend diretamente e uma chave restrita ao envio de
  produção; armazená-la somente nas variáveis privadas da Railway.
- [ ] Configurar na Railway apenas os nomes previstos, sem registrar valores:
  `Email__Enabled`, `Email__Provider`, `Resend__ApiKey`, `Resend__FromEmail`,
  `Resend__FromName` e `Resend__WebhookSecret`.
- [ ] Verificar o domínio no Resend e publicar exatamente os registros DKIM,
  SPF e return-path indicados pelo painel.
- [ ] Publicar um único SPF por hostname e iniciar DMARC em modo de observação
  antes de avançar para `quarantine` ou `reject`.
- [ ] Usar um remetente Héstia capaz de receber respostas ou configurar
  `Reply-To`; não presumir que `no-reply` é a melhor experiência.
- [ ] Desabilitar tracking de abertura e de links nos e-mails de confirmação e
  recuperação para reduzir exposição de tokens e dados pessoais.
- [ ] Criar webhook na API da Railway, validar a assinatura sobre o corpo bruto,
  limitar payload e deduplicar eventos pelo identificador do webhook.
- [ ] Processar no mínimo `delivered`, `bounced`, `complained` e `suppressed`,
  sem confiar em ordem de chegada dos eventos.
- [ ] Testar cadastro, confirmação, reenvio e recuperação com contas
  controladas em Gmail e Outlook.
- [ ] Confirmar o estado `delivered` no provedor e validar spam, bounce e
  remetente inválido; aceite da API do Resend não basta.
- [ ] Rotacionar imediatamente qualquer chave exposta e nunca armazenar secrets
  no GitHub, Vercel, documentação, logs ou frontend.

## Evidências da fundação desativada em 31 de agosto de 2026

- build da API e do projeto de testes aprovado com zero erros e zero avisos;
- 32 testes focados em autenticação, configuração de e-mail e automação
  financeira aprovados;
- suíte completa com 96 de 97 testes aprovados;
- a única falha foi novamente
  `Import_RejectsMoreThanMaximumItemsWithoutPersistingTransactions`, em arquivo
  não alterado por este incremento e já registrada antes dele;
- `git diff --check` aprovado;
- o smoke de processo em `Production` não produziu erro, mas também não abriu a
  porta no executor local antes de ser encerrado; portanto ele não conta como
  evidência de startup e deverá ser repetido no deploy Railway;
- nenhuma conta, chave, variável remota, domínio ou webhook do Resend foi criado.

## Evidências do adapter Resend em 31 de agosto de 2026

- build da API e do projeto de testes aprovado com zero erros e zero avisos;
- 44 testes focados em Resend, configuração, autenticação e automação aprovados;
- mais 14 testes do adapter/configuração aprovados depois da cobertura explícita
  de timeout;
- a suíte completa anterior ao último teste adicional terminou com 108 de 109
  testes aprovados e somente a falha conhecida de limite da importação;
- headers `Authorization`, `User-Agent` e `Idempotency-Key`, payload e ID de
  resposta foram verificados sem realizar chamadas externas;
- respostas `429`, `5xx` e conflito concorrente são pendentes; erros definitivos
  de autenticação, validação e idempotência são rejeitados;
- falha de rede e timeout preservam estado pendente, enquanto cancelamento do
  cliente continua sendo propagado;
- o adapter SMTP legado foi removido;
- `Email__Enabled=false` permanece em todos os exemplos e nenhum secret real foi
  criado ou armazenado.

## Etapa posterior: notificações financeiras

Alertas de metas e resumos mensais não devem ser executados dentro do serviço
web apenas para manter um loop ativo. Antes de habilitá-los:

- [ ] escolher cron/worker compatível com o sleep da Railway;
- [ ] usar uma outbox persistida no Neon e coordenação idempotente;
- [ ] reaproveitar a chave idempotente do provedor para fechar a janela entre
  aceite externo e commit local;
- [ ] evitar valores financeiros sensíveis no assunto, preview, logs e
  telemetria;
- [ ] definir retenção e exclusão de eventos de entrega.

## Gate de conclusão

O envio de confirmação só pode ser marcado como concluído quando houver, no
mesmo ambiente:

1. domínio e DNS verificados;
2. segredo somente na Railway;
3. testes automatizados de sucesso, falha, timeout e repetição idempotente;
4. smoke real de cadastro, reenvio e recuperação;
5. evento `delivered` validado e webhook assinado processado uma única vez;
6. logs sem tokens, chaves, conteúdo financeiro ou endereços completos.
