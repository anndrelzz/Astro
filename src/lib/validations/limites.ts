// Tamanho maximo dos campos de texto livre. Os mesmos numeros valem no
// servidor (.max do zod) e na tela (maxLength do input): se divergirem, a
// tela deixa digitar algo que o servidor recusa, ou o contrario.
//
// Sem limite, um paragrafo colado por engano no nome do servico era aceito e
// esticava o catalogo e o card da vitrine; e o cadastro, que e publico, guardava
// texto de qualquer tamanho.
//
// Este arquivo e importado por componentes client: so constantes, nada de servidor.
export const LIMITES = {
  // Nome completo brasileiro raramente passa de 70. Vale no cadastro e no
  // perfil — se fossem diferentes, quem cadastrou nao conseguiria salvar o perfil.
  nomePessoa: 100,
  // Maximo que o padrao de e-mail permite.
  email: 254,
  // O bcrypt so considera os 72 primeiros bytes e descarta o resto em
  // silencio. Recusar acima disso e mais honesto do que aceitar uma senha que
  // vale so pela metade.
  senha: 72,
  // Vira coluna no catalogo e titulo no card do servico.
  nomeServico: 60,
  // O BR Code do Banco Central fica entre 100 e 300 caracteres; 512 cabe
  // qualquer codigo real e barra um texto colado por engano.
  pixCopiaCola: 512,
  marcaVeiculo: 40,
  modeloVeiculo: 60,
  corVeiculo: 30,
} as const;
