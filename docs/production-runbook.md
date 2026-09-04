# Runbook de produção

Este documento descreve a operação atual do Héstia. Ele substitui o guia da
Azure como referência para deploys novos; o material Azure permanece apenas
como histórico em [`azure-deploy.md`](azure-deploy.md).

## Arquitetura ativa

```text
GitHub -> Vercel (React/Vite)
              |-- /api/* rewrite --> Railway (ASP.NET Core)
                                         |-- Neon PostgreSQL
                                         `-- Brevo API
```

- A Vercel publica o frontend e encaminha `/api/*` para a Railway conforme
  `vercel.json`.
- A Railway executa a API na porta indicada por `PORT`; o TLS termina no proxy
  da plataforma.
- O Neon guarda dados, migrations, outbox transacional e o key ring do ASP.NET
  Core Data Protection.
- A Brevo envia confirmação de e-mail e recuperação de senha. Notificações
  financeiras continuam desativadas.

## Variáveis por responsabilidade

Nunca registrar valores, connection strings, tokens ou chaves no Git, em logs
ou em capturas de tela.

| Responsabilidade | Variáveis esperadas na Railway |
| --- | --- |
| Banco de runtime | `Database__Provider=PostgreSql`, `ConnectionStrings__Default` |
| Migrations controladas | `ConnectionStrings__Migration`, `Database__ApplyMigrationsOnStartup` |
| Autenticação | `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience` |
| Origem confiável | `Cors__AllowedOrigins__0`, `Client__BaseUrl` |
| E-mail | `Email__Enabled`, `Email__Provider=Brevo`, `Brevo__ApiKey`, `Brevo__FromEmail`, `Brevo__FromName`, `Brevo__TimeoutSeconds` |
| Demo e notificações | `Demo__*`, `Notifications__Enabled=false` |
| Integração futura | `Pluggy__ClientId`, `Pluggy__ClientSecret` quando o recurso estiver habilitado |

A conexão de runtime não deve receber privilégios DDL. A conexão de
`Migration` é administrativa, exclusiva para aplicação controlada de schema e
não deve ser usada pela API durante a operação normal.

## Deploy rotineiro

1. Revisar o diff, executar testes proporcionais à alteração e confirmar que
   não há secrets no worktree.
2. Publicar o commit somente depois da revisão humana.
3. Confirmar o deploy correspondente na Vercel e na Railway.
4. Verificar `GET /health` na API pública e os logs de startup, sem copiar
   credenciais.
5. Executar um smoke do frontend: sessão, CSRF e uma rota autenticada.

## Deploy com migration

1. Confirmar que a migration foi revisada e testada contra PostgreSQL.
2. Salvar `ConnectionStrings__Migration` somente na Railway.
3. Definir temporariamente `Database__ApplyMigrationsOnStartup=true` e iniciar
   um deploy controlado.
4. Confirmar no log que migrations pendentes foram aplicadas com sucesso.
5. Voltar `Database__ApplyMigrationsOnStartup=false` e fazer o deploy normal.
6. Verificar `GET /health`, login, uma leitura autenticada e a tabela/fluxo
   afetado.

Não conceda DDL à conexão de runtime para contornar um bloqueio de migration.

## E-mail transacional

O provedor ativo é a Brevo por HTTPS. Aceite da API (`201`) não é sinônimo de
entrega: conferir o log transacional da Brevo para `Delivered`, bounce,
suppression ou bloqueio. A validação manual atual confirmou confirmação,
recuperação, reenvio limitado e entrega em múltiplas caixas postais; a
latência observada pode ocorrer depois do aceite do provedor.

Após alterar e-mail, validar:

1. cadastro e confirmação pelo link mais recente;
2. reenvio respeitando o rate limit;
3. recuperação e troca de senha;
4. status `Delivered` no painel Brevo;
5. ausência de tokens, mensagens e chaves nos logs.

O domínio próprio ainda exige SPF, DKIM, DMARC e webhook assinado. A ordem e
os itens pendentes estão no [roadmap de e-mail](EMAIL_DELIVERY_ROADMAP.md).

## Alertas conhecidos

- `libgssapi_krb5.so.2` ausente na imagem: não bloqueou a conexão atual por
  credencial. Investigar somente se autenticação GSSAPI/Kerberos ou falhas de
  banco relacionadas forem introduzidas.
- `Failed to determine the https port for redirect`: a Railway termina TLS no
  proxy. O healthcheck HTTPS atual funciona; revisar forwarded headers ou
  redirecionamento se houver loop, URL HTTP ou falha de cookies.

## Rollback

Para um deploy de aplicação sem migration, restaurar a versão anterior na
Vercel e Railway e repetir os smokes. Para migrations, preparar antes uma
migration de reversão revisada; não alterar dados nem executar rollback de
schema destrutivo sob pressão. O histórico de rebranding e limites da antiga
janela de rollback está em
[`HESTIA_TRANSITION_ROADMAP.md`](HESTIA_TRANSITION_ROADMAP.md).
