import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { BarraCliente, itemAtivo, itensCliente } from "@/front/componentes/bottom-nav";

// Barra de navegacao do cliente no celular: os tres destinos e qual esta ativo.

let caminho = "/demo";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

describe("itensCliente e itemAtivo", () => {
  const [servicos, agendamentos] = itensCliente("demo");

  test("os tres destinos ficam dentro da estetica", () => {
    expect(itensCliente("demo").map((i) => [i.label, i.href])).toEqual([
      ["Serviços", "/demo"],
      ["Agendamentos", "/demo/historico"],
      ["Perfil", "/demo/perfil"],
    ]);
  });

  test("Servicos so fica ativo na home, e nao em qualquer pagina da estetica", () => {
    expect(itemAtivo("/demo", servicos)).toBe(true);
    expect(itemAtivo("/demo/historico", servicos)).toBe(false);
  });

  test("Agendamentos fica ativo tambem nas paginas abaixo dele", () => {
    expect(itemAtivo("/demo/historico", agendamentos)).toBe(true);
    expect(itemAtivo("/demo/historico/123", agendamentos)).toBe(true);
    expect(itemAtivo("/demo/historicos", agendamentos)).toBe(false);
  });
});

describe("BarraCliente", () => {
  test("mostra os tres links e marca a pagina atual", () => {
    caminho = "/demo/historico";
    render(<BarraCliente slug="demo" />);

    const atual = screen.getByRole("link", { current: "page" });
    expect(atual).toHaveAttribute("href", "/demo/historico");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  test("fora das tres paginas (agendar, pagamento...), a barra some", () => {
    caminho = "/demo/agendar/serv-1";
    const { container } = render(<BarraCliente slug="demo" />);

    expect(container).toBeEmptyDOMElement();
  });
});
