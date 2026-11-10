import { chaveDia, horaMinuto, inicioDoDia } from "@/compartilhado/fuso";

// "Ja fiz o pagamento" (PIX): o texto que o painel do Admin mostra com a hora
// do aviso, no fuso da estetica. Hoje so a hora; ontem; antes disso, o dia.
export function textoPagamentoInformado(informadoEm: Date, agora: Date = new Date()): string {
  const hora = horaMinuto(informadoEm);
  const dia = chaveDia(informadoEm);
  if (dia === chaveDia(agora)) return `Cliente diz que pagou às ${hora}`;
  if (dia === chaveDia(inicioDoDia(agora, -1))) return `Cliente diz que pagou ontem às ${hora}`;
  const [, mes, diaDoMes] = dia.split("-");
  return `Cliente diz que pagou em ${diaDoMes}/${mes} às ${hora}`;
}
