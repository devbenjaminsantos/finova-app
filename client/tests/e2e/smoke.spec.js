import { expect, test } from "@playwright/test";

async function prepareAuthenticatedApp(page) {
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
    localStorage.setItem("hestia:last-activity-at", String(Date.now()));
    localStorage.setItem("hestia-language", "pt-BR");
  });

  await page.route("http://localhost:5278/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4173",
        "access-control-allow-credentials": "true",
      },
    });
  });
}

test.describe("public routes", () => {
  test("login page loads with demo block", async ({ page }) => {
    await page.goto("/login");

    const brand = page.getByLabel("Marca Héstia").first();
    await expect(brand).toBeVisible();
    const brandImage = brand.locator("img");
    await expect(brandImage).toHaveAttribute("src", /hestia-mark-optimized\.webp/);
    expect(await brandImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Explore a conta demo" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar como demonstração/i })).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: /Criar conta/i })).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByPlaceholder("seuemail@exemplo.com")).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("heading", { name: /Recuperar senha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Enviar instruções/i })).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("redirects unauthenticated access to transacoes back to login", async ({ page }) => {
    await page.goto("/transacoes");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("redirects unauthenticated access to auditoria back to login", async ({ page }) => {
    await page.goto("/auditoria");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });
});

test.describe("basic UX", () => {
  test("theme toggle works on public page", async ({ page }) => {
    await page.goto("/login");

    const toggle = page.getByRole("button", { name: /Ativar tema/i });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.locator(":root")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("authenticated app shell", () => {
  test("supports keyboard navigation and preserves the active route", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await prepareAuthenticatedApp(page);
    await page.goto("/");

    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });
    const analysesLink = sidebar.getByRole("link", { name: "Análises" });
    await analysesLink.focus();
    await expect(analysesLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/analises$/);
    await expect(analysesLink).toHaveClass(/app-nav-link-active/);
  });

  test("renders the desktop sidebar and opens the existing transaction flow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await prepareAuthenticatedApp(page);
    await page.goto("/");

    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(sidebar.getByRole("link", { name: "Início" })).toHaveClass(/app-nav-link-active/);
    await expect(
      page.getByRole("heading", { name: "Seu dinheiro, em perspectiva" })
    ).toBeVisible();
    await expect(page.getByLabel("Recorte rápido")).toBeVisible();
    await expect(page.getByText("Héstia percebeu")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Maiores gastos do período" })).toBeVisible();
    await expect(page.locator(".app-mobile-nav")).toBeHidden();

    await page.getByRole("link", { name: "Nova transação" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/transacoes$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Novo lançamento rápido" })).toBeVisible();
  });

  test("keeps mobile navigation, preferences and logout accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareAuthenticatedApp(page);
    await page.goto("/");

    await expect(page.locator(".app-sidebar")).toBeHidden();
    const mobileNav = page.locator(".app-mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Nova transação" })).toBeVisible();

    await mobileNav.getByRole("button", { name: "Mais" }).click();
    const moreNavigation = page.getByRole("navigation", { name: "Outras áreas" });
    await expect(moreNavigation).toBeVisible();
    await expect(moreNavigation.getByRole("link", { name: "Contas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ativar tema escuro" })).toBeVisible();
    await expect(page.getByLabel("Idioma").last()).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".app-mobile-nav")).toBeHidden();
  });
});
