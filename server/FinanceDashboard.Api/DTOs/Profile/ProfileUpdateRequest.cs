using System.ComponentModel.DataAnnotations;

namespace FinanceDashboard.Api.DTOs
{
    public class ProfileUpdateRequest
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public bool EmailGoalAlertsEnabled { get; set; }

        [Range(50, 100)]
        public int GoalAlertThresholdPercent { get; set; } = 80;

        public bool MonthlyReportEmailsEnabled { get; set; }

        [Range(1, 28)]
        public int MonthlyReportDay { get; set; } = 1;

        [StringLength(128)]
        public string CurrentPassword { get; set; } = string.Empty;

        [StringLength(128)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
