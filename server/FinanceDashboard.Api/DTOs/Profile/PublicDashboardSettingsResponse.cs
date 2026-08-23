namespace FinanceDashboard.Api.DTOs.Profile
{
    public class PublicDashboardSettingsResponse
    {
        public bool Enabled { get; set; }
        public bool HasActiveToken { get; set; }
        public string? PublicUrl { get; set; }
    }
}
