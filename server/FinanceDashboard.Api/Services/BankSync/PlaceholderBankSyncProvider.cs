using FinanceDashboard.Api.Models;

namespace FinanceDashboard.Api.Services.BankSync
{
    public class PlaceholderBankSyncProvider : IBankSyncProvider
    {
        public bool CanHandle(FinancialAccount account)
        {
            return string.Equals(account.Provider, "manual", StringComparison.OrdinalIgnoreCase)
                || string.Equals(account.Provider, "manual-import", StringComparison.OrdinalIgnoreCase)
                || string.Equals(account.Provider, "open-finance-placeholder", StringComparison.OrdinalIgnoreCase);
        }

        public Task<BankSyncResult> FetchTransactionsAsync(
            FinancialAccount account,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new BankSyncResult
            {
                Message = $"Conta '{account.AccountName}' preparada para futura sincronização automática. Nenhuma transação nova foi importada ainda."
            });
        }
    }
}
