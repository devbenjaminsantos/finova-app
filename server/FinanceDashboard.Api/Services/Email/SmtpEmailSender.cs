using System.Net;
using System.Net.Mail;
using FinanceDashboard.Api.Services.Notifications;

namespace FinanceDashboard.Api.Services.Email
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;

        public SmtpEmailSender(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public Task SendPasswordResetEmailAsync(string toEmail, string name, string resetUrl)
        {
            return SendAsync(
                toEmail,
                "Redefinição de senha - Finova",
                $"""
                Olá, {name}.

                Recebemos uma solicitação para redefinir sua senha no Finova.

                Acesse o link abaixo para criar uma nova senha:
                {resetUrl}

                Se você não solicitou essa alteração, ignore este e-mail.
                """);
        }

        public Task SendEmailVerificationAsync(string toEmail, string name, string verificationUrl)
        {
            return SendAsync(
                toEmail,
                "Confirmação de e-mail - Finova",
                $"""
                Olá, {name}.

                Confirme seu e-mail para ativar sua conta no Finova.

                Acesse o link abaixo para concluir a confirmação:
                {verificationUrl}

                Se você não criou esta conta, ignore este e-mail.
                """);
        }

        public Task SendBudgetGoalAlertEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount)
        {
            return SendAsync(
                toEmail,
                $"Alerta de meta mensal - {goalLabel}",
                $"""
                Olá, {name}.

                Sua meta "{goalLabel}" em {monthLabel} atingiu {progressPercent}% do limite definido.

                Valor gasto até agora: {spentAmount:C}
                Limite planejado: {targetAmount:C}

                Acesse o Finova para revisar suas movimentações e ajustar o plano do mês, se necessário.
                """);
        }

        public Task SendMonthlySummaryEmailAsync(
            string toEmail,
            string name,
            string monthLabel,
            decimal incomeAmount,
            decimal expenseAmount,
            decimal balanceAmount,
            string? topExpenseCategory,
            decimal? topExpenseAmount,
            IReadOnlyList<MonthlyGoalSummary> goalSummaries)
        {
            var goalLines = goalSummaries.Count == 0
                ? "Nenhuma meta cadastrada para este mês."
                : string.Join(
                    Environment.NewLine,
                    goalSummaries.Select(summary =>
                        $"- {summary.GoalLabel}: gasto {summary.SpentAmount:C} de {summary.TargetAmount:C}"));

            var topCategoryLine = string.IsNullOrWhiteSpace(topExpenseCategory) || topExpenseAmount is null
                ? "Categoria com maior gasto: não identificada."
                : $"Categoria com maior gasto: {topExpenseCategory} ({topExpenseAmount.Value:C}).";

            return SendAsync(
                toEmail,
                $"Resumo mensal - {monthLabel}",
                $"""
                Olá, {name}.

                Aqui esta o seu resumo financeiro de {monthLabel}.

                Receitas: {incomeAmount:C}
                Despesas: {expenseAmount:C}
                Saldo: {balanceAmount:C}

                {topCategoryLine}

                Metas do período:
                {goalLines}

                Acesse o Finova para revisar os detalhes e planejar o próximo mês.
                """);
        }

        private async Task SendAsync(string toEmail, string subject, string body)
        {
            var host = _configuration["Smtp:Host"];
            var fromEmail = _configuration["Smtp:FromEmail"];

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromEmail))
            {
                throw new InvalidOperationException("SMTP não configurado.");
            }

            var port = _configuration.GetValue("Smtp:Port", 587);
            var username = _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];
            var fromName = _configuration["Smtp:FromName"] ?? "Finova";
            var enableSsl = _configuration.GetValue("Smtp:EnableSsl", true);

            using var message = new MailMessage
            {
                From = new MailAddress(fromEmail, fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = false
            };

            message.To.Add(toEmail);

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl
            };

            if (!string.IsNullOrWhiteSpace(username))
            {
                client.Credentials = new NetworkCredential(username, password);
            }

            await client.SendMailAsync(message);
        }
    }
}
