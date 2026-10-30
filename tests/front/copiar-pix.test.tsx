import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CopiarPix } from "@/front/cliente/copiar-pix";

// Tela 11 — o cliente copia o codigo PIX para colar no app do banco.

const CODIGO = "00020126580014br.gov.bcb.pix-teste";

afterEach(() => {
  vi.useRealTimers();
});

describe("CopiarPix", () => {
  test("mostra o codigo e o botao Copiar", () => {
    render(<CopiarPix codigo={CODIGO} />);

    expect(screen.getByText(CODIGO)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });

  test("ao tocar, copia o codigo e avisa o proximo passo", async () => {
    const usuario = userEvent.setup();
    render(<CopiarPix codigo={CODIGO} />);

    await usuario.click(screen.getByRole("button", { name: "Copiar" }));

    expect(await navigator.clipboard.readText()).toBe(CODIGO);
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();
    expect(screen.getByText(/Agora é só colar no app do seu banco/)).toBeInTheDocument();
  });

  test("depois de 2,5 s o botao volta a dizer Copiar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopiarPix codigo={CODIGO} />);

    await usuario.click(screen.getByRole("button", { name: "Copiar" }));
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByText(/Agora é só colar/)).not.toBeInTheDocument();
  });
});
