import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConfirmadoCliente } from "@/front/cliente/confirmado-cliente";

// Tela 12 — confirmacao do agendamento. So promete o e-mail quando ele sai de
// verdade: sem o Resend configurado, o e-mail vai so para o log do servidor.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));

const AGENDAMENTO = "ag-1";

function renderizar(emailEnviado: boolean) {
  return render(
    <ConfirmadoCliente
      slug="demo"
      agendamentoId={AGENDAMENTO}
      status="PENDENTE_PAGAMENTO"
      estetica="Estetica Demo"
      servico="Lavação completa"
      veiculo="Astra · Hatch"
      dataISO="2026-11-03T19:00:00.000Z"
      duracaoMin={120}
      formaPagamento="LOCAL"
      valor={70}
      acrescimoCondicaoPercent={null}
      emailEnviado={emailEnviado}
    />
  );
}

beforeEach(() => {
  // Revisita: a animacao de sucesso sai na hora e a tela aparece pronta.
  sessionStorage.setItem(`astro:confirmado:${AGENDAMENTO}`, "1");
});

describe("ConfirmadoCliente", () => {
  test("com o e-mail configurado, avisa que os detalhes foram para o e-mail", async () => {
    renderizar(true);

    expect(await screen.findByText("Enviamos os detalhes do agendamento para o seu e-mail.")).toBeInTheDocument();
  });

  test("sem e-mail saindo, nao promete o e-mail e aponta para Meus agendamentos", async () => {
    renderizar(false);

    expect(await screen.findByText(/Os detalhes ficam salvos em Meus agendamentos/)).toBeInTheDocument();
    expect(screen.queryByText(/Enviamos os detalhes/)).not.toBeInTheDocument();
  });
});
