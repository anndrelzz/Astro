import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AvisoGradeVazia } from "@/front/admin/aviso-grade-vazia";

// Autocadastro (decisao do Andre, 06/11): a estetica nasce sem grade de
// horarios, e o dono configura no primeiro acesso. Enquanto a grade estiver
// vazia, o site dele nao oferece horario nenhum, entao o Dashboard avisa.

describe("AvisoGradeVazia", () => {
  test("explica o que falta e leva para a grade de horarios da estetica", () => {
    render(<AvisoGradeVazia slug="esteticadojoao" />);

    expect(screen.getByText(/Configure sua grade de horários/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurar horários/ })).toHaveAttribute(
      "href",
      "/esteticadojoao/admin/horarios"
    );
  });
});
