const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 40;
const PAGE_TOP = 800;
const LINE_HEIGHT = 16;
const ROWS_PER_PAGE = 28;

function padText(value, length, align = "left") {
  const normalized = String(value ?? "");

  if (normalized.length >= length) {
    return normalized.slice(0, Math.max(length - 1, 1)) + "…";
  }

  return align === "right"
    ? normalized.padStart(length, " ")
    : normalized.padEnd(length, " ");
}

function formatRow(columns) {
  return columns.join(" | ");
}

function toPdfHexString(value) {
  const input = String(value ?? "");
  let hex = "FEFF";

  for (const character of input) {
    const codePoint = character.codePointAt(0);

    if (codePoint <= 0xffff) {
      hex += codePoint.toString(16).padStart(4, "0").toUpperCase();
      continue;
    }

    const adjusted = codePoint - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);
    hex += high.toString(16).padStart(4, "0").toUpperCase();
    hex += low.toString(16).padStart(4, "0").toUpperCase();
  }

  return `<${hex}>`;
}

function buildTableLines({ title, subtitle, columns, rows }) {
  const columnWidths = [12, 24, 18, 10, 14];
  const visibleRows = rows.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
  ]);

  const headerLine = formatRow(
    columns.slice(0, 5).map((column, index) =>
      padText(column, columnWidths[index], index === 4 ? "right" : "left")
    )
  );

  const separatorLine = columnWidths
    .map((width) => "-".repeat(width))
    .join("-+-");

  const bodyLines =
    visibleRows.length > 0
      ? visibleRows.map((row) =>
          formatRow(
            row.map((cell, index) =>
              padText(cell, columnWidths[index], index === 4 ? "right" : "left")
            )
          )
        )
      : ["Nenhuma transação encontrada para os filtros selecionados."];

  return [
    title,
    subtitle,
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    "",
    headerLine,
    separatorLine,
    ...bodyLines,
  ];
}

function buildPageChunks(lines) {
  const firstPageCapacity = ROWS_PER_PAGE;
  const pages = [];

  for (let index = 0; index < lines.length; index += firstPageCapacity) {
    pages.push(lines.slice(index, index + firstPageCapacity));
  }

  return pages;
}

function buildContentStream(lines, pageNumber, pageCount) {
  const commands = [
    "BT",
    "/F1 12 Tf",
    `${LINE_HEIGHT} TL`,
    `${PAGE_MARGIN_X} ${PAGE_TOP} Td`,
  ];

  lines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`${toPdfHexString(line)} Tj`);
      return;
    }

    commands.push("T*");
    commands.push(`${toPdfHexString(line)} Tj`);
  });

  commands.push("T*");
  commands.push(`${toPdfHexString(`Pagina ${pageNumber} de ${pageCount}`)} Tj`);
  commands.push("ET");

  return commands.join("\n");
}

function buildPdfDocument(pageContents) {
  const objects = [];
  const pageObjectIds = [];
  const fontObjectId = 3;
  let nextObjectId = 4;

  pageContents.forEach((content, index) => {
    const contentObjectId = nextObjectId++;
    const pageObjectId = nextObjectId++;

    objects.push({
      id: contentObjectId,
      body: `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    });

    pageObjectIds.push(pageObjectId);

    objects.push({
      id: pageObjectId,
      body:
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    });
  });

  const catalogObject = { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" };
  const pagesObject = {
    id: 2,
    body: `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`,
  };
  const fontObject = { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>" };

  const orderedObjects = [catalogObject, pagesObject, fontObject, ...objects].sort(
    (left, right) => left.id - right.id
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of orderedObjects) {
    offsets[object.id] = pdf.length;
    pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${orderedObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= orderedObjects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${orderedObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

export function buildTransactionsPdf({ title, subtitle, columns, rows }) {
  const lines = buildTableLines({ title, subtitle, columns, rows });
  const pages = buildPageChunks(lines);
  const pageContents = pages.map((pageLines, index) =>
    buildContentStream(pageLines, index + 1, pages.length)
  );

  return buildPdfDocument(pageContents);
}

export function downloadPdf(filename, pdfContent) {
  const blob = new Blob([pdfContent], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToPdf({ filename, title, subtitle, columns, rows }) {
  const pdfContent = buildTransactionsPdf({
    title,
    subtitle,
    columns,
    rows,
  });

  downloadPdf(filename, pdfContent);
}
