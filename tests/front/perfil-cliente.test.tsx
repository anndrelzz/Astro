import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PerfilCliente } from "@/front/cliente/perfil-cliente";

// Telas 04 e 05 — perfil do cliente: os dados, a garagem, editar o perfil e
// remover um veiculo (RN15).

const roteador = { refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador, useParams: () => ({ slug: "demo" }) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const VEICULOS = [
  { id: "v1", marca: "Chevrolet", modelo: "Astra", placa: "FDN8637", ano: 2010, cor: "Prata", segmento: "Hatch" },
  { id: "v2", marca: "Honda", modelo: "Civic", placa: "RTY2U34", ano: 2021, cor: "Cinza", segmento: "Sedan" },
];

function renderizar() {
  return render(
    <PerfilCliente
      slug="demo"
      nome="Maria Souza"
      email="maria@teste.com"
      telefone="47999990000"
      totalAgendamentos={3}
      veiculos={VEICULOS}
      telegramVinculado={false}
    />
  );
}

function respostaDaApi(status: number, corpo: unknown = {}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: nome })[0]);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("PerfilCliente", () => {
  test("mostra os dados do cliente e os carros da garagem", () => {
    renderizar();

    expect(screen.getAllByText("Maria Souza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("maria@teste.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Astra/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Civic/).length).toBeGreaterThan(0);
  });

  test("remover um carro pede confirmacao e so entao chama a API", async () => {
    const fetchMock = respostaDaApi(200);
    renderizar();

    await clicar("Remover Chevrolet Astra");
    expect(screen.getByText("Remover veículo?")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await clicar("Sim, remover veículo");

    expect(fetchMock).toHaveBeenCalledWith("/api/veiculos/v1", expect.objectContaining({ method: "DELETE" }));
    expect(roteador.refresh).toHaveBeenCalled();
  });

  test("carro com horario marcado nao sai: mostra o motivo da API (RN15)", async () => {
    respostaDaApi(409, { error: "Esse carro tem um agendamento marcado" });
    renderizar();

    await clicar("Remover Chevrolet Astra");
    await clicar("Sim, remover veículo");

    expect(screen.getByText("Esse carro tem um agendamento marcado")).toBeInTheDocument();
    expect(roteador.refresh).not.toHaveBeenCalled();
  });

  test("editar os dados salva nome e telefone pela API", async () => {
    const fetchMock = respostaDaApi(200);
    renderizar();

    await clicar("Editar dados");
    fireEvent.change(screen.getByDisplayValue("Maria Souza"), { target: { value: "Maria S. Lima" } });
    await clicar("Salvar alterações");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/perfil");
    expect(init!.method).toBe("PATCH");
    expect(JSON.parse(init!.body as string)).toMatchObject({ nome: "Maria S. Lima" });
    expect(roteador.refresh).toHaveBeenCalled();
  });

  test("telefone recusado pela API: o erro aparece embaixo do telefone", async () => {
    const mensagem = "Telefone invalido - informe DDD + numero (10 ou 11 digitos)";
    respostaDaApi(400, { error: mensagem, campo: "telefone" });
    renderizar();

    await clicar("Editar dados");
    fireEvent.change(screen.getByPlaceholderText("(00) 00000-0000"), { target: { value: "123" } });
    await clicar("Salvar alterações");

    const telefone = screen.getByPlaceholderText("(00) 00000-0000");
    expect(telefone).toHaveAttribute("aria-invalid", "true");
    expect(telefone).toHaveAccessibleDescription(mensagem);
    expect(screen.getAllByText(mensagem)).toHaveLength(1);
    expect(roteador.refresh).not.toHaveBeenCalled();
  });

  test("o e-mail aparece no modal, mas nao pode ser editado", async () => {
    renderizar();

    await clicar("Editar dados");

    expect(screen.getByLabelText("E-mail (não editável)")).toHaveAttribute("readonly");
  });
});
