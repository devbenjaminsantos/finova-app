import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { hasValidSession } from "./lib/api/auth";

vi.mock("./components/Navbar", () => ({
  default: () => <nav>Navbar</nav>,
}));

vi.mock("./features/transactions/TransactionsProvider", () => ({
  TransactionsProvider: ({ children }) => children,
}));

vi.mock("./lib/api/auth", () => ({
  hasValidSession: vi.fn(),
  rememberPostLoginRedirect: vi.fn(),
  syncSessionFromStorageEvent: vi.fn(),
  touchSessionActivity: vi.fn(),
}));

vi.mock("./pages/Home", () => ({
  default: () => <h1>Home route</h1>,
}));

vi.mock("./pages/Login", () => ({
  default: () => <h1>Login route</h1>,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  beforeEach(() => {
    hasValidSession.mockReturnValue(false);
  });

  it(
    "keeps protected routes behind the login redirect",
    async () => {
      renderApp("/perfil");

      expect(await screen.findByRole("heading", { name: "Login route" })).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    },
    15_000
  );

  it(
    "preserves the dashboard alias and its protection",
    async () => {
      renderApp("/dashboard");

      await waitFor(() => {
        expect(screen.getByTestId("location")).toHaveTextContent("/login");
      });
    },
    15_000
  );

  it(
    "renders a protected lazy route for an authenticated session",
    async () => {
      hasValidSession.mockReturnValue(true);

      renderApp("/");

      expect(await screen.findByRole("heading", { name: "Home route" })).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    },
    15_000
  );
});
