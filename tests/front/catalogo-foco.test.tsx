import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CatalogoAdmin } from "@/front/admin/catalogo-admin";

// Quando o Admin clica para renomear ou criar um tipo de veiculo, o cursor ja
// vai para o campo: ele pode digitar sem clicar de novo. O foco e dado pelo
// codigo, depois do clique, e nao pelo atributo autoFocus (Sonar S9379).

const roteador = { refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));

const SEGMENTOS = [{ id: "seg-hatch", nome: "Hatch", ordem: 0 }];

describe("Catalogo — foco nos campos de tipo de veiculo", () => {
  test("renomear um tipo leva o cursor para o campo do nome", () => {
    render(<CatalogoAdmin segmentos={SEGMENTOS} servicos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Renomear Hatch" }));
    expect(screen.getByDisplayValue("Hatch")).toHaveFocus();
  });

  test("adicionar um tipo leva o cursor para o campo Nome", () => {
    render(<CatalogoAdmin segmentos={SEGMENTOS} servicos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tipo" }));
    expect(screen.getByLabelText("Nome")).toHaveFocus();
  });

});
