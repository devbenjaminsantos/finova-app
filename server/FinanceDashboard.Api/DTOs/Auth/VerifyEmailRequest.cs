using System.ComponentModel.DataAnnotations;

namespace FinanceDashboard.Api.DTOs
{
    public class VerifyEmailRequest
    {
        [Required]
        [StringLength(512)]
        public string Token { get; set; } = string.Empty;
    }
}
