import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const transactions = [
  {
    id: 101,
    date: "2026-08-14",
    description: "Mercado São Bento",
    type: "expense",
    category: "Alimentação",
    tagNames: ["essencial"],
    amountCents: 15345,
    source: "manual",
    isRecurring: false,
  },
  {
    id: 102,
    date: "2026-08-12",
    description: "Freelance de agosto",
    type: "income",
    category: "Salário",
    tagNames: ["trabalho"],
    amountCents: 420000,
    source: "manual",
    isRecurring: false,
  },
];

async function prepareAuthenticatedTransactionsPage(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: 7,
        name: "Validação Héstia",
        email: "visual@example.com",
        isDemo: false,
        onboardingOptIn: false,
      })
    );
    localStorage.setItem("finova:last-activity-at", String(Date.now()));
    localStorage.setItem("finova-language", "pt-BR");
  });

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (request.resourceType() !== "fetch") {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const isTransactionsList =
      request.method() === "GET" && url.pathname.endsWith("/transactions");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isTransactionsList ? transactions : []),
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4173",
        "access-control-allow-credentials": "true",
      },
    });
  });
}

test("exports a readable Héstia PDF with all columns", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await prepareAuthenticatedTransactionsPage(page);
  await page.goto("/transacoes");

  await expect(page.getByText("Mercado São Bento")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Freelance de agosto")).toBeVisible({ timeout: 60_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar PDF" }).click(),
  ]);
  const pdfPath = testInfo.outputPath("hestia-transacoes-todos.pdf");

  await download.saveAs(pdfPath);

  expect(download.suggestedFilename()).toBe("hestia-transacoes-todos.pdf");

  const pdf = await readFile(pdfPath, "latin1");
  expect(pdf).toContain("/Encoding /WinAnsiEncoding");
  expect(pdf).toContain("/F1 9 Tf");
  expect(pdf).toContain("4D65726361646F2053E36F2042656E746F");
  expect(pdf).toContain("416C696D656E7461E7E36F");
  expect(pdf).toContain("5224A03135332C3435");

  await page.screenshot({
    path: testInfo.outputPath("transacoes-com-dados.png"),
    fullPage: true,
  });
});
