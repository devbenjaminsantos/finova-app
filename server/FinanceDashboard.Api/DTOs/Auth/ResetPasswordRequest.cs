using System.ComponentModel.DataAnnotations;

namespace FinanceDashboard.Api.DTOs
{
    public class ResetPasswordRequest
    {
        [Required]
        [StringLength(512)]
        public string Token { get; set; } = string.Empty;

        [Required]
        [MinLength(10)]
        [StringLength(128)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
