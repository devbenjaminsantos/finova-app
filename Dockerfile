FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY server/FinanceDashboard.Api/FinanceDashboard.Api.csproj server/FinanceDashboard.Api/
RUN dotnet restore server/FinanceDashboard.Api/FinanceDashboard.Api.csproj

COPY server/FinanceDashboard.Api/ server/FinanceDashboard.Api/
RUN dotnet publish server/FinanceDashboard.Api/FinanceDashboard.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0 \
    Notifications__Enabled=false

EXPOSE 8080

COPY --from=build /app/publish .

USER 1654

ENTRYPOINT ["dotnet", "FinanceDashboard.Api.dll"]
