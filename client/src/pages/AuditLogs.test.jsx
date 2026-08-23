import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditLogs from "./AuditLogs";

vi.mock("../lib/api/auditLogs", () => ({
  getAuditLogs: vi.fn(),
}));

import { getAuditLogs } from "../lib/api/auditLogs";

describe("AuditLogs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only relevant history items and hides IP information", async () => {
    getAuditLogs.mockResolvedValue([
      {
        id: 1,
        action: "transaction.created",
        summary: "Transacao criada com sucesso.",
        entityType: "Transaction",
        entityId: "10",
        ipAddress: "127.0.0.1",
        createdAtUtc: "2026-04-14T10:00:00Z",
      },
      {
        id: 2,
        action: "auth.verification-resent",
        summary: "Novo e-mail de confirmacao enviado.",
        entityType: "User",
        entityId: "3",
        ipAddress: "127.0.0.1",
        createdAtUtc: "2026-04-14T11:00:00Z",
      },
    ]);

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Transação adicionada")).toBeInTheDocument();
    });

    expect(screen.queryByText("IP: 127.0.0.1")).not.toBeInTheDocument();
    expect(screen.queryByText("Novo e-mail de confirmacao enviado.")).not.toBeInTheDocument();
    expect(
      screen.getByText(/registro mais técnico foi ocultado para manter este histórico mais direto/i)
    ).toBeInTheDocument();
  });
});
