/* global __ENV, __VU */
// Teste de carga (M5 do RFC): RNF05 (100 esteticas ativas sem degradacao) e
// RNF02 (consulta de horarios livres em menos de 300 ms).
//
// Cada usuario virtual (VU) e o cliente de uma estetica de teste (zzcarga001,
// zzcarga002...): entra, abre a vitrine, consulta os horarios livres de um dia
// e, em parte das vezes, agenda um horario livre, com pausas de quem esta
// lendo a tela entre um passo e outro.
//
//   1. npx tsx tests/carga/esteticas-de-carga.ts criar 100
//   2. k6 run -e BASE_URL=http://localhost:3000 tests/carga/agendamento.js
//   3. npx tsx tests/carga/esteticas-de-carga.ts apagar
//
// Variaveis: BASE_URL (padrao: o site local), VUS (padrao 100), PICO (tempo no
// pico, padrao 3m).

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const VUS = Number(__ENV.VUS || 100);
const PICO = __ENV.PICO || "3m";

const dados = JSON.parse(open("./esteticas.json"));
const esteticas = new SharedArray("esteticas", () => dados.esteticas);
const SENHA = dados.senha;

export const options = {
  // Mantem o cookie da sessao entre as voltas: o cliente entra uma vez e
  // continua logado, como no celular (sem isso, o k6 limpa os cookies a cada
  // volta).
  noCookiesReset: true,
  scenarios: {
    clientes: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: VUS }, // chegam aos poucos
        { duration: PICO, target: VUS }, // todos ao mesmo tempo
        { duration: "30s", target: 0 }, // vao embora
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // RNF02: horarios livres em menos de 300 ms para 95% dos pedidos.
    "http_req_duration{passo:horarios}": ["p(95)<300"],
    // As outras etapas, para o relatorio sair com o tempo de cada uma. A
    // vitrine e uma pagina inteira montada no servidor; o login confere a
    // senha com bcrypt, lento de proposito; agendar trava o dia na fila.
    "http_req_duration{passo:vitrine}": ["p(95)<2000"],
    "http_req_duration{passo:login}": ["p(95)<2000"],
    "http_req_duration{passo:agendar}": ["p(95)<1000"],
    // Menos de 1% de falhas (erro 5xx ou sem resposta).
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  // 409 (horario pegado por outro cliente no mesmo instante) e uma resposta
  // esperada do sistema, nao uma falha.
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 409));

// "AAAA-MM-DD" de daqui a `dias`, no fuso de Brasilia (UTC-3).
function diaDaqui(dias) {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000 + dias * 24 * 60 * 60 * 1000);
  return brasilia.toISOString().slice(0, 10);
}

let logado = false;

function entrar(estetica) {
  const csrf = http.get(`${BASE}/api/auth/csrf`, { tags: { passo: "login" } }).json("csrfToken");
  const resposta = http.post(
    `${BASE}/api/auth/callback/credentials`,
    {
      csrfToken: csrf,
      email: estetica.email,
      password: SENHA,
      tenantSlug: estetica.slug,
      json: "true",
    },
    { tags: { passo: "login" }, redirects: 0 }
  );
  logado = check(resposta, {
    "login aceito": (r) => (r.status === 200 || r.status === 302) && !String(r.body).includes("error="),
  });
}

export default function cliente() {
  const estetica = esteticas[(__VU - 1) % esteticas.length];

  if (!logado) {
    group("login", () => entrar(estetica));
    if (!logado) {
      sleep(5);
      return;
    }
  }

  group("vitrine", () => {
    const pagina = http.get(`${BASE}/${estetica.slug}`, { tags: { passo: "vitrine" }, redirects: 0 });
    check(pagina, { "vitrine abre": (r) => r.status === 200 });
  });
  sleep(1 + Math.random() * 2);

  let livres = [];
  const data = diaDaqui(2 + Math.floor(Math.random() * 11));
  group("horarios", () => {
    const resposta = http.get(
      `${BASE}/api/slots?tenantId=${estetica.tenantId}&servicoId=${estetica.servicoId}&data=${data}`,
      { tags: { passo: "horarios" } }
    );
    check(resposta, { "horarios respondem": (r) => r.status === 200 });
    if (resposta.status === 200) livres = resposta.json("slots") || [];
  });
  sleep(1 + Math.random() * 2);

  // Uma em cada quatro voltas termina num agendamento, por PIX ou no local.
  if (livres.length > 0 && Math.random() < 0.25) {
    group("agendar", () => {
      const hora = livres[Math.floor(Math.random() * livres.length)];
      const resposta = http.post(
        `${BASE}/api/agendamentos`,
        JSON.stringify({
          servicoId: estetica.servicoId,
          veiculoId: estetica.veiculoId,
          data,
          hora,
          formaPagamento: Math.random() < 0.5 ? "PIX" : "LOCAL",
        }),
        { headers: { "Content-Type": "application/json" }, tags: { passo: "agendar" } }
      );
      check(resposta, { "agendamento criado ou horario ja ocupado": (r) => r.status === 201 || r.status === 409 });
    });
    sleep(1 + Math.random() * 2);
  }
}
