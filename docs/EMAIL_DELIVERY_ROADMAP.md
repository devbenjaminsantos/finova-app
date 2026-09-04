# Decisão e roadmap de e-mail transacional

**Última revisão:** 4 de setembro de 2026
**Estado:** Brevo ativa como fonte principal; startup e healthcheck validados,
com o primeiro envio real ainda pendente. Outbox transacional e key ring
persistido no Neon estão implementados. O Resend permanece disponível apenas
como contingência inativa.

## Decisão

O provedor principal é a **Brevo pela API HTTPS**, chamada pela API ASP.NET Core
hospedada na Railway e mantida atrás do contrato `IEmailSender`. O adapter do
Resend será preservado para rollback, sem duas fontes ativas simultaneamente.

O envio não será movido para o frontend nem para uma Function da Vercel. A API
já é responsável por usuários, tokens, auditoria e regras de reenvio; manter o
segredo e a decisão de envio nessa camada evita duplicar regras e expor uma nova
superfície pública.

Também não será usada a integração do Marketplace da Vercel. Ela é adequada
quando o código servidor roda na própria Vercel, mas, no Héstia, a chave deve
existir somente na Railway.

A integração usa um `HttpClient` tipado contra a API REST da Brevo. O Héstia
precisa apenas do endpoint transacional neste corte; manter esse detalhe no
adapter reduz dependências e preserva o restante da aplicação caso o cliente do
provedor mude. A chamada direta envia `api-key`, `User-Agent` e a chave
idempotente nos headers transacionais do payload.
Templates continuarão versionados no backend, com versões texto e HTML. React
Email não será introduzido apenas para esse fluxo.

## Decisão atual

| Critério | Resend | Brevo | Impacto para o Héstia |
| --- | --- | --- | --- |
| Integração | API REST e SDK oficial para .NET | API REST, SDK C# e SMTP | ambos atendem; será preferida a API HTTPS |
| Idempotência | chave por envio mantida por 24 horas | chave por envio com janela de 15 minutos | a outbox preserva a mesma chave; retries fora da janela exigem atenção operacional |
| Eventos | webhooks assinados e eventos de entrega, bounce, complaint e suppression | webhooks transacionais e log de entrega | ambos atendem; assinatura e deduplicação fazem parte do aceite |
| Plano gratuito observado | 3.000 e-mails/mês, limite de 100/dia e até 3 domínios | 300 e-mails/dia | Brevo atende o teste real atual sem custo |
| Escopo do produto | focado em e-mail para aplicações | suíte de marketing e comunicação | a conta Brevo existente e o remetente verificável destravam o fluxo atual |

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
Navegador -> Vercel -> Railway -> Neon -> Brevo API
                         ^
                         `-- autenticação, token e auditoria
```

A Brevo não elimina o cold start da Railway. A primeira chamada ainda precisa
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
- [x] Repetir uma entrega pendente usando o mesmo token e a mesma chave
  idempotente, sem gerar outro token a cada tentativa.
- [x] Persistir o identificador do provedor e o estado mínimo da entrega para
  auditoria, sem guardar o token bruto nem o conteúdo completo do e-mail.
- [x] Ajustar cadastro, reenvio e recuperação para respostas honestas quando o
  serviço estiver desligado ou pendente.
- [ ] Adicionar timeout também às chamadas de autenticação do frontend e manter
  loading/retry adequados ao cold boot da Railway.
- [x] Manter `Notifications__Enabled=false`; alertas financeiros e resumo
  mensal continuam fora da primeira ativação.

O outbox `TransactionalEmailDeliveries` é criado antes da chamada externa. Ele
guarda somente o tipo do evento, referência do token, chave idempotente,
contador/timestamps, estado, código de falha e ID retornado pelo provedor. O
token recuperável fica protegido pelo ASP.NET Core Data Protection, nunca em
texto claro, e a URL/conteúdo são refeitos em memória no retry.

O key ring do Data Protection é persistido no Neon por
`PersistKeysToDbContext<AppDbContext>()`. Assim, links pendentes, cookies e
antiforgery não dependem do filesystem efêmero da Railway e podem sobreviver a
um redeploy ou a mais de uma réplica. A tabela fica acessível somente pela
conexão privada da API; acesso de leitura/escrita ao banco deve ser tratado com
o mesmo nível de proteção das variáveis de ambiente.

Enquanto não houver domínio próprio, a ativação usará a URL de produção da
Vercel como `Client__BaseUrl`:
`https://hestia-app-benjamin-santos.vercel.app`. O remetente temporário
verificado na Brevo não substitui a validação posterior de domínio, SPF,
DKIM e DMARC.

## Troca controlada para Brevo

- [x] Implementar o adapter Brevo pela API HTTPS sem remover o adapter Resend.
- [x] Definir Brevo como provedor padrão nos exemplos, mantendo envio desligado
  por padrão.
- [x] Criar uma API key exclusiva de envio e salvá-la somente na Railway.
- [ ] Criar e validar um remetente na conta Brevo.
- [x] Configurar `Brevo__ApiKey`, `Brevo__FromEmail`, `Brevo__FromName` e
  `Brevo__TimeoutSeconds` antes de trocar `Email__Provider`.
- [x] Trocar `Email__Provider=Brevo`, fazer um único redeploy e confirmar o
  startup sem registrar valores secretos.
- [ ] Executar cadastro real, confirmar recebimento e concluir o link.
- [ ] Confirmar o evento de entrega no log transacional da Brevo.

### Evidência e avisos do primeiro deploy Brevo

Em 4 de setembro de 2026, o deploy `9e0ca31f-55f7-47c8-9fcb-82e1be8a4785`
terminou com `SUCCESS`, o healthcheck público respondeu `HTTP 200` e o startup
registrou `Provedor de e-mail configurado: Brevo.`. Isso comprova configuração
e inicialização, mas não comprova aceite nem entrega de uma mensagem.

Os logs também apresentaram dois avisos não bloqueantes:

- `libgssapi_krb5.so.2: cannot open shared object file`: biblioteca Kerberos
  ausente na imagem de runtime. A conexão atual por credencial segue funcional;
  investigar se passar a usar autenticação GSSAPI/Kerberos ou se aparecer falha
  de conexão associada.
- `Failed to determine the https port for redirect`: a API não identifica uma
  porta HTTPS dentro do contêiner, enquanto a Railway encerra TLS no proxy
  externo. O endpoint público HTTPS e o healthcheck funcionam; revisar forwarded
  headers/HTTPS redirection se surgir loop, redirect incorreto ou URL HTTP.

O primeiro envio será executado manualmente pela interface antes de qualquer
teste automatizado adicional. Manter pendentes os itens de recebimento, conclusão
do link e confirmação `delivered` até haver evidência real.

## Ativação temporária com a URL da Vercel

- [x] Definir a URL pública estável da Vercel para links de confirmação e
  recuperação.
- [x] Persistir o key ring de Data Protection no Neon antes de habilitar o
  envio, por migration explícita.
- [x] Criar uma chave de envio no Resend e um remetente temporário permitido
  pelo provedor.
- [x] Configurar na Railway `Email__Enabled=true`, `Email__Provider=Resend`,
  `Resend__ApiKey`, `Resend__FromEmail`, `Resend__FromName` e
  `Client__BaseUrl`, sem expor os valores.
- [x] Aplicar as migrations no Neon e confirmar o startup da Railway.
  - Bloqueio encontrado em 1 de setembro de 2026: a conexão de runtime da API
    não tem `CREATE` no schema `public` (`SQLSTATE 42501`), como esperado para
    menor privilégio. Criar uma role/conexão administrativa exclusiva em
    `ConnectionStrings__Migration`; não conceder DDL à conexão de runtime nem
    habilitar o Resend antes disso.
  - A API aceita tanto a URI `postgresql://` copiada do Neon quanto o formato
    ADO.NET. Caso uma URI inválida chegue ao startup, o valor não é registrado;
    rotacionar a senha de qualquer conexão que tenha aparecido em logs antigos
    antes de uma nova tentativa.
- [x] Enviar a confirmação para uma conta controlada, verificar o ID aceito pelo
  Resend, o recebimento no Gmail e a conclusão do link de verificação.
  Evidência manual confirmada em 2 de setembro de 2026.
- [x] Enviar a recuperação de senha para a conta controlada e validar o link e
  a troca de senha. Evidência manual confirmada em 3 de setembro de 2026.
- [ ] Implementar o webhook antes de persistir `delivered` automaticamente; até
  lá, a entrega real depende da confirmação no provedor ou pelo destinatário.

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

## Evidências do outbox transacional em 1 de setembro de 2026

- a migration `20260901141938_AddTransactionalEmailDeliveries` cria a tabela,
  referências exclusivas para exatamente um token, chave idempotente única e
  índices filtrados compatíveis com PostgreSQL e SQL Server;
- 35 testes focados de autenticação e modelo passaram, incluindo repetição de
  confirmação e recuperação com a mesma URL e a mesma chave;
- nenhuma migration foi aplicada no Neon/Railway e nenhum e-mail foi enviado;
- o envio segue condicionado a `Email__Enabled=true` e ao domínio configurado
  posteriormente.

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
