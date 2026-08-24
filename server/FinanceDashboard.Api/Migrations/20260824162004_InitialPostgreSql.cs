using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FinanceDashboard.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,");

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    OnboardingOptIn = table.Column<bool>(type: "boolean", nullable: true),
                    EmailGoalAlertsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    GoalAlertThresholdPercent = table.Column<int>(type: "integer", nullable: false),
                    MonthlyReportEmailsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    MonthlyReportDay = table.Column<int>(type: "integer", nullable: false),
                    PublicDashboardEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PublicDashboardTokenHash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: true),
                    IsDemoAccount = table.Column<bool>(type: "boolean", nullable: false),
                    DemoExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    SessionVersion = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    FailedLoginAttempts = table.Column<int>(type: "integer", nullable: false),
                    LockoutEndsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastFailedLoginAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.CheckConstraint("CK_Users_MonthlyReportDay", "\"MonthlyReportDay\" >= 1 AND \"MonthlyReportDay\" <= 28");
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Summary = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "BudgetGoals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Month = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    Category = table.Column<string>(type: "citext", maxLength: 60, nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetGoals", x => x.Id);
                    table.CheckConstraint("CK_BudgetGoals_Category_Length", "char_length(\"Category\") <= 60");
                    table.ForeignKey(
                        name: "FK_BudgetGoals_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EmailVerificationTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailVerificationTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmailVerificationTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FinancialAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    InstitutionName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    InstitutionCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AccountName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AccountMask = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ExternalAccountId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ProviderItemId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LastSyncedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialAccounts", x => x.Id);
                    table.CheckConstraint("CK_FinancialAccounts_AccountType", "\"AccountType\" IN ('bank_account', 'wallet', 'cash', 'credit_card')");
                    table.CheckConstraint("CK_FinancialAccounts_Status", "\"Status\" IN ('disconnected', 'pending', 'connected', 'error')");
                    table.ForeignKey(
                        name: "FK_FinancialAccounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InstallmentPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "citext", maxLength: 60, nullable: false),
                    AmountPerInstallmentCents = table.Column<long>(type: "bigint", nullable: false),
                    InstallmentCount = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstallmentPlans", x => x.Id);
                    table.CheckConstraint("CK_InstallmentPlans_Category_Length", "char_length(\"Category\") <= 60");
                    table.ForeignKey(
                        name: "FK_InstallmentPlans_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NotificationDeliveries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NotificationType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ReferenceKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationDeliveries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordResetTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RecurringRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "citext", maxLength: 60, nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateTime>(type: "date", nullable: false),
                    EndDate = table.Column<DateTime>(type: "date", nullable: false),
                    LastGeneratedDate = table.Column<DateTime>(type: "date", nullable: true),
                    NextOccurrenceDate = table.Column<DateTime>(type: "date", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    TagsCsv = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecurringRules", x => x.Id);
                    table.CheckConstraint("CK_RecurringRules_Category_Length", "char_length(\"Category\") <= 60");
                    table.CheckConstraint("CK_RecurringRules_Type", "\"Type\" IN ('income', 'expense')");
                    table.ForeignKey(
                        name: "FK_RecurringRules_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransactionTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "citext", maxLength: 40, nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionTags", x => x.Id);
                    table.CheckConstraint("CK_TransactionTags_Name_Length", "char_length(\"Name\") <= 40");
                    table.ForeignKey(
                        name: "FK_TransactionTags_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "citext", maxLength: 60, nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: false),
                    Date = table.Column<DateTime>(type: "date", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SourceReference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsRecurring = table.Column<bool>(type: "boolean", nullable: false),
                    RecurrenceEndDate = table.Column<DateTime>(type: "date", nullable: true),
                    RecurrenceGroupId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RecurringRuleId = table.Column<int>(type: "integer", nullable: true),
                    InstallmentIndex = table.Column<int>(type: "integer", nullable: true),
                    InstallmentCount = table.Column<int>(type: "integer", nullable: true),
                    InstallmentGroupId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    InstallmentPlanId = table.Column<int>(type: "integer", nullable: true),
                    FinancialAccountId = table.Column<int>(type: "integer", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.CheckConstraint("CK_Transactions_Category_Length", "char_length(\"Category\") <= 60");
                    table.CheckConstraint("CK_Transactions_Source", "\"Source\" IN ('manual', 'import_csv', 'import_ofx', 'bank_sync')");
                    table.CheckConstraint("CK_Transactions_Type", "\"Type\" IN ('income', 'expense')");
                    table.ForeignKey(
                        name: "FK_Transactions_FinancialAccounts_FinancialAccountId",
                        column: x => x.FinancialAccountId,
                        principalTable: "FinancialAccounts",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Transactions_InstallmentPlans_InstallmentPlanId",
                        column: x => x.InstallmentPlanId,
                        principalTable: "InstallmentPlans",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Transactions_RecurringRules_RecurringRuleId",
                        column: x => x.RecurringRuleId,
                        principalTable: "RecurringRules",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Transactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransactionTagLinks",
                columns: table => new
                {
                    TransactionId = table.Column<int>(type: "integer", nullable: false),
                    TransactionTagId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionTagLinks", x => new { x.TransactionId, x.TransactionTagId });
                    table.ForeignKey(
                        name: "FK_TransactionTagLinks_TransactionTags_TransactionTagId",
                        column: x => x.TransactionTagId,
                        principalTable: "TransactionTags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransactionTagLinks_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId_CreatedAtUtc",
                table: "AuditLogs",
                columns: new[] { "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetGoals_UserId_Month_Category",
                table: "BudgetGoals",
                columns: new[] { "UserId", "Month", "Category" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationTokens_TokenHash",
                table: "EmailVerificationTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationTokens_UserId",
                table: "EmailVerificationTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_AccountType_Provider_InstitutionNa~",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "AccountType", "Provider", "InstitutionName" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_ExternalAccountId",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "ExternalAccountId" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialAccounts_UserId_ProviderItemId",
                table: "FinancialAccounts",
                columns: new[] { "UserId", "ProviderItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_InstallmentPlans_UserId_PublicId",
                table: "InstallmentPlans",
                columns: new[] { "UserId", "PublicId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDeliveries_NotificationType_SentAtUtc",
                table: "NotificationDeliveries",
                columns: new[] { "NotificationType", "SentAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDeliveries_UserId_NotificationType_ReferenceKey",
                table: "NotificationDeliveries",
                columns: new[] { "UserId", "NotificationType", "ReferenceKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_TokenHash",
                table: "PasswordResetTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_UserId",
                table: "PasswordResetTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringRules_UserId_IsActive_NextOccurrenceDate",
                table: "RecurringRules",
                columns: new[] { "UserId", "IsActive", "NextOccurrenceDate" });

            migrationBuilder.CreateIndex(
                name: "IX_RecurringRules_UserId_PublicId",
                table: "RecurringRules",
                columns: new[] { "UserId", "PublicId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_FinancialAccountId",
                table: "Transactions",
                column: "FinancialAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_InstallmentPlanId",
                table: "Transactions",
                column: "InstallmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_RecurringRuleId",
                table: "Transactions",
                column: "RecurringRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_InstallmentGroupId",
                table: "Transactions",
                columns: new[] { "UserId", "InstallmentGroupId" });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_RecurrenceGroupId",
                table: "Transactions",
                columns: new[] { "UserId", "RecurrenceGroupId" });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_Source_SourceReference",
                table: "Transactions",
                columns: new[] { "UserId", "Source", "SourceReference" });

            migrationBuilder.CreateIndex(
                name: "IX_TransactionTagLinks_TransactionTagId",
                table: "TransactionTagLinks",
                column: "TransactionTagId");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionTags_UserId_Name",
                table: "TransactionTags",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsDemoAccount_DemoExpiresAtUtc",
                table: "Users",
                columns: new[] { "IsDemoAccount", "DemoExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicDashboardTokenHash",
                table: "Users",
                column: "PublicDashboardTokenHash",
                unique: true,
                filter: "\"PublicDashboardTokenHash\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BudgetGoals");

            migrationBuilder.DropTable(
                name: "EmailVerificationTokens");

            migrationBuilder.DropTable(
                name: "NotificationDeliveries");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens");

            migrationBuilder.DropTable(
                name: "TransactionTagLinks");

            migrationBuilder.DropTable(
                name: "TransactionTags");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "FinancialAccounts");

            migrationBuilder.DropTable(
                name: "InstallmentPlans");

            migrationBuilder.DropTable(
                name: "RecurringRules");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
