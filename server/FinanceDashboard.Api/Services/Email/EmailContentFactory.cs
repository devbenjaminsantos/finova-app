using FinanceDashboard.Api.Services.Notifications;

namespace FinanceDashboard.Api.Services.Email
{
    internal static class EmailContentFactory
    {
        public static EmailContent PasswordReset(string name, string resetUrl) =>
            new(
                "Redefinição de senha - Héstia",
                $"""
                Olá, {name}.

                Recebemos uma solicitação para redefinir sua senha na Héstia.

                Acesse o link abaixo para criar uma nova senha:
                {resetUrl}

                Se você não solicitou essa alteração, ignore este e-mail.
                """);

        public static EmailContent EmailVerification(string name, string verificationUrl) =>
            new(
                "Confirmação de e-mail - Héstia",
                $"""
                Olá, {name}.

                Confirme seu e-mail para ativar sua conta na Héstia.

                Acesse o link abaixo para concluir a confirmação:
                {verificationUrl}

                Se você não criou esta conta, ignore este e-mail.
                """);

        public static EmailContent BudgetGoalAlert(
            string name,
            string monthLabel,
            string goalLabel,
            int progressPercent,
            decimal spentAmount,
            decimal targetAmount) =>
            new(
                $"Alerta de meta mensal - {goalLabel}",
                $"""
                Olá, {name}.

                Sua meta "{goalLabel}" em {monthLabel} atingiu {progressPercent}% do limite definido.

                Valor gasto até agora: {spentAmount:C}
                Limite planejado: {targetAmount:C}

                Acesse a Héstia para revisar suas movimentações e ajustar o plano do mês, se necessário.
                """);

        public static EmailContent MonthlySummary(
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

            return new EmailContent(
                $"Resumo mensal - {monthLabel}",
                $"""
                Olá, {name}.

                Aqui está o seu resumo financeiro de {monthLabel}.

                Receitas: {incomeAmount:C}
                Despesas: {expenseAmount:C}
                Saldo: {balanceAmount:C}

                {topCategoryLine}

                Metas do período:
                {goalLines}

                Acesse a Héstia para revisar os detalhes e planejar o próximo mês.
                """);
        }
    }

    internal sealed record EmailContent(string Subject, string Text);
}
