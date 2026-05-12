using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Services.BankSync
{
    public class BankSyncService
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<IBankSyncProvider> _providers;

        public BankSyncService(AppDbContext context, IEnumerable<IBankSyncProvider> providers)
        {
            _context = context;
            _providers = providers;
        }

        public async Task<FinancialAccountSyncResponse> SyncAsync(
            FinancialAccount account,
            CancellationToken cancellationToken = default)
        {
            var provider = _providers.FirstOrDefault(item => item.CanHandle(account));

            if (provider is null)
            {
                account.Status = "error";
                await _context.SaveChangesAsync(cancellationToken);

                return new FinancialAccountSyncResponse
                {
                    FinancialAccountId = account.Id,
                    ImportedCount = 0,
                    SkippedCount = 0,
                    SyncedAtUtc = DateTime.UtcNow,
                    Status = account.Status,
                    Message = "Nenhum provedor de sincronização compatível foi encontrado para esta conta."
                };
            }

            var syncResult = await provider.FetchTransactionsAsync(account, cancellationToken);
            var importedAtUtc = DateTime.UtcNow;
            var importedCount = 0;
            var skippedCount = 0;

            foreach (var item in syncResult.Items)
            {
                var sourceReference = string.IsNullOrWhiteSpace(item.SourceReference)
                    ? null
                    : item.SourceReference.Trim();

                if (!string.IsNullOrWhiteSpace(sourceReference))
                {
                    var alreadyExists = await _context.Transactions.AnyAsync(
                        transaction =>
                            transaction.UserId == account.UserId &&
                            transaction.Source == "bank_sync" &&
                            transaction.SourceReference == sourceReference,
                        cancellationToken);

                    if (alreadyExists)
                    {
                        skippedCount += 1;
                        continue;
                    }
                }

                _context.Transactions.Add(new Transaction
                {
                    UserId = account.UserId,
                    FinancialAccountId = account.Id,
                    Description = item.Description.Trim(),
                    Category = item.Category.Trim(),
                    AmountCents = item.AmountCents,
                    Date = item.Date.Date,
                    Type = item.Type.Trim().ToLowerInvariant(),
                    Source = "bank_sync",
                    SourceReference = sourceReference,
                    ImportedAtUtc = importedAtUtc,
                    IsRecurring = false
                });

                importedCount += 1;
            }

            account.Status = "connected";
            account.LastSyncedAtUtc = importedAtUtc;

            await _context.SaveChangesAsync(cancellationToken);

            return new FinancialAccountSyncResponse
            {
                FinancialAccountId = account.Id,
                ImportedCount = importedCount,
                SkippedCount = skippedCount,
                SyncedAtUtc = importedAtUtc,
                Status = account.Status,
                Message = string.IsNullOrWhiteSpace(syncResult.Message)
                    ? "Sincronização concluída."
                    : syncResult.Message
            };
        }
    }
}
