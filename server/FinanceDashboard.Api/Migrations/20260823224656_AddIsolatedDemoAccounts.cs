using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsolatedDemoAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DemoExpiresAtUtc",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDemoAccount",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsDemoAccount_DemoExpiresAtUtc",
                table: "Users",
                columns: new[] { "IsDemoAccount", "DemoExpiresAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_IsDemoAccount_DemoExpiresAtUtc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DemoExpiresAtUtc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsDemoAccount",
                table: "Users");
        }
    }
}
