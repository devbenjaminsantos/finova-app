using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionalEmailDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TransactionalEmailDeliveries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    EmailVerificationTokenId = table.Column<int>(type: "integer", nullable: true),
                    PasswordResetTokenId = table.Column<int>(type: "integer", nullable: true),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ProtectedToken = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ProviderMessageId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    FailureCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionalEmailDeliveries", x => x.Id);
                    table.CheckConstraint("CK_TransactionalEmailDeliveries_ExactlyOneToken", "(\"EmailVerificationTokenId\" IS NOT NULL AND \"PasswordResetTokenId\" IS NULL) OR (\"EmailVerificationTokenId\" IS NULL AND \"PasswordResetTokenId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_TransactionalEmailDeliveries_EmailVerificationTokens_EmailV~",
                        column: x => x.EmailVerificationTokenId,
                        principalTable: "EmailVerificationTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransactionalEmailDeliveries_PasswordResetTokens_PasswordRe~",
                        column: x => x.PasswordResetTokenId,
                        principalTable: "PasswordResetTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransactionalEmailDeliveries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TransactionalEmailDeliveries_EmailVerificationTokenId",
                table: "TransactionalEmailDeliveries",
                column: "EmailVerificationTokenId",
                unique: true,
                filter: "\"EmailVerificationTokenId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionalEmailDeliveries_IdempotencyKey",
                table: "TransactionalEmailDeliveries",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransactionalEmailDeliveries_PasswordResetTokenId",
                table: "TransactionalEmailDeliveries",
                column: "PasswordResetTokenId",
                unique: true,
                filter: "\"PasswordResetTokenId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionalEmailDeliveries_UserId_EventType_Status",
                table: "TransactionalEmailDeliveries",
                columns: new[] { "UserId", "EventType", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TransactionalEmailDeliveries");
        }
    }
}
