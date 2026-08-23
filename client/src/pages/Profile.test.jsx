import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "./Profile";

vi.mock("../lib/api/auth", () => ({
  getProfile: vi.fn(),
  getNotificationDeliveries: vi.fn(),
  updateProfileRequest: vi.fn(),
}));

vi.mock("../lib/api/publicDashboard", () => ({
  getPublicDashboardSettings: vi.fn(),
  updatePublicDashboardSettings: vi.fn(),
}));

import {
  getNotificationDeliveries,
  getProfile,
  updateProfileRequest,
} from "../lib/api/auth";
import {
  getPublicDashboardSettings,
  updatePublicDashboardSettings,
} from "../lib/api/publicDashboard";

describe("Profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getProfile.mockResolvedValue({
      id: 7,
      name: "Keller",
      email: "keller@finova.app",
      emailGoalAlertsEnabled: true,
      goalAlertThresholdPercent: 90,
      monthlyReportEmailsEnabled: true,
      monthlyReportDay: 5,
    });
    getNotificationDeliveries.mockResolvedValue([
      {
        id: 1,
        notificationType: "goal_alert",
        subject: "Alerta de meta mensal - orcamento geral",
        sentAtUtc: "2026-04-17T12:00:00Z",
      },
    ]);
    getPublicDashboardSettings.mockResolvedValue({
      enabled: true,
      publicUrl: "https://finova.app/compartilhado/teste",
    });
  });

  it("loads email alert preferences from the profile", async () => {
    render(<Profile />);

    expect(await screen.findByText("Alertas por e-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Receber alertas")).toBeChecked();
    expect(screen.getByLabelText("Quando enviar o aviso")).toHaveValue("90");
    expect(screen.getByLabelText("Receber resumo mensal")).toBeChecked();
    expect(screen.getByLabelText("Dia do envio")).toHaveValue("5");
    expect(screen.getByText("Histórico de notificações")).toBeInTheDocument();
    expect(screen.getByText("Alerta de meta mensal - orcamento geral")).toBeInTheDocument();
    expect(screen.getByText("Painel público")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://finova.app/compartilhado/teste")).toBeInTheDocument();
  });

  it("submits updated email alert preferences", async () => {
    updateProfileRequest.mockResolvedValue({
      id: 7,
      name: "Keller",
      email: "keller@finova.app",
      emailGoalAlertsEnabled: false,
      goalAlertThresholdPercent: 60,
      monthlyReportEmailsEnabled: true,
      monthlyReportDay: 10,
    });

    render(<Profile />);
    await screen.findByText("Alertas por e-mail");

    fireEvent.click(screen.getByLabelText("Receber alertas"));
    fireEvent.change(screen.getByLabelText("Quando enviar o aviso"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Dia do envio"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() => {
      expect(updateProfileRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Keller",
          emailGoalAlertsEnabled: false,
          goalAlertThresholdPercent: 60,
          monthlyReportEmailsEnabled: true,
          monthlyReportDay: 10,
        })
      );
    });
  });

  it("toggles public dashboard sharing", async () => {
    updatePublicDashboardSettings.mockResolvedValue({
      enabled: false,
      publicUrl: null,
    });

    render(<Profile />);
    await screen.findByText("Painel público");

    fireEvent.click(screen.getByLabelText("Painel público ativo"));

    await waitFor(() => {
      expect(updatePublicDashboardSettings).toHaveBeenCalledWith(false);
    });
  });
});
