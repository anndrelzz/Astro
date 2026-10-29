import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// RF08, RF09, RN13 — envio de e-mail (Resend) e de Telegram. Nada sai de
// verdade: o Resend e o fetch sao substituidos por funcoes falsas, e as
// chaves do .env local sao trocadas pelas de cada teste.

const { enviarResend } = vi.hoisted(() => ({ enviarResend: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviarResend };
  },
}));

// O cliente do Resend e criado quando o modulo carrega, a partir da chave do
// ambiente; por isso cada teste carrega o modulo de novo.
async function carregarEmail(chave: string) {
  vi.stubEnv("RESEND_API_KEY", chave);
  vi.resetModules();
  return import("@/lib/notificacoes/email");
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  enviarResend.mockReset();
});

describe("enviarEmail", () => {
  test("sem chave do Resend, registra no log e nao envia", async () => {
    const { enviarEmail } = await carregarEmail("");
    expect(await enviarEmail("cliente@teste.com", "Assunto", "Texto")).toEqual({
      enviado: true,
      modo: "log",
    });
    expect(enviarResend).not.toHaveBeenCalled();
  });

  test("com chave, envia pelo Resend para o cliente", async () => {
    enviarResend.mockResolvedValue({ error: null });
    const { enviarEmail } = await carregarEmail("re_teste");

    expect(await enviarEmail("cliente@teste.com", "Agendamento confirmado", "Texto")).toEqual({
      enviado: true,
      modo: "resend",
    });
    expect(enviarResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "cliente@teste.com",
        subject: "Agendamento confirmado",
        text: "Texto",
      })
    );
  });

  test("erro do Resend volta como envio que falhou, sem derrubar o fluxo", async () => {
    enviarResend.mockResolvedValue({ error: { message: "dominio nao verificado" } });
    const { enviarEmail } = await carregarEmail("re_teste");

    expect(await enviarEmail("cliente@teste.com", "Assunto", "Texto")).toEqual({
      enviado: false,
      modo: "resend",
      erro: "dominio nao verificado",
    });
  });
});

describe("enviarTelegram", () => {
  test("sem token do bot, registra no log e nao chama a API", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const chamada = vi.fn();
    vi.stubGlobal("fetch", chamada);
    const { enviarTelegram } = await import("@/lib/notificacoes/telegram");

    expect(await enviarTelegram("123", "Texto")).toEqual({ enviado: true, modo: "log" });
    expect(chamada).not.toHaveBeenCalled();
  });

  test("com token, manda a mensagem para o chat do cliente", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token-teste");
    const chamada = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", chamada);
    const { enviarTelegram } = await import("@/lib/notificacoes/telegram");

    expect(await enviarTelegram("123", "Texto")).toEqual({ enviado: true, modo: "bot" });
    const [url, opcoes] = chamada.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottoken-teste/sendMessage");
    expect(JSON.parse(opcoes.body)).toEqual({ chat_id: "123", text: "Texto" });
  });

  test("recusa da API volta como envio que falhou", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token-teste");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, description: "chat not found" }),
      })
    );
    const { enviarTelegram } = await import("@/lib/notificacoes/telegram");

    expect(await enviarTelegram("123", "Texto")).toEqual({
      enviado: false,
      modo: "bot",
      erro: "chat not found",
    });
  });
});
