using System.ComponentModel.DataAnnotations;

namespace FinanceDashboard.Api.DTOs
{
    public class FinancialAccountCreateRequest
    {
        [Required]
        [StringLength(40, MinimumLength = 2)]
        [RegularExpression("^(bank_account|wallet|cash|credit_card)$")]
        public string AccountType { get; set; } = "bank_account";

        [Required]
        [StringLength(40, MinimumLength = 2)]
        [RegularExpression("^(manual|pluggy)$")]
        public string Provider { get; set; } = string.Empty;

        [Required]
        [StringLength(120, MinimumLength = 2)]
        public string InstitutionName { get; set; } = string.Empty;

        [StringLength(40)]
        public string? InstitutionCode { get; set; }

        [Required]
        [StringLength(120, MinimumLength = 2)]
        public string AccountName { get; set; } = string.Empty;

        [StringLength(32)]
        public string? AccountMask { get; set; }

        [StringLength(120)]
        public string? ExternalAccountId { get; set; }
    }
}
