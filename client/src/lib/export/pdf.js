const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 40;
const PAGE_TOP = 800;
const PDF_FONT_SIZE = 9;
const LINE_HEIGHT = 16;
const ROWS_PER_PAGE = 28;
const WIN_ANSI_BYTES = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

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

function toPdfWinAnsiHexString(value) {
  const input = String(value ?? "");
  let hex = "";

  for (const character of input) {
    const codePoint = character.codePointAt(0);
    const byte = codePoint <= 0xff ? codePoint : WIN_ANSI_BYTES.get(codePoint) ?? 0x3f;

    hex += byte.toString(16).padStart(2, "0").toUpperCase();
  }

  return `<${hex}>`;
}

function buildTableLines({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
  generatedAtLabel,
  locale,
}) {
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
      : [emptyMessage];

  return [
    title,
    subtitle,
    `${generatedAtLabel} ${new Date().toLocaleString(locale)}`,
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

function buildContentStream(lines, pageNumber, pageCount, pageLabel, pageOfLabel) {
  const commands = [
    "BT",
    `/F1 ${PDF_FONT_SIZE} Tf`,
    `${LINE_HEIGHT} TL`,
    `${PAGE_MARGIN_X} ${PAGE_TOP} Td`,
  ];

  lines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`${toPdfWinAnsiHexString(line)} Tj`);
      return;
    }

    commands.push("T*");
    commands.push(`${toPdfWinAnsiHexString(line)} Tj`);
  });

  commands.push("T*");
  commands.push(
    `${toPdfWinAnsiHexString(`${pageLabel} ${pageNumber} ${pageOfLabel} ${pageCount}`)} Tj`
  );
  commands.push("ET");

  return commands.join("\n");
}

function buildPdfDocument(pageContents) {
  const objects = [];
  const pageObjectIds = [];
  const fontObjectId = 3;
  let nextObjectId = 4;

  pageContents.forEach((content) => {
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
  const fontObject = {
    id: 3,
    body: "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  };

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

export function buildTransactionsPdf({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
  generatedAtLabel,
  pageLabel,
  pageOfLabel,
  locale,
}) {
  const lines = buildTableLines({
    title,
    subtitle,
    columns,
    rows,
    emptyMessage,
    generatedAtLabel,
    locale,
  });
  const pages = buildPageChunks(lines);
  const pageContents = pages.map((pageLines, index) =>
    buildContentStream(pageLines, index + 1, pages.length, pageLabel, pageOfLabel)
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

export function exportTransactionsToPdf({ filename, ...documentOptions }) {
  const pdfContent = buildTransactionsPdf(documentOptions);

  downloadPdf(filename, pdfContent);
}
