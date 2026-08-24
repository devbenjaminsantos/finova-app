using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class PrepareTransactionsForBankSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FinancialAccountId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ImportedAtUtc",
                table: "Transactions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Transactions",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "manual");

            migrationBuilder.AddColumn<string>(
                name: "SourceReference",
                table: "Transactions",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FinancialAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Provider = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    InstitutionName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    InstitutionCode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    AccountName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    AccountMask = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ExternalAccountId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    LastSyncedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialAccounts", x => x.Id);
                    table.CheckConstraint("CK_FinancialAccounts_Status", "[Status] IN ('disconnected', 'pending', 'connected', 'error')");
                    table.ForeignKey(
                        name: "FK_FinancialAccounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_FinancialAccountId",
                table: "Transactions",
                column: "FinancialAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_Source_SourceReference",
                table: "Transactions",
                columns: new[] { "UserId", "Source", "SourceReference" });

            migrationBuilder.Sql(
                """
                UPDATE [Transactions]
                SET [Source] = 'manual'
                WHERE [Source] IS NULL
                   OR LTRIM(RTRIM([Source])) = ''
                   OR [Source] NOT IN ('manual', 'import_csv', 'import_ofx', 'bank_sync');
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Transactions_Source",
                table: "Transactions",
                sql: "[Source] IN ('manual', 'import_csv', 'import_ofx', 'bank_sync')");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_ExternalAccountId",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "ExternalAccountId" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_Provider_InstitutionName",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "Provider", "InstitutionName" });

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_FinancialAccounts_FinancialAccountId",
                table: "Transactions",
                column: "FinancialAccountId",
                principalTable: "FinancialAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_FinancialAccounts_FinancialAccountId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "FinancialAccounts");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_FinancialAccountId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_UserId_Source_SourceReference",
                table: "Transactions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Transactions_Source",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "FinancialAccountId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ImportedAtUtc",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "SourceReference",
                table: "Transactions");
        }
    }
}
