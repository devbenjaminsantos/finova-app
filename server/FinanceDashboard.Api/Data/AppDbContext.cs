using Microsoft.EntityFrameworkCore;
using FinanceDashboard.Api.Models;

namespace FinanceDashboard.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {

        }

        public DbSet<User> Users { get; set; }
        public DbSet<FinancialAccount> FinancialAccounts { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<RecurringRule> RecurringRules { get; set; }
        public DbSet<InstallmentPlan> InstallmentPlans { get; set; }
        public DbSet<TransactionTag> TransactionTags { get; set; }
        public DbSet<TransactionTagLink> TransactionTagLinks { get; set; }
        public DbSet<BudgetGoal> BudgetGoals { get; set; }
        public DbSet<NotificationDelivery> NotificationDeliveries { get; set; }
        public DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.Property(user => user.Name)
                    .HasMaxLength(100);

                entity.Property(user => user.Email)
                    .HasMaxLength(256);

                entity.Property(user => user.PasswordHash)
                    .HasMaxLength(512);

                entity.Property(user => user.SessionVersion)
                    .HasDefaultValue(1);

                entity.HasIndex(user => user.Email)
                    .IsUnique();

                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_Users_MonthlyReportDay",
                        "[MonthlyReportDay] >= 1 AND [MonthlyReportDay] <= 28");
                });
            });

            modelBuilder.Entity<Transaction>(entity =>
            {
                entity.Property(transaction => transaction.Description)
                    .HasMaxLength(120);

                entity.Property(transaction => transaction.Category)
                    .HasMaxLength(60);

                entity.Property(transaction => transaction.Type)
                    .HasMaxLength(20);

                entity.Property(transaction => transaction.Source)
                    .HasMaxLength(30);

                entity.Property(transaction => transaction.SourceReference)
                    .HasMaxLength(120);

                entity.Property(transaction => transaction.RecurrenceGroupId)
                    .HasMaxLength(40);

                entity.Property(transaction => transaction.RecurringRuleId)
                    .HasColumnType("int");

                entity.Property(transaction => transaction.InstallmentGroupId)
                    .HasMaxLength(40);

                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_Transactions_Source",
                        "[Source] IN ('manual', 'import_csv', 'import_ofx', 'bank_sync')");

                    table.HasCheckConstraint(
                        "CK_Transactions_Type",
                        "[Type] IN ('income', 'expense')");
                });

                entity.HasIndex(transaction => new { transaction.UserId, transaction.RecurrenceGroupId });
                entity.HasIndex(transaction => new { transaction.UserId, transaction.InstallmentGroupId });
                entity.HasIndex(transaction => new { transaction.UserId, transaction.Source, transaction.SourceReference });

                entity.HasOne(transaction => transaction.FinancialAccount)
                    .WithMany(account => account.Transactions)
                    .HasForeignKey(transaction => transaction.FinancialAccountId)
                    .OnDelete(DeleteBehavior.NoAction);

                entity.HasOne(transaction => transaction.RecurringRule)
                    .WithMany(rule => rule.Transactions)
                    .HasForeignKey(transaction => transaction.RecurringRuleId)
                    .OnDelete(DeleteBehavior.NoAction);

                entity.HasOne(transaction => transaction.InstallmentPlan)
                    .WithMany(plan => plan.Transactions)
                    .HasForeignKey(transaction => transaction.InstallmentPlanId)
                    .OnDelete(DeleteBehavior.NoAction);

                entity.HasMany(transaction => transaction.TagLinks)
                    .WithOne(link => link.Transaction)
                    .HasForeignKey(link => link.TransactionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<InstallmentPlan>(entity =>
            {
                entity.Property(plan => plan.PublicId)
                    .HasMaxLength(40);

                entity.Property(plan => plan.Description)
                    .HasMaxLength(120);

                entity.Property(plan => plan.Category)
                    .HasMaxLength(60);

                entity.HasIndex(plan => new { plan.UserId, plan.PublicId })
                    .IsUnique();

                entity.HasOne(plan => plan.User)
                    .WithMany(user => user.InstallmentPlans)
                    .HasForeignKey(plan => plan.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RecurringRule>(entity =>
            {
                entity.Property(rule => rule.PublicId)
                    .HasMaxLength(40);

                entity.Property(rule => rule.Description)
                    .HasMaxLength(120);

                entity.Property(rule => rule.Category)
                    .HasMaxLength(60);

                entity.Property(rule => rule.Type)
                    .HasMaxLength(20);

                entity.Property(rule => rule.TagsCsv)
                    .HasMaxLength(500);

                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_RecurringRules_Type",
                        "[Type] IN ('income', 'expense')");
                });

                entity.HasIndex(rule => new { rule.UserId, rule.PublicId })
                    .IsUnique();

                entity.HasIndex(rule => new { rule.UserId, rule.IsActive, rule.NextOccurrenceDate });

                entity.HasOne(rule => rule.User)
                    .WithMany(user => user.RecurringRules)
                    .HasForeignKey(rule => rule.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TransactionTag>(entity =>
            {
                entity.Property(tag => tag.Name)
                    .HasMaxLength(40);

                entity.HasIndex(tag => new { tag.UserId, tag.Name })
                    .IsUnique();

                entity.HasOne(tag => tag.User)
                    .WithMany(user => user.TransactionTags)
                    .HasForeignKey(tag => tag.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TransactionTagLink>(entity =>
            {
                entity.HasKey(link => new { link.TransactionId, link.TransactionTagId });

                entity.HasOne(link => link.Transaction)
                    .WithMany(transaction => transaction.TagLinks)
                    .HasForeignKey(link => link.TransactionId)
                    .OnDelete(DeleteBehavior.NoAction);

                entity.HasOne(link => link.TransactionTag)
                    .WithMany(tag => tag.TransactionLinks)
                    .HasForeignKey(link => link.TransactionTagId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<FinancialAccount>(entity =>
            {
                entity.Property(account => account.AccountType)
                    .HasMaxLength(40);

                entity.Property(account => account.Provider)
                    .HasMaxLength(40);

                entity.Property(account => account.InstitutionName)
                    .HasMaxLength(120);

                entity.Property(account => account.InstitutionCode)
                    .HasMaxLength(40);

                entity.Property(account => account.AccountName)
                    .HasMaxLength(120);

                entity.Property(account => account.AccountMask)
                    .HasMaxLength(32);

                entity.Property(account => account.ExternalAccountId)
                    .HasMaxLength(120);

                entity.Property(account => account.ProviderItemId)
                    .HasMaxLength(120);

                entity.Property(account => account.Status)
                    .HasMaxLength(30);

                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_FinancialAccounts_Status",
                        "[Status] IN ('disconnected', 'pending', 'connected', 'error')");

                    table.HasCheckConstraint(
                        "CK_FinancialAccounts_AccountType",
                        "[AccountType] IN ('bank_account', 'wallet', 'cash', 'credit_card')");
                });

                entity.HasIndex(account => new { account.UserId, account.ExternalAccountId });
                entity.HasIndex(account => new { account.UserId, account.ProviderItemId });
                entity.HasIndex(account => new { account.UserId, account.AccountType, account.Provider, account.InstitutionName });

                entity.HasOne(account => account.User)
                    .WithMany(user => user.FinancialAccounts)
                    .HasForeignKey(account => account.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<BudgetGoal>(entity =>
            {
                entity.Property(goal => goal.Month)
                    .HasMaxLength(7);

                entity.Property(goal => goal.Category)
                    .HasMaxLength(60);

                entity.HasIndex(goal => new { goal.UserId, goal.Month, goal.Category })
                    .IsUnique();

                entity.HasOne(goal => goal.User)
                    .WithMany(user => user.BudgetGoals)
                    .HasForeignKey(goal => goal.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<PasswordResetToken>(entity =>
            {
                entity.Property(token => token.TokenHash)
                    .HasMaxLength(128);

                entity.HasIndex(token => token.TokenHash)
                    .IsUnique();

                entity.HasIndex(token => token.UserId);

                entity.HasOne(token => token.User)
                    .WithMany(user => user.PasswordResetTokens)
                    .HasForeignKey(token => token.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<EmailVerificationToken>(entity =>
            {
                entity.Property(token => token.TokenHash)
                    .HasMaxLength(128);

                entity.HasIndex(token => token.TokenHash)
                    .IsUnique();

                entity.HasIndex(token => token.UserId);

                entity.HasOne(token => token.User)
                    .WithMany(user => user.EmailVerificationTokens)
                    .HasForeignKey(token => token.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.Property(log => log.Action)
                    .HasMaxLength(80);

                entity.Property(log => log.EntityType)
                    .HasMaxLength(80);

                entity.Property(log => log.EntityId)
                    .HasMaxLength(64);

                entity.Property(log => log.Summary)
                    .HasMaxLength(400);

                entity.Property(log => log.IpAddress)
                    .HasMaxLength(64);

                entity.HasIndex(log => new { log.UserId, log.CreatedAtUtc });

                entity.HasOne(log => log.User)
                    .WithMany(user => user.AuditLogs)
                    .HasForeignKey(log => log.UserId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<NotificationDelivery>(entity =>
            {
                entity.Property(delivery => delivery.NotificationType)
                    .HasMaxLength(40);

                entity.Property(delivery => delivery.ReferenceKey)
                    .HasMaxLength(120);

                entity.Property(delivery => delivery.Subject)
                    .HasMaxLength(200);

                entity.HasIndex(delivery => new
                {
                    delivery.UserId,
                    delivery.NotificationType,
                    delivery.ReferenceKey
                }).IsUnique();

                entity.HasIndex(delivery => new { delivery.NotificationType, delivery.SentAtUtc });

                entity.HasOne(delivery => delivery.User)
                    .WithMany(user => user.NotificationDeliveries)
                    .HasForeignKey(delivery => delivery.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
