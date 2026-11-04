import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { signIn } from "next-auth/react";
import { EsqueciSenhaForm, RedefinirSenhaForm } from "@/front/login/esqueci-senha";

// RFC 6.2 — "esqueci minha senha": pedir o link pelo e-mail e criar a senha
// nova pelo link. A resposta do pedido e sempre a mesma, tenha conta ou nao.

const roteador = { push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

const ESTETICA = { nome: "Estetica Demo", logoUrl: null };

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(signIn).mockReset();
  for (const f of Object.values(roteador)) f.mockReset();
});

function respostaDaApi(status: number, corpo: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("EsqueciSenhaForm", () => {
  test("pede o link para o e-mail na estetica do endereco e mostra o aviso", async () => {
    const fetchMock = respostaDaApi(200, { ok: true });
    render(<EsqueciSenhaForm slug="demo" estetica={ESTETICA} />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "maria@teste.com" } });
    await clicar("Enviar link");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/esqueci-senha");
    expect(JSON.parse(init!.body as string)).toEqual({ tenantSlug: "demo", email: "maria@teste.com" });
    // Nao diz se a conta existe: so o que fazer agora.
    expect(screen.getByText(/Se existir uma conta com maria@teste.com/)).toBeInTheDocument();
  });

  test("tem o caminho de volta para o login", () => {
    render(<EsqueciSenhaForm slug="demo" estetica={ESTETICA} />);
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute("href", "/demo/login");
  });
});

describe("RedefinirSenhaForm", () => {
  test("cria a senha nova pelo link e ja entra na conta", async () => {
    const fetchMock = respostaDaApi(200, { email: "maria@teste.com" });
    vi.mocked(signIn).mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    render(<RedefinirSenhaForm slug="demo" token="tok-123" estetica={ESTETICA} />);

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "NovaSenha1" } });
    await clicar("Salvar nova senha");

    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      tenantSlug: "demo",
      token: "tok-123",
      senha: "NovaSenha1",
    });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "maria@teste.com",
      password: "NovaSenha1",
      tenantSlug: "demo",
      redirect: false,
    });
    expect(roteador.push).toHaveBeenCalledWith("/demo");
  });

  test("link vencido ou usado: mostra o motivo e oferece pedir outro", async () => {
    respostaDaApi(400, { error: "Este link expirou ou já foi usado. Peça um novo." });
    render(<RedefinirSenhaForm slug="demo" token="tok-velho" estetica={ESTETICA} />);

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "NovaSenha1" } });
    await clicar("Salvar nova senha");

    expect(screen.getByText("Este link expirou ou já foi usado. Peça um novo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute("href", "/demo/esqueci-senha");
    expect(signIn).not.toHaveBeenCalled();
  });

  test("senha recusada pela regra aparece embaixo do campo", async () => {
    respostaDaApi(400, { error: "Senha deve conter ao menos 1 numero", campo: "senha" });
    render(<RedefinirSenhaForm slug="demo" token="tok-123" estetica={ESTETICA} />);

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "SenhaSemNumero" } });
    await clicar("Salvar nova senha");

    expect(screen.getByLabelText("Nova senha")).toHaveAccessibleDescription("Senha deve conter ao menos 1 numero");
  });
});
