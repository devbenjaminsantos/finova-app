using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RecurringRuleId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RecurringRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PublicId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastGeneratedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NextOccurrenceDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TagsCsv = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecurringRules", x => x.Id);
                    table.CheckConstraint("CK_RecurringRules_Type", "[Type] IN ('income', 'expense')");
                    table.ForeignKey(
                        name: "FK_RecurringRules_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_RecurringRuleId",
                table: "Transactions",
                column: "RecurringRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringRules_UserId_IsActive_NextOccurrenceDate",
                table: "RecurringRules",
                columns: new[] { "UserId", "IsActive", "NextOccurrenceDate" });

            migrationBuilder.CreateIndex(
                name: "IX_RecurringRules_UserId_PublicId",
                table: "RecurringRules",
                columns: new[] { "UserId", "PublicId" },
                unique: true);

            migrationBuilder.Sql("""
                INSERT INTO [RecurringRules] (
                    [PublicId],
                    [Description],
                    [Category],
                    [AmountCents],
                    [Type],
                    [StartDate],
                    [EndDate],
                    [LastGeneratedDate],
                    [NextOccurrenceDate],
                    [IsActive],
                    [TagsCsv],
                    [CreatedAtUtc],
                    [UserId]
                )
                SELECT
                    [RecurrenceGroupId],
                    MAX([Description]),
                    MAX([Category]),
                    MAX([AmountCents]),
                    MAX([Type]),
                    MIN([Date]),
                    MAX(ISNULL([RecurrenceEndDate], [Date])),
                    MAX([Date]),
                    CASE
                        WHEN DATEADD(month, 1, MAX([Date])) <= MAX(ISNULL([RecurrenceEndDate], [Date]))
                            THEN DATEADD(month, 1, MAX([Date]))
                        ELSE NULL
                    END,
                    CASE
                        WHEN DATEADD(month, 1, MAX([Date])) <= MAX(ISNULL([RecurrenceEndDate], [Date]))
                            THEN CAST(1 AS bit)
                        ELSE CAST(0 AS bit)
                    END,
                    '',
                    SYSUTCDATETIME(),
                    [UserId]
                FROM [Transactions]
                WHERE [RecurrenceGroupId] IS NOT NULL
                  AND [IsRecurring] = CAST(1 AS bit)
                GROUP BY [UserId], [RecurrenceGroupId];
                """);

            migrationBuilder.Sql("""
                UPDATE [Transactions]
                SET [RecurringRuleId] = [RecurringRules].[Id]
                FROM [Transactions]
                INNER JOIN [RecurringRules]
                    ON [RecurringRules].[UserId] = [Transactions].[UserId]
                   AND [RecurringRules].[PublicId] = [Transactions].[RecurrenceGroupId]
                WHERE [Transactions].[RecurrenceGroupId] IS NOT NULL
                  AND [Transactions].[IsRecurring] = CAST(1 AS bit);
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_RecurringRules_RecurringRuleId",
                table: "Transactions",
                column: "RecurringRuleId",
                principalTable: "RecurringRules",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_RecurringRules_RecurringRuleId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "RecurringRules");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_RecurringRuleId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RecurringRuleId",
                table: "Transactions");
        }
    }
}
