import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RouteLoading from "./RouteLoading";

describe("RouteLoading", () => {
  it(
    "announces route loading with the existing localized message",
    () => {
      render(<RouteLoading />);

      expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    },
    15_000
  );
});
