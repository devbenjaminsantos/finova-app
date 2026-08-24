using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FinanceDashboard.Api.Data;

public static class DatabaseErrorClassifier
{
    public static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        return exception.InnerException switch
        {
            SqlException { Number: 2601 or 2627 } => true,
            PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } => true,
            _ => false
        };
    }
}
