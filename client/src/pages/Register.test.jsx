import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import Register from "./Register";
import { hasValidSession, registerRequest } from "../lib/api/auth";

vi.mock("../lib/api/auth", () => ({
  forgotPasswordRequest: vi.fn(),
  hasValidSession: vi.fn(),
  registerRequest: vi.fn(),
}));

describe("Register page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSession.mockReturnValue(false);
  });

  it("redirects an existing email to account recovery", async () => {
    registerRequest.mockRejectedValue({
      code: "EMAIL_ALREADY_REGISTERED",
      message: "Este e-mail já está cadastrado.",
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(container.querySelector("#register-name"), {
      target: { value: "Benjamin" },
    });
    fireEvent.change(container.querySelector("#register-email"), {
      target: { value: "BENJAMIN@EXAMPLE.COM" },
    });
    fireEvent.change(container.querySelector("#register-password"), {
      target: { value: "SenhaSegura123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("heading", { name: "Recuperar senha" }))
      .toBeInTheDocument();
    expect(screen.getByText("Este e-mail já está cadastrado."))
      .toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("BENJAMIN@EXAMPLE.COM");

    await waitFor(() => {
      expect(registerRequest).toHaveBeenCalledWith(
        "Benjamin",
        "BENJAMIN@EXAMPLE.COM",
        "SenhaSegura123!"
      );
    });
  });
});
