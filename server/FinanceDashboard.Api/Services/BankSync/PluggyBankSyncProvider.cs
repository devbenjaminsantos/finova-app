using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.BankSync.Pluggy;

namespace FinanceDashboard.Api.Services.BankSync
{
    public class PluggyBankSyncProvider : IBankSyncProvider
    {
        private readonly IPluggyClient _pluggyClient;

        public PluggyBankSyncProvider(IPluggyClient pluggyClient)
        {
            _pluggyClient = pluggyClient;
        }

        public bool CanHandle(FinancialAccount account)
        {
            return string.Equals(account.Provider, "pluggy", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(account.ProviderItemId);
        }

        public async Task<BankSyncResult> FetchTransactionsAsync(
            FinancialAccount account,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(account.ProviderItemId))
            {
                throw new InvalidOperationException("Esta conta ainda não foi vinculada a um item do Pluggy.");
            }

            await _pluggyClient.UpdateItemAsync(account.ProviderItemId, cancellationToken);

            var accounts = await _pluggyClient.GetAccountsAsync(account.ProviderItemId, cancellationToken);
            var from = (account.LastSyncedAtUtc ?? DateTime.UtcNow.AddMonths(-3)).AddDays(-2);
            var importedItems = new List<BankSyncImportItem>();

            foreach (var pluggyAccount in accounts)
            {
                var transactions = await _pluggyClient.GetTransactionsAsync(pluggyAccount.Id, from, cancellationToken);

                foreach (var transaction in transactions)
                {
                    var normalizedType = NormalizeType(transaction.Type, transaction.Amount);
                    var normalizedAmount = Math.Abs(decimal.ToInt64(decimal.Round(transaction.Amount * 100m, 0, MidpointRounding.AwayFromZero)));
                    var description = BuildDescription(transaction, pluggyAccount);

                    importedItems.Add(new BankSyncImportItem
                    {
                        Description = description,
                        Category = PluggyCategoryMapper.Categorize(normalizedType, description),
                        AmountCents = normalizedAmount,
                        Date = transaction.Date,
                        Type = normalizedType,
                        SourceReference = transaction.Id
                    });
                }
            }

            return new BankSyncResult
            {
                Items = importedItems,
                Message = importedItems.Count == 0
                    ? "Sincronização concluída. Nenhuma transação nova foi encontrada no Pluggy."
                    : $"Sincronização concluída. {importedItems.Count} transações foram preparadas para importação."
            };
        }

        private static string NormalizeType(string? sourceType, decimal amount)
        {
            var normalized = (sourceType ?? string.Empty).Trim().ToLowerInvariant();

            if (normalized is "credit" or "income")
            {
                return "income";
            }

            if (normalized is "debit" or "expense")
            {
                return "expense";
            }

            return amount >= 0 ? "income" : "expense";
        }

        private static string BuildDescription(PluggyTransactionResponse transaction, PluggyAccountResponse account)
        {
            var description = transaction.Description?.Trim();

            if (!string.IsNullOrWhiteSpace(description))
            {
                return description;
            }

            if (!string.IsNullOrWhiteSpace(transaction.PaymentData?.Receiver?.Name))
            {
                return transaction.PaymentData.Receiver.Name.Trim();
            }

            if (!string.IsNullOrWhiteSpace(transaction.PaymentData?.Payer?.Name))
            {
                return transaction.PaymentData.Payer.Name.Trim();
            }

            if (!string.IsNullOrWhiteSpace(account.Name))
            {
                return $"Movimentacao em {account.Name.Trim()}";
            }

            return "Movimentacao bancaria";
        }
    }
}
