import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteErrorBoundary from "./RouteErrorBoundary";

function BrokenRoute() {
  throw new Error("chunk failed");
}

describe("RouteErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers a localized reload action when a route fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RouteErrorBoundary>
        <BrokenRoute />
      </RouteErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir esta página");
    expect(screen.getByRole("button", { name: "Recarregar página" })).toBeInTheDocument();
  });
});
