import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CopiarPix } from "@/front/cliente/copiar-pix";

// Tela 11 — o cliente copia o codigo PIX para colar no app do banco.

const CODIGO = "00020126580014br.gov.bcb.pix-teste";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // O jsdom nao tem clipboard nem execCommand: tira os que o teste pos.
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
});

// Toca no botao e espera o copiar() terminar: ele aguarda a area de
// transferencia antes de trocar o texto do botao.
async function tocarEmCopiar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
  });
}

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
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
    expect(screen.getByText(/Agora é só colar no app do seu banco/)).toBeInTheDocument();
  });

  test("depois de 2,5 s o botao volta a dizer Copiar", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    render(<CopiarPix codigo={CODIGO} />);

    await tocarEmCopiar();
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2499));
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByText(/Agora é só colar/)).not.toBeInTheDocument();
  });

  test("sem navigator.clipboard (http pelo IP), copia pelo caminho antigo", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    render(<CopiarPix codigo={CODIGO} />);

    await tocarEmCopiar();

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(screen.getByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  test("se nao conseguir copiar, nao diz que copiou", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    render(<CopiarPix codigo={CODIGO} />);

    await tocarEmCopiar();

    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByText(/Agora é só colar/)).not.toBeInTheDocument();
  });
});
