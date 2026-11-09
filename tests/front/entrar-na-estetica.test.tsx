import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EntrarNaEstetica } from "@/front/landing/entrar-na-estetica";

// Botao "Entrar" da landing: abre o pop-up, o dono digita o nome da estetica
// e escolhe a dele na lista, que leva para o login daquela estetica.

const RESULTADO = { esteticas: [{ nome: "Estética do Rafael", slug: "rafael", logoUrl: null }] };

function abrir() {
  render(<EntrarNaEstetica>Entrar</EntrarNaEstetica>);
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

async function digitar(texto: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: texto } });
  // a busca espera a pessoa parar de digitar
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(RESULTADO), { status: 200 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("EntrarNaEstetica", () => {
  test("o botao abre o pop-up com o campo de busca focado", () => {
    abrir();
    expect(screen.getByRole("dialog", { name: /sua estética/i })).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  test("com menos de 3 letras so orienta, sem buscar", async () => {
    abrir();
    await digitar("es");
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/pelo menos 3 letras/i)).toBeInTheDocument();
  });

  test("busca pelo nome e leva ao login da estetica escolhida", async () => {
    abrir();
    await digitar("rafa");
    expect(fetch).toHaveBeenCalledWith("/api/esteticas/busca?q=rafa", expect.anything());
    expect(screen.getByRole("link", { name: /Estética do Rafael/ })).toHaveAttribute("href", "/rafael/login");
  });

  test("avisa quando nenhuma estetica tem esse nome", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ esteticas: [] }), { status: 200 }));
    abrir();
    await digitar("xyzw");
    expect(screen.getByText(/nenhuma estética encontrada/i)).toBeInTheDocument();
  });

  test("Esc fecha o pop-up", () => {
    abrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
