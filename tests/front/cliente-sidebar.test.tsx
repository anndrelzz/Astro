import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ClienteSidebar } from "@/front/cliente/cliente-sidebar";

// Barra lateral do cliente no computador: o mesmo aviso no Perfil da barra
// do celular (e-mail ainda nao confirmado).

vi.mock("next/navigation", () => ({ usePathname: () => "/demo" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const renderizar = (avisoPerfil?: boolean) =>
  render(
    <ClienteSidebar
      slug="demo"
      usuarioNome="Maria Souza"
      usuarioEmail="maria@teste.com"
      suporteWhatsapp={null}
      avisoPerfil={avisoPerfil}
    />
  );

describe("ClienteSidebar — aviso no Perfil", () => {
  test("com aviso, o item Perfil ganha o ponto vermelho", () => {
    renderizar(true);
    const perfil = screen.getByRole("link", { name: /Perfil/ });
    expect(perfil).toHaveAccessibleName("Perfil (tem um aviso)");
    expect(perfil.querySelector("[data-aviso]")).not.toBeNull();
  });

  test("sem aviso, o item fica como antes", () => {
    renderizar();
    expect(screen.getByRole("link", { name: "Perfil" }).querySelector("[data-aviso]")).toBeNull();
  });
});
