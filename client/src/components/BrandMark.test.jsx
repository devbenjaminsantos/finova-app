import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../i18n/LanguageProvider";
import BrandMark from "./BrandMark";

function renderBrandMark(props) {
  return render(
    <LanguageProvider>
      <BrandMark {...props} />
    </LanguageProvider>
  );
}

describe("BrandMark", () => {
  it("uses the supplied Héstia mark with an accessible wordmark", () => {
    const { container } = renderBrandMark({ size: "navbar" });

    expect(screen.getByRole("img", { name: /Héstia/ })).toHaveTextContent("Héstia");
    expect(container.querySelector(".finova-brand-logo img")).toHaveAttribute(
      "src",
      expect.stringContaining("hestia-mark-optimized.webp")
    );
  });

  it("can render the compact mark without a wordmark", () => {
    const { container } = renderBrandMark({ showWordmark: false });

    expect(screen.getByRole("img", { name: /Héstia/ })).toBeInTheDocument();
    expect(container.querySelector(".finova-brand-wordmark")).not.toBeInTheDocument();
  });
});
