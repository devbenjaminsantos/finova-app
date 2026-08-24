using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicDashboardTokenHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicDashboardTokenHash",
                table: "Users",
                type: "nchar(64)",
                fixedLength: true,
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicDashboardTokenHash",
                table: "Users",
                column: "PublicDashboardTokenHash",
                unique: true,
                filter: "[PublicDashboardTokenHash] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_PublicDashboardTokenHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicDashboardTokenHash",
                table: "Users");
        }
    }
}
