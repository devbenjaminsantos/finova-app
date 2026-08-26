import { expect, test } from "@playwright/test";

test.describe("public routes", () => {
  test("login page loads with demo block", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Marca Héstia").first()).toBeVisible();
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
