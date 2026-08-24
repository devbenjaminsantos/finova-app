using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class AppDbContextModelTests
{
    [Fact]
    public void PublicDashboardTokenIndexUsesSqlServerFilter()
    {
        using var context = CreateSqlServerContext();

        Assert.Equal(
            "[PublicDashboardTokenHash] IS NOT NULL",
            GetPublicDashboardTokenIndexFilter(context));
    }

    [Fact]
    public void PublicDashboardTokenIndexUsesPostgreSqlFilter()
    {
        using var context = CreatePostgreSqlContext();

        Assert.Equal(
            "\"PublicDashboardTokenHash\" IS NOT NULL",
            GetPublicDashboardTokenIndexFilter(context));
    }

    [Fact]
    public void CheckConstraintsUseSqlServerIdentifiers()
    {
        using var context = CreateSqlServerContext();

        Assert.Equal(
            "[MonthlyReportDay] >= 1 AND [MonthlyReportDay] <= 28",
            GetCheckConstraintSql<User>(context, "CK_Users_MonthlyReportDay"));
        Assert.Equal(
            "[Source] IN ('manual', 'import_csv', 'import_ofx', 'bank_sync')",
            GetCheckConstraintSql<Transaction>(context, "CK_Transactions_Source"));
        Assert.Equal(
            "[Type] IN ('income', 'expense')",
            GetCheckConstraintSql<Transaction>(context, "CK_Transactions_Type"));
    }

    [Fact]
    public void CheckConstraintsUsePostgreSqlIdentifiers()
    {
        using var context = CreatePostgreSqlContext();

        Assert.Equal(
            "\"MonthlyReportDay\" >= 1 AND \"MonthlyReportDay\" <= 28",
            GetCheckConstraintSql<User>(context, "CK_Users_MonthlyReportDay"));
        Assert.Equal(
            "\"Source\" IN ('manual', 'import_csv', 'import_ofx', 'bank_sync')",
            GetCheckConstraintSql<Transaction>(context, "CK_Transactions_Source"));
        Assert.Equal(
            "\"Type\" IN ('income', 'expense')",
            GetCheckConstraintSql<RecurringRule>(context, "CK_RecurringRules_Type"));
        Assert.Equal(
            "\"Status\" IN ('disconnected', 'pending', 'connected', 'error')",
            GetCheckConstraintSql<FinancialAccount>(context, "CK_FinancialAccounts_Status"));
        Assert.Equal(
            "\"AccountType\" IN ('bank_account', 'wallet', 'cash', 'credit_card')",
            GetCheckConstraintSql<FinancialAccount>(context, "CK_FinancialAccounts_AccountType"));
    }

    [Fact]
    public void CivilDatesUseDateColumnsInBothProviders()
    {
        using var sqlServerContext = CreateSqlServerContext();
        using var postgreSqlContext = CreatePostgreSqlContext();

        var civilDates = new (Type EntityType, string PropertyName)[]
        {
            (typeof(Transaction), nameof(Transaction.Date)),
            (typeof(Transaction), nameof(Transaction.RecurrenceEndDate)),
            (typeof(RecurringRule), nameof(RecurringRule.StartDate)),
            (typeof(RecurringRule), nameof(RecurringRule.EndDate)),
            (typeof(RecurringRule), nameof(RecurringRule.LastGeneratedDate)),
            (typeof(RecurringRule), nameof(RecurringRule.NextOccurrenceDate)),
            (typeof(InstallmentPlan), nameof(InstallmentPlan.StartDate))
        };

        foreach (var (entityType, propertyName) in civilDates)
        {
            Assert.Equal("date", GetColumnType(sqlServerContext, entityType, propertyName));
            Assert.Equal("date", GetColumnType(postgreSqlContext, entityType, propertyName));
        }
    }

    [Fact]
    public void PostgreSqlUsesUtcTimestampsAndConventionalIntegerKeys()
    {
        using var context = CreatePostgreSqlContext();

        Assert.Equal(
            "timestamp with time zone",
            GetColumnType(context, typeof(AuditLog), nameof(AuditLog.CreatedAtUtc)));
        Assert.Equal(
            "timestamp with time zone",
            GetColumnType(context, typeof(Transaction), nameof(Transaction.ImportedAtUtc)));
        Assert.Equal(
            "integer",
            GetColumnType(context, typeof(Transaction), nameof(Transaction.RecurringRuleId)));

        var userId = GetProperty(context, typeof(User), nameof(User.Id));
        Assert.Equal("integer", userId.GetColumnType());
        Assert.Equal(ValueGenerated.OnAdd, userId.ValueGenerated);
    }

    [Fact]
    public void PostgreSqlUsesCaseInsensitiveTextForTagsAndCategories()
    {
        using var context = CreatePostgreSqlContext();

        Assert.Equal(
            "citext",
            GetColumnType(context, typeof(TransactionTag), nameof(TransactionTag.Name)));
        Assert.Equal(
            "citext",
            GetColumnType(context, typeof(Transaction), nameof(Transaction.Category)));
        Assert.Equal(
            "citext",
            GetColumnType(context, typeof(RecurringRule), nameof(RecurringRule.Category)));
        Assert.Equal(
            "citext",
            GetColumnType(context, typeof(InstallmentPlan), nameof(InstallmentPlan.Category)));
        Assert.Equal(
            "citext",
            GetColumnType(context, typeof(BudgetGoal), nameof(BudgetGoal.Category)));
    }

    private static string? GetPublicDashboardTokenIndexFilter(AppDbContext context)
    {
        var userEntity = context.Model.FindEntityType(typeof(User))
            ?? throw new InvalidOperationException("O modelo de usuário não foi encontrado.");
        var tokenProperty = userEntity.FindProperty(nameof(User.PublicDashboardTokenHash))
            ?? throw new InvalidOperationException("A propriedade do token público não foi encontrada.");
        var tokenIndex = userEntity.GetIndexes()
            .Single(index => index.Properties.SequenceEqual(new[] { tokenProperty }));

        return tokenIndex.GetFilter();
    }

    private static string GetCheckConstraintSql<TEntity>(
        AppDbContext context,
        string constraintName)
    {
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var entity = designTimeModel.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException("A entidade não foi encontrada.");
        var constraint = entity.GetCheckConstraints()
            .Single(checkConstraint => checkConstraint.Name == constraintName);

        return constraint.Sql;
    }

    private static string? GetColumnType(
        AppDbContext context,
        Type entityType,
        string propertyName)
    {
        return GetProperty(context, entityType, propertyName).GetColumnType();
    }

    private static IProperty GetProperty(
        AppDbContext context,
        Type entityType,
        string propertyName)
    {
        var entity = context.Model.FindEntityType(entityType)
            ?? throw new InvalidOperationException("A entidade não foi encontrada.");
        return entity.FindProperty(propertyName)
            ?? throw new InvalidOperationException("A propriedade não foi encontrada.");
    }

    private static AppDbContext CreateSqlServerContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(
                "Server=localhost;Database=finova-model-test;" +
                "User Id=sa;Password=ModelTest123!;TrustServerCertificate=True")
            .Options;
        return new AppDbContext(options);
    }

    private static AppDbContext CreatePostgreSqlContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=finova_model_test;" +
                "Username=finova;Password=ModelTest123!")
            .Options;
        return new AppDbContext(options);
    }
}
