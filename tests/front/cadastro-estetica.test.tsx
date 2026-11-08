import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signIn } from "next-auth/react";
import { CadastroEstetica } from "@/front/start/cadastro-estetica";

// Autocadastro (decisao do orientador, 30/10; detalhes do Andre, 06/11) — a
// tela /start, onde o dono cria a estetica e entra direto no painel.

const roteador = { push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

type Resposta = { status: number; corpo: unknown };
let respostas: Record<string, Resposta>;
const pedidos: { url: string; corpo?: unknown }[] = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  pedidos.length = 0;
  respostas = {
    "/api/esteticas/endereco": { status: 200, corpo: { endereco: "x", disponivel: true } },
    "/api/esteticas": { status: 201, corpo: { ok: true, slug: "esteticadojoao" } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const caminho = url.split("?")[0];
      pedidos.push({ url, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
      const { status, corpo } = respostas[caminho];
      return new Response(JSON.stringify(corpo), { status });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(signIn).mockReset();
  for (const f of Object.values(roteador)) f.mockReset();
});

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const digitar = (rotulo: string, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } });

// Espera o atraso da consulta do endereco e a resposta dela.
async function esperarConsulta() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

function preencherTudo() {
  digitar("Nome da estética", "Estética do João");
  digitar("Seu nome", "João Pereira");
  digitar("E-mail", "joao@exemplo.com");
  digitar("WhatsApp", "(47) 99999-0000");
  digitar("Senha", "Senha123");
  fireEvent.click(screen.getByRole("checkbox"));
}

async function criar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Criar minha estética/ }));
  });
}

describe("endereco do site", () => {
  test("vem do nome da estetica, sem hifen, e mostra o link como vai ficar", () => {
    render(<CadastroEstetica />);

    digitar("Nome da estética", "Estética do João");

    expect(campo("Endereço do site").value).toBe("esteticadojoao");
    expect(screen.getByText("useastro.app.br/esteticadojoao")).toBeInTheDocument();
  });

  test("depois que o dono edita o endereco, mudar o nome nao o sobrescreve", () => {
    render(<CadastroEstetica />);

    digitar("Nome da estética", "Estética do João");
    digitar("Endereço do site", "joao-car");
    digitar("Nome da estética", "Estética do João Car");

    expect(campo("Endereço do site").value).toBe("joao-car");
  });

  test("o que ele digita ja vira link: minusculas, sem acento e sem espaco", () => {
    render(<CadastroEstetica />);

    digitar("Endereço do site", "Estética João-");

    // O hifen do fim fica enquanto ele digita: pode vir mais palavra depois.
    expect(campo("Endereço do site").value).toBe("esteticajoao-");
  });

  test("avisa quando o endereco esta livre", async () => {
    render(<CadastroEstetica />);

    digitar("Endereço do site", "esteticadojoao");
    await esperarConsulta();

    expect(pedidos[0].url).toBe("/api/esteticas/endereco?valor=esteticadojoao");
    expect(screen.getByText("Endereço disponível")).toBeInTheDocument();
  });

  test("avisa quando o endereco ja e de outra estetica", async () => {
    respostas["/api/esteticas/endereco"] = {
      status: 200,
      corpo: { endereco: "demo", disponivel: false, motivo: "em-uso" },
    };
    render(<CadastroEstetica />);

    digitar("Endereço do site", "demo");
    await esperarConsulta();

    expect(screen.getByText("Esse endereço já é de outra estética. Escolha outro")).toBeInTheDocument();
  });

  test("endereco curto ou proibido avisa sem consultar o servidor", async () => {
    render(<CadastroEstetica />);

    digitar("Endereço do site", "admin");
    await esperarConsulta();

    expect(pedidos).toHaveLength(0);
    expect(screen.getByText("Esse endereço é reservado pelo Astro. Escolha outro")).toBeInTheDocument();
  });
});

describe("criar a estetica", () => {
  test("cria, entra com o e-mail e a senha e vai para o painel da estetica nova", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    render(<CadastroEstetica />);

    preencherTudo();
    await criar();

    const cadastro = pedidos.find((p) => p.url === "/api/esteticas");
    expect(cadastro?.corpo).toEqual({
      nomeEstetica: "Estética do João",
      endereco: "esteticadojoao",
      nome: "João Pereira",
      email: "joao@exemplo.com",
      whatsapp: "(47) 99999-0000",
      senha: "Senha123",
      aceitouTermos: true,
      site: "",
    });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "joao@exemplo.com",
      password: "Senha123",
      tenantSlug: "esteticadojoao",
      redirect: false,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(roteador.push).toHaveBeenCalledWith("/esteticadojoao/admin");
  });

  test("erro num campo aparece embaixo dele", async () => {
    respostas["/api/esteticas"] = {
      status: 409,
      corpo: { error: "Esse endereço já é de outra estética. Escolha outro", campo: "endereco" },
    };
    render(<CadastroEstetica />);

    preencherTudo();
    await criar();

    expect(campo("Endereço do site")).toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });

  test("limite de cadastros por hora aparece no topo", async () => {
    respostas["/api/esteticas"] = {
      status: 429,
      corpo: { error: "Muitos cadastros feitos desta conexao. Tente de novo em uma hora." },
    };
    render(<CadastroEstetica />);

    preencherTudo();
    await criar();

    expect(screen.getByRole("alert")).toHaveTextContent("Muitos cadastros feitos desta conexao");
  });

  test("se o login automatico falhar, manda para o login da estetica nova", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "CredentialsSignin", ok: false, status: 401, url: null });
    render(<CadastroEstetica />);

    preencherTudo();
    await criar();

    expect(roteador.push).toHaveBeenCalledWith("/esteticadojoao/login");
  });

  test("o campo anti-robo fica escondido de quem usa a tela", () => {
    const { container } = render(<CadastroEstetica />);
    const isca = container.querySelector('input[name="site"]');

    expect(isca).toHaveAttribute("tabindex", "-1");
    expect(isca?.closest("[aria-hidden]")).not.toBeNull();
  });
});
