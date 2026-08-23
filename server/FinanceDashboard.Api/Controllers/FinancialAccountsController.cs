using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using FinanceDashboard.Api.Services.Audit;
using FinanceDashboard.Api.Services.BankSync;
using FinanceDashboard.Api.Services.BankSync.Pluggy;
using FinanceDashboard.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FinancialAccountsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUserService _currentUserService;
        private readonly AuditLogService _auditLogService;
        private readonly BankSyncService _bankSyncService;
        private readonly IPluggyClient _pluggyClient;

        public FinancialAccountsController(
            AppDbContext context,
            CurrentUserService currentUserService,
            AuditLogService auditLogService,
            BankSyncService bankSyncService,
            IPluggyClient pluggyClient)
        {
            _context = context;
            _currentUserService = currentUserService;
            _auditLogService = auditLogService;
            _bankSyncService = bankSyncService;
            _pluggyClient = pluggyClient;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<FinancialAccountResponse>>> GetAll()
        {
            var userId = _currentUserService.GetRequiredUserId();

            var accounts = await _context.FinancialAccounts
                .Include(account => account.Transactions)
                .Where(account => account.UserId == userId)
                .OrderBy(account => account.InstitutionName)
                .ThenBy(account => account.AccountName)
                .ToListAsync();

            return Ok(accounts.Select(ToResponse).ToList());
        }

        [HttpPost]
        public async Task<ActionResult<FinancialAccountResponse>> Create(FinancialAccountCreateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = new FinancialAccount
            {
                AccountType = dto.AccountType.Trim().ToLowerInvariant(),
                Provider = dto.Provider.Trim().ToLowerInvariant(),
                InstitutionName = dto.InstitutionName.Trim(),
                InstitutionCode = dto.InstitutionCode?.Trim(),
                AccountName = dto.AccountName.Trim(),
                AccountMask = dto.AccountMask?.Trim(),
                ExternalAccountId = dto.ExternalAccountId?.Trim(),
                Status = "pending",
                UserId = userId
            };

            _context.FinancialAccounts.Add(account);
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "financial-account.created",
                entityType: "FinancialAccount",
                entityId: account.Id.ToString(),
                userId: userId,
                summary: $"Conta financeira adicionada: {account.InstitutionName} - {account.AccountName}.");

            return CreatedAtAction(nameof(GetAll), new { id = account.Id }, ToResponse(account));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<FinancialAccountResponse>> Update(int id, FinancialAccountUpdateRequest dto)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = await _context.FinancialAccounts
                .Include(item => item.Transactions)
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId);

            if (account is null)
            {
                return NotFound();
            }

            account.AccountType = dto.AccountType.Trim().ToLowerInvariant();
            account.Provider = dto.Provider.Trim().ToLowerInvariant();
            account.InstitutionName = dto.InstitutionName.Trim();
            account.InstitutionCode = dto.InstitutionCode?.Trim();
            account.AccountName = dto.AccountName.Trim();
            account.AccountMask = dto.AccountMask?.Trim();
            account.ExternalAccountId = dto.ExternalAccountId?.Trim();

            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "financial-account.updated",
                entityType: "FinancialAccount",
                entityId: account.Id.ToString(),
                userId: userId,
                summary: $"Conta financeira atualizada: {account.InstitutionName} - {account.AccountName}.");

            return Ok(ToResponse(account));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = await _context.FinancialAccounts
                .Include(item => item.Transactions)
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId);

            if (account is null)
            {
                return NotFound();
            }

            var linkedTransactionsCount = account.Transactions.Count;

            _context.FinancialAccounts.Remove(account);
            await _context.SaveChangesAsync();

            await _auditLogService.WriteAsync(
                action: "financial-account.deleted",
                entityType: "FinancialAccount",
                entityId: id.ToString(),
                userId: userId,
                summary:
                    linkedTransactionsCount > 0
                        ? $"Conta financeira removida: {account.InstitutionName} - {account.AccountName}. {linkedTransactionsCount} transação(ões) seguiram sem vinculação."
                        : $"Conta financeira removida: {account.InstitutionName} - {account.AccountName}.");

            return NoContent();
        }

        [HttpPost("{id:int}/connect-token")]
        public async Task<ActionResult<FinancialAccountConnectTokenResponse>> CreateConnectToken(
            int id,
            CancellationToken cancellationToken)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = await _context.FinancialAccounts
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

            if (account is null)
            {
                return NotFound();
            }

            if (!string.Equals(account.Provider, "pluggy", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Esta conta não usa o provedor Pluggy."
                });
            }

            if (!_pluggyClient.IsConfigured)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Pluggy não configurado no back-end."
                });
            }

            var connectToken = await _pluggyClient.CreateConnectTokenAsync(
                clientUserId: $"user:{userId}",
                itemId: account.ProviderItemId,
                cancellationToken);

            return Ok(new FinancialAccountConnectTokenResponse
            {
                ConnectToken = connectToken
            });
        }

        [HttpPost("{id:int}/link-item")]
        public async Task<ActionResult<FinancialAccountResponse>> LinkItem(
            int id,
            FinancialAccountLinkItemRequest dto,
            CancellationToken cancellationToken)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = await _context.FinancialAccounts
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

            if (account is null)
            {
                return NotFound();
            }

            if (!string.Equals(account.Provider, "pluggy", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Esta conta não usa o provedor Pluggy."
                });
            }

            if (!_pluggyClient.IsConfigured)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Pluggy não configurado no back-end."
                });
            }

            var item = await _pluggyClient.GetItemAsync(dto.ItemId.Trim(), cancellationToken);

            if (!string.Equals(
                    item.ClientUserId,
                    $"user:{userId}",
                    StringComparison.Ordinal))
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Item Pluggy inválido para o usuário autenticado."
                });
            }

            account.ProviderItemId = item.Id;
            account.Status = NormalizeStatus(item.Status);

            if (!string.IsNullOrWhiteSpace(dto.InstitutionName))
            {
                account.InstitutionName = dto.InstitutionName.Trim();
            }
            else if (!string.IsNullOrWhiteSpace(item.Connector?.Name))
            {
                account.InstitutionName = item.Connector.Name.Trim();
            }

            if (!string.IsNullOrWhiteSpace(dto.AccountName))
            {
                account.AccountName = dto.AccountName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(dto.AccountMask))
            {
                account.AccountMask = dto.AccountMask.Trim();
            }

            await _context.SaveChangesAsync(cancellationToken);

            await _auditLogService.WriteAsync(
                action: "financial-account.linked",
                entityType: "FinancialAccount",
                entityId: account.Id.ToString(),
                userId: userId,
                summary: $"Conta financeira vinculada ao Pluggy: {account.InstitutionName} - {account.AccountName}.");

            return Ok(ToResponse(account));
        }

        [HttpPost("{id:int}/sync")]
        public async Task<ActionResult<FinancialAccountSyncResponse>> Sync(int id, CancellationToken cancellationToken)
        {
            var userId = _currentUserService.GetRequiredUserId();

            var account = await _context.FinancialAccounts
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

            if (account is null)
            {
                return NotFound();
            }

            if (!string.Equals(account.Provider, "pluggy", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(account.ProviderItemId))
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Esta conta ainda não possui uma conexão Pluggy pronta para sincronização."
                });
            }

            if (!_pluggyClient.IsConfigured)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Pluggy não configurado no back-end."
                });
            }

            var result = await _bankSyncService.SyncAsync(account, cancellationToken);

            await _auditLogService.WriteAsync(
                action: "financial-account.synced",
                entityType: "FinancialAccount",
                entityId: account.Id.ToString(),
                userId: userId,
                summary: $"Sincronização executada para {account.InstitutionName} - {account.AccountName}: {result.ImportedCount} importadas, {result.SkippedCount} ignoradas.");

            return Ok(result);
        }

        private static FinancialAccountResponse ToResponse(FinancialAccount account)
        {
            return new FinancialAccountResponse
            {
                Id = account.Id,
                AccountType = account.AccountType,
                Provider = account.Provider,
                InstitutionName = account.InstitutionName,
                InstitutionCode = account.InstitutionCode,
                AccountName = account.AccountName,
                AccountMask = account.AccountMask,
                ExternalAccountId = account.ExternalAccountId,
                ProviderItemId = account.ProviderItemId,
                Status = account.Status,
                LastSyncedAtUtc = account.LastSyncedAtUtc,
                LinkedTransactionsCount = account.Transactions?.Count ?? 0
            };
        }

        private static string NormalizeStatus(string? status)
        {
            var normalized = (status ?? string.Empty).Trim().ToUpperInvariant();

            return normalized switch
            {
                "UPDATED" => "connected",
                "LOGIN_IN_PROGRESS" => "pending",
                "WAITING_USER_INPUT" => "pending",
                "ERROR" => "error",
                _ => "pending"
            };
        }
    }
}
