import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AvisoEmailDoDono } from "@/front/admin/aviso-email-do-dono";

// Dashboard do dono: enquanto o e-mail nao estiver confirmado, os avisos de
// agendamento nao chegam por e-mail (LGPD). O aviso explica isso e reenvia o
// link; depois de confirmar, mostra o sucesso uma vez.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AvisoEmailDoDono", () => {
  test("e-mail ainda nao confirmado: explica e oferece reenviar o link", () => {
    render(<AvisoEmailDoDono email="joao@exemplo.com" confirmado={false} />);
    expect(screen.getByText("Confirme seu e-mail para receber os avisos de agendamento")).toBeInTheDocument();
    expect(screen.getByText(/joao@exemplo\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar e-mail de confirmação" })).toBeInTheDocument();
  });

  test("link vencido ou ja usado: avisa e oferece um novo", () => {
    render(<AvisoEmailDoDono email="joao@exemplo.com" confirmado={false} status="link-invalido" />);
    expect(screen.getByText(/expirou ou já foi usado/)).toBeInTheDocument();
  });

  test("reenviar chama a mesma rota do Perfil e avisa que mandou", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<AvisoEmailDoDono email="joao@exemplo.com" confirmado={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reenviar e-mail de confirmação" }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/perfil/reenviar-confirmacao", { method: "POST" });
    expect(screen.getByText(/Enviamos um novo link/)).toBeInTheDocument();
  });

  test("acabou de confirmar: mostra o sucesso", () => {
    render(<AvisoEmailDoDono email="joao@exemplo.com" confirmado status="confirmado" />);
    expect(screen.getByText(/E-mail confirmado/)).toBeInTheDocument();
  });

  test("ja confirmado, sem novidade: nao mostra nada", () => {
    const { container } = render(<AvisoEmailDoDono email="joao@exemplo.com" confirmado />);
    expect(container).toBeEmptyDOMElement();
  });
});
