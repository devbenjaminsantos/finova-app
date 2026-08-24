using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountTypeToFinancialAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FinancialAccounts_UserId_Provider_InstitutionName",
                table: "FinancialAccounts");

            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "FinancialAccounts",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "bank_account");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_AccountType_Provider_InstitutionName",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "AccountType", "Provider", "InstitutionName" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_FinancialAccounts_AccountType",
                table: "FinancialAccounts",
                sql: "[AccountType] IN ('bank_account', 'wallet', 'cash', 'credit_card')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FinancialAccounts_UserId_AccountType_Provider_InstitutionName",
                table: "FinancialAccounts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_FinancialAccounts_AccountType",
                table: "FinancialAccounts");

            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "FinancialAccounts");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_Provider_InstitutionName",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "Provider", "InstitutionName" });
        }
    }
}
