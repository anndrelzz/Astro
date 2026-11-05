import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PorDentro } from "@/app/_landing/por-dentro";

// Secao "Conheca o Astro por dentro" da landing: o print do painel e
// navegavel. Clicar num item do menu lateral DENTRO do print troca a tela,
// o endereco da janela e a faixa de texto embaixo.

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("PorDentro", () => {
  test("comeca no painel do dia, com o texto dele embaixo da tela", () => {
    render(<PorDentro />);
    expect(screen.getByRole("img", { name: /Painel do dia/ })).toBeInTheDocument();
    expect(screen.getByText("…/sua-estetica/admin")).toBeInTheDocument();
    expect(screen.getByText(/já vê quem chega hoje/)).toBeInTheDocument();
  });

  test("o menu do print troca a tela, o endereco e o texto", async () => {
    render(<PorDentro />);
    await clicar("Abrir Clientes");
    expect(await screen.findByRole("img", { name: /Clientes/ })).toBeInTheDocument();
    expect(screen.getByText("…/sua-estetica/admin/clientes")).toBeInTheDocument();
    expect(screen.getByText(/parou de voltar/)).toBeInTheDocument();
  });

  test("Ampliar abre o painel em tela cheia, navegavel, e Esc fecha", async () => {
    render(<PorDentro />);
    await clicar("Ampliar o painel");
    const tela = screen.getByRole("dialog", { name: /painel do Astro/i });
    expect(tela).toBeInTheDocument();
    // o menu continua funcionando dentro da tela cheia
    const itens = screen.getAllByRole("button", { name: "Abrir Clientes" });
    await act(async () => {
      fireEvent.click(itens[itens.length - 1]);
    });
    expect(screen.getAllByText("…/sua-estetica/admin/clientes").length).toBeGreaterThan(0);
    fireEvent.keyDown(tela, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("todo o menu do print funciona, inclusive Grade de horarios e Configuracoes", async () => {
    render(<PorDentro />);
    await clicar("Abrir Grade de horários");
    expect(await screen.findByRole("img", { name: /Grade de horários/ })).toBeInTheDocument();
    expect(screen.getByText("…/sua-estetica/admin/horarios")).toBeInTheDocument();
    await clicar("Abrir Configurações");
    expect(await screen.findByRole("img", { name: /Configurações/ })).toBeInTheDocument();
    expect(screen.getByText("…/sua-estetica/admin/configuracoes")).toBeInTheDocument();
  });

  test("o item da tela aberta fica marcado como atual", async () => {
    render(<PorDentro />);
    await clicar("Abrir Financeiro");
    expect(screen.getByRole("button", { name: "Abrir Financeiro" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Abrir Painel do dia" })).not.toHaveAttribute("aria-current");
  });
});
