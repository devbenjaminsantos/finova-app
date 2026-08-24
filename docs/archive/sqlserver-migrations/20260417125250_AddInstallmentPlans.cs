using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInstallmentPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InstallmentPlanId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InstallmentPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PublicId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    AmountPerInstallmentCents = table.Column<long>(type: "bigint", nullable: false),
                    InstallmentCount = table.Column<int>(type: "int", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstallmentPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InstallmentPlans_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_InstallmentPlanId",
                table: "Transactions",
                column: "InstallmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_InstallmentPlans_UserId_PublicId",
                table: "InstallmentPlans",
                columns: new[] { "UserId", "PublicId" },
                unique: true);

            migrationBuilder.Sql("""
                INSERT INTO [InstallmentPlans] (
                    [PublicId],
                    [Description],
                    [Category],
                    [AmountPerInstallmentCents],
                    [InstallmentCount],
                    [StartDate],
                    [CreatedAtUtc],
                    [UserId]
                )
                SELECT
                    [InstallmentGroupId],
                    MAX([Description]),
                    MAX([Category]),
                    MAX([AmountCents]),
                    MAX(ISNULL([InstallmentCount], 1)),
                    MIN([Date]),
                    SYSUTCDATETIME(),
                    [UserId]
                FROM [Transactions]
                WHERE [InstallmentGroupId] IS NOT NULL
                  AND ISNULL([InstallmentCount], 0) > 1
                GROUP BY [UserId], [InstallmentGroupId];
                """);

            migrationBuilder.Sql("""
                UPDATE [Transactions]
                SET [InstallmentPlanId] = [InstallmentPlans].[Id]
                FROM [Transactions]
                INNER JOIN [InstallmentPlans]
                    ON [InstallmentPlans].[UserId] = [Transactions].[UserId]
                   AND [InstallmentPlans].[PublicId] = [Transactions].[InstallmentGroupId]
                WHERE [Transactions].[InstallmentGroupId] IS NOT NULL;
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_InstallmentPlans_InstallmentPlanId",
                table: "Transactions",
                column: "InstallmentPlanId",
                principalTable: "InstallmentPlans",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_InstallmentPlans_InstallmentPlanId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "InstallmentPlans");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_InstallmentPlanId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "InstallmentPlanId",
                table: "Transactions");
        }
    }
}
