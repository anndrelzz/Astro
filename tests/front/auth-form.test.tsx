import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getSession, signIn } from "next-auth/react";
import { AuthForm } from "@/front/login/auth-form";

// RN02, UC01, UC03 — login e cadastro (telas 02 e 03): para onde cada um vai
// depois de entrar, e o que aparece quando da errado.

const roteador = { push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
let busca = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "demo" }),
  useRouter: () => roteador,
  useSearchParams: () => busca,
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), getSession: vi.fn() }));

const ESTETICA = { nome: "Estetica Demo", logoUrl: null };

function preencher(campos: Record<string, string>) {
  for (const [placeholder, valor] of Object.entries(campos)) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: valor } });
  }
}

async function enviar(botao: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${botao}`) }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  busca = new URLSearchParams();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(signIn).mockReset();
  vi.mocked(getSession).mockReset();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("AuthForm — login bloqueado (issue #107)", () => {
  test("conta bloqueada por tentativas explica quanto esperar e aponta o Esqueci minha senha", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "LOGIN_BLOQUEADO", ok: false, status: 401, url: null });
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "maria@teste.com", "••••••••": "Senha123" });
    await enviar("Entrar");

    expect(
      screen.getByText(
        "Muitas tentativas sem acertar a senha. Tente de novo em 15 minutos ou use o Esqueci minha senha."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("E-mail ou senha inválidos.")).not.toBeInTheDocument();
  });
});

describe("AuthForm — login", () => {
  test("credenciais erradas mostram o aviso e nao entram", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "CredentialsSignin", ok: false, status: 401, url: null });
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "maria@teste.com", "••••••••": "errada123" });
    await enviar("Entrar");

    expect(screen.getByText("E-mail ou senha inválidos.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(roteador.push).not.toHaveBeenCalled();
  });

  test("entra pela estetica do endereco, sem mandar o redirecionamento ao NextAuth", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    vi.mocked(getSession).mockResolvedValue(null);
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "maria@teste.com", "••••••••": "Senha123" });
    await enviar("Entrar");

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "maria@teste.com",
      password: "Senha123",
      tenantSlug: "demo",
      redirect: false,
    });
  });

  test("o Admin cai no painel depois da animacao", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    vi.mocked(getSession).mockResolvedValue({ user: { role: "ADMIN" } } as never);
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "dono@teste.com", "••••••••": "Senha123" });
    await enviar("Entrar");
    expect(roteador.push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2300);
    });
    expect(roteador.push).toHaveBeenCalledWith("/demo/admin");
  });

  test("com callbackUrl da propria estetica, volta para onde ia", async () => {
    busca = new URLSearchParams({ callbackUrl: "/demo/agendar/serv-1" });
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "maria@teste.com", "••••••••": "Senha123" });
    await enviar("Entrar");
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });

    expect(roteador.push).toHaveBeenCalledWith("/demo/agendar/serv-1");
  });

  test("callbackUrl de fora da estetica e ignorado", async () => {
    busca = new URLSearchParams({ callbackUrl: "//site-malicioso.com" });
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    vi.mocked(getSession).mockResolvedValue({ user: { role: "CLIENTE" } } as never);
    render(<AuthForm modo="login" estetica={ESTETICA} />);

    preencher({ "voce@email.com": "maria@teste.com", "••••••••": "Senha123" });
    await enviar("Entrar");
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });

    expect(roteador.push).toHaveBeenCalledWith("/demo");
  });
});

describe("AuthForm — esqueci minha senha", () => {
  test("o login tem o link para recuperar a senha, e o cadastro nao", () => {
    const { unmount } = render(<AuthForm modo="login" estetica={ESTETICA} />);
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/demo/esqueci-senha");
    unmount();

    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);
    expect(screen.queryByRole("link", { name: "Esqueci minha senha" })).not.toBeInTheDocument();
  });
});

describe("AuthForm — cadastro", () => {
  const CAMPOS = {
    "Seu nome": "Maria",
    "voce@email.com": "maria@teste.com",
    "(00) 00000-0000": "47999990000",
    "••••••••": "Senha123",
  };

  function aceitarTermos() {
    fireEvent.click(screen.getByRole("checkbox"));
  }

  test("cria a conta na estetica do endereco e ja entra", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    preencher(CAMPOS);
    aceitarTermos();
    await enviar("Criar conta");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/cadastro");
    expect(JSON.parse(init!.body as string)).toEqual({
      tenantSlug: "demo",
      nome: "Maria",
      email: "maria@teste.com",
      telefone: "47999990000",
      senha: "Senha123",
    });
    expect(signIn).toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2300);
    });
    expect(roteador.push).toHaveBeenCalledWith("/demo");
  });

  test("se o servidor recusar, mostra o motivo e nao tenta entrar", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "E-mail ja cadastrado" }), { status: 409 })
    );
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    preencher(CAMPOS);
    aceitarTermos();
    await enviar("Criar conta");

    expect(screen.getByText("E-mail ja cadastrado")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  test("erro de um campo aparece embaixo dele, e o campo fica marcado", async () => {
    const mensagem = "Telefone invalido - informe DDD + numero (10 ou 11 digitos)";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: mensagem, campo: "telefone" }), { status: 400 })
    );
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    preencher(CAMPOS);
    aceitarTermos();
    await enviar("Criar conta");

    const telefone = screen.getByPlaceholderText("(00) 00000-0000");
    expect(telefone).toHaveAttribute("aria-invalid", "true");
    expect(telefone).toHaveAccessibleDescription(mensagem);
    // So embaixo do campo: nao repete no aviso do topo.
    expect(screen.getAllByText(mensagem)).toHaveLength(1);
    expect(signIn).not.toHaveBeenCalled();
  });

  test("ao corrigir o campo, o erro dele some", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "E-mail invalido", campo: "email" }), { status: 400 })
    );
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    preencher(CAMPOS);
    aceitarTermos();
    await enviar("Criar conta");
    fireEvent.change(screen.getByPlaceholderText("voce@email.com"), { target: { value: "maria@teste.com.br" } });

    expect(screen.queryByText("E-mail invalido")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("voce@email.com")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("erro de um campo que nao esta na tela continua no aviso do topo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Estetica nao encontrada", campo: "tenantSlug" }), { status: 400 })
    );
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    preencher(CAMPOS);
    aceitarTermos();
    await enviar("Criar conta");

    expect(screen.getByRole("alert")).toHaveTextContent("Estetica nao encontrada");
  });

  test("o link para entrar mantem o callbackUrl", () => {
    busca = new URLSearchParams({ callbackUrl: "/demo/agendar/serv-1" });
    render(<AuthForm modo="cadastro" estetica={ESTETICA} />);

    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href")?.startsWith("/demo/login"));
    expect(link).toHaveAttribute("href", "/demo/login?callbackUrl=%2Fdemo%2Fagendar%2Fserv-1");
  });
});
