using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProviderItemIdToFinancialAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProviderItemId",
                table: "FinancialAccounts",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_ProviderItemId",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "ProviderItemId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FinancialAccounts_UserId_ProviderItemId",
                table: "FinancialAccounts");

            migrationBuilder.DropColumn(
                name: "ProviderItemId",
                table: "FinancialAccounts");
        }
    }
}
