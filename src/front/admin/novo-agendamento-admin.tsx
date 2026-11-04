"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { chaveDia, inicioDoDia, instanteNoFuso } from "@/compartilhado/fuso";
import { JANELA_AGENDAMENTO_ADMIN_DIAS } from "@/compartilhado/agenda";
import { LIMITES } from "@/compartilhado/validacoes/limites";
import { Modal } from "@/front/admin/modal";

// O Admin agenda quem chamou no WhatsApp ou no Instagram, pelo cliente
// "coringa" da estetica (decisao do orientador, 30/10; regras de 04/11).
// So o tipo de veiculo e o modelo sao obrigatorios, porque quem chama nem
// sempre sabe a placa; a placa ja agendada antes preenche o carro e o ultimo
// contato. O preco sai da tabela e o pagamento e sempre no local.

type ServicoOpcao = { id: string; nome: string; duracaoMin: number; precos: Record<string, number> };
type CarroDoCoringa = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  segmentoId: string;
  contatoNome: string;
  contatoTelefone: string;
};

type Campo =
  | "servicoId"
  | "segmentoId"
  | "placa"
  | "modelo"
  | "marca"
  | "ano"
  | "cor"
  | "contatoNome"
  | "contatoTelefone"
  | "data"
  | "hora";

const inputCls =
  "w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2.5 text-sm text-slate-100 placeholder:text-astro-muted aria-[invalid=true]:border-red-400/80";

const normalizarPlaca = (p: string) => p.toUpperCase().replace(/[\s-]/g, "");

function formatarReal(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NovoAgendamentoAdmin({
  tenantId,
  servicos,
  segmentos,
  veiculosDoCoringa,
  hoje,
}: {
  tenantId: string;
  servicos: ServicoOpcao[];
  segmentos: { id: string; nome: string }[];
  veiculosDoCoringa: CarroDoCoringa[];
  /** "AAAA-MM-DD" no relogio da estetica, vindo do servidor. */
  hoje: string;
}) {
  const router = useRouter();
  const id = useId();
  const vazio = {
    servicoId: servicos[0]?.id ?? "",
    segmentoId: segmentos[0]?.id ?? "",
    placa: "",
    modelo: "",
    marca: "",
    ano: "",
    cor: "",
    contatoNome: "",
    contatoTelefone: "",
    data: "",
    hora: "",
  };
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [carroConhecido, setCarroConhecido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<{ campo: Campo; mensagem: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [a, m, d] = hoje.split("-").map(Number);
  const ultimoDia = chaveDia(inicioDoDia(instanteNoFuso(a, m, d), JANELA_AGENDAMENTO_ADMIN_DIAS - 1));
  const servico = servicos.find((s) => s.id === form.servicoId);
  const preco = servico?.precos[form.segmentoId];

  function alterar(campo: Campo, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErroCampo((atual) => (atual?.campo === campo ? null : atual));
  }

  async function carregarHorarios(servicoId: string, data: string) {
    setForm((f) => ({ ...f, hora: "" }));
    if (!servicoId || !data) {
      setHorarios(null);
      return;
    }
    setCarregandoHorarios(true);
    const resposta = await fetch(
      `/api/slots?tenantId=${tenantId}&servicoId=${servicoId}&data=${data}&paraAdmin=1`
    );
    const json = await resposta.json().catch(() => null);
    setCarregandoHorarios(false);
    if (!resposta.ok) {
      setHorarios([]);
      setErroCampo({ campo: "data", mensagem: json?.error ?? "Não foi possível ver os horários." });
      return;
    }
    setHorarios(json?.slots ?? []);
  }

  function alterarPlaca(valor: string) {
    alterar("placa", valor);
    const carro = veiculosDoCoringa.find((v) => v.placa && v.placa === normalizarPlaca(valor));
    setCarroConhecido(!!carro);
    if (carro) {
      setForm((f) => ({
        ...f,
        placa: valor,
        modelo: carro.modelo,
        marca: carro.marca,
        segmentoId: carro.segmentoId,
        contatoNome: carro.contatoNome || f.contatoNome,
        contatoTelefone: carro.contatoTelefone || f.contatoTelefone,
      }));
    }
  }

  function fechar() {
    setAberto(false);
    setForm(vazio);
    setHorarios(null);
    setCarroConhecido(false);
    setErro(null);
    setErroCampo(null);
  }

  async function agendar() {
    setErro(null);
    setErroCampo(null);
    setSalvando(true);
    const resposta = await fetch("/api/admin/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSalvando(false);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      if (json?.error && json?.campo && json.campo in vazio) {
        setErroCampo({ campo: json.campo, mensagem: json.error });
      } else {
        setErro(json?.error ?? "Não foi possível agendar.");
      }
      return;
    }
    fechar();
    router.refresh();
  }

  // Rotulo ligado ao campo e o erro dele embaixo (o leitor de tela le junto).
  function rotulo(campo: Campo, texto: string) {
    return (
      <label htmlFor={`${id}-${campo}`} className="mb-1.5 block text-sm text-astro-muted">
        {texto}
      </label>
    );
  }
  function marcacao(campo: Campo) {
    const comErro = erroCampo?.campo === campo;
    return {
      id: `${id}-${campo}`,
      "aria-invalid": comErro || undefined,
      "aria-describedby": comErro ? `${id}-${campo}-erro` : undefined,
    };
  }
  function erroDo(campo: Campo) {
    return (
      erroCampo?.campo === campo && (
        <p id={`${id}-${campo}-erro`} className="mt-1 text-xs font-medium text-red-300">
          {erroCampo.mensagem}
        </p>
      )
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-full bg-astro-blue px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_var(--color-astro-blue)] transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        Novo agendamento
      </button>

      <Modal
        aberto={aberto}
        onFechar={fechar}
        titulo="Novo agendamento"
        rodape={
          <>
            <button
              type="button"
              onClick={fechar}
              className="ml-auto rounded-full border border-admin-border px-5 py-2.5 text-sm text-astro-muted transition hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agendar}
              disabled={salvando || !form.hora}
              className="rounded-full bg-astro-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {salvando ? "Agendando..." : "Agendar"}
            </button>
          </>
        }
      >
        <div className="grid gap-5">
          <p className="text-sm text-astro-muted">
            Para quem chamou no WhatsApp ou no Instagram. Não gera notificação: combine os detalhes direto com a pessoa.
          </p>

          {erro && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {erro}
            </p>
          )}

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold text-white">Atendimento</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                {rotulo("servicoId", "Serviço")}
                <select
                  {...marcacao("servicoId")}
                  value={form.servicoId}
                  onChange={(e) => {
                    alterar("servicoId", e.target.value);
                    void carregarHorarios(e.target.value, form.data);
                  }}
                  className={inputCls}
                >
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                {erroDo("servicoId")}
              </div>
              <div>
                {rotulo("segmentoId", "Tipo de veículo")}
                <select
                  {...marcacao("segmentoId")}
                  value={form.segmentoId}
                  onChange={(e) => alterar("segmentoId", e.target.value)}
                  className={inputCls}
                >
                  {segmentos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                {erroDo("segmentoId")}
              </div>
            </div>
            <p className="text-sm font-semibold text-white">
              {preco === undefined ? "Sem preço para este tipo de veículo no Catálogo" : `${formatarReal(preco)} · pago no local`}
            </p>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold text-white">Carro</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                {rotulo("placa", "Placa")}
                <input
                  {...marcacao("placa")}
                  value={form.placa}
                  maxLength={8}
                  placeholder="Opcional"
                  onChange={(e) => alterarPlaca(e.target.value)}
                  className={`${inputCls} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
                />
                {erroDo("placa")}
              </div>
              <div>
                {rotulo("modelo", "Modelo")}
                <input
                  {...marcacao("modelo")}
                  value={form.modelo}
                  maxLength={LIMITES.modeloVeiculo}
                  placeholder="Ex: Civic"
                  onChange={(e) => alterar("modelo", e.target.value)}
                  className={inputCls}
                />
                {erroDo("modelo")}
              </div>
              <div>
                {rotulo("marca", "Marca")}
                <input
                  {...marcacao("marca")}
                  value={form.marca}
                  maxLength={LIMITES.marcaVeiculo}
                  placeholder="Opcional"
                  onChange={(e) => alterar("marca", e.target.value)}
                  className={inputCls}
                />
                {erroDo("marca")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {rotulo("ano", "Ano")}
                  <input
                    {...marcacao("ano")}
                    value={form.ano}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Opcional"
                    onChange={(e) => alterar("ano", e.target.value.replace(/\D/g, ""))}
                    className={inputCls}
                  />
                  {erroDo("ano")}
                </div>
                <div>
                  {rotulo("cor", "Cor")}
                  <input
                    {...marcacao("cor")}
                    value={form.cor}
                    maxLength={LIMITES.corVeiculo}
                    placeholder="Opcional"
                    onChange={(e) => alterar("cor", e.target.value)}
                    className={inputCls}
                  />
                  {erroDo("cor")}
                </div>
              </div>
            </div>
            {carroConhecido && (
              <p className="rounded-lg bg-astro-blue/15 px-3 py-2 text-xs text-slate-200">
                Este carro já foi agendado antes. Preenchemos com o último contato: confira se é a mesma pessoa.
              </p>
            )}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold text-white">Quem chamou</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                {rotulo("contatoNome", "Nome de quem chamou")}
                <input
                  {...marcacao("contatoNome")}
                  value={form.contatoNome}
                  maxLength={LIMITES.nomePessoa}
                  onChange={(e) => alterar("contatoNome", e.target.value)}
                  className={inputCls}
                />
                {erroDo("contatoNome")}
              </div>
              <div>
                {rotulo("contatoTelefone", "Telefone")}
                <input
                  {...marcacao("contatoTelefone")}
                  value={form.contatoTelefone}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  onChange={(e) => alterar("contatoTelefone", e.target.value)}
                  className={inputCls}
                />
                {erroDo("contatoTelefone")}
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold text-white">Quando</legend>
            <div>
              {rotulo("data", "Data")}
              <input
                {...marcacao("data")}
                type="date"
                value={form.data}
                min={hoje}
                max={ultimoDia}
                onChange={(e) => {
                  alterar("data", e.target.value);
                  void carregarHorarios(form.servicoId, e.target.value);
                }}
                className={`${inputCls} [color-scheme:dark]`}
              />
              {erroDo("data")}
            </div>

            {carregandoHorarios && <p className="text-sm text-astro-muted">Buscando horários livres...</p>}
            {!carregandoHorarios && horarios?.length === 0 && !erroCampo && (
              <p className="text-sm text-astro-muted">Nenhum horário livre nesse dia.</p>
            )}
            {!carregandoHorarios && horarios && horarios.length > 0 && (
              <div role="group" aria-label="Horário" className="flex flex-wrap gap-2">
                {horarios.map((h) => {
                  const escolhido = form.hora === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={escolhido}
                      onClick={() => alterar("hora", h)}
                      className={
                        escolhido
                          ? "rounded-full bg-astro-blue px-3.5 py-1.5 font-mono text-xs font-semibold text-white"
                          : "rounded-full border border-admin-border px-3.5 py-1.5 font-mono text-xs font-semibold text-slate-200 transition hover:border-astro-blue"
                      }
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            )}
            {erroDo("hora")}
          </fieldset>
        </div>
      </Modal>
    </>
  );
}
