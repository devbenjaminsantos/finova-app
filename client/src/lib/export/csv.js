function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  const safeValue = /^[\t\r ]*[=+\-@]/.test(normalized)
    ? `'${normalized}`
    : normalized;

  if (/[",;\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}

export function buildCsv(rows) {
  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
    .join("\n");
}

export function downloadCsv(filename, rows) {
  const csvContent = buildCsv(rows);
  const blob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
