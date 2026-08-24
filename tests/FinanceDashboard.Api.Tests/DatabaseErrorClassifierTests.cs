using FinanceDashboard.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace FinanceDashboard.Api.Tests;

public class DatabaseErrorClassifierTests
{
    [Fact]
    public void RecognizesPostgreSqlUniqueViolation()
    {
        var postgresException = new PostgresException(
            "duplicate key value violates unique constraint",
            "ERROR",
            "ERROR",
            PostgresErrorCodes.UniqueViolation);
        var exception = new DbUpdateException("Falha ao salvar.", postgresException);

        Assert.True(DatabaseErrorClassifier.IsUniqueConstraintViolation(exception));
    }

    [Fact]
    public void RejectsOtherPostgreSqlErrors()
    {
        var postgresException = new PostgresException(
            "check constraint violation",
            "ERROR",
            "ERROR",
            PostgresErrorCodes.CheckViolation);
        var exception = new DbUpdateException("Falha ao salvar.", postgresException);

        Assert.False(DatabaseErrorClassifier.IsUniqueConstraintViolation(exception));
    }
}
