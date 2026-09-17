import "dotenv/config";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function lerArgs() {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const atual = argv[i];
    if (atual.startsWith("--")) {
      args[atual.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

// Slug vira parte da URL publica da estetica (RF14, RN09) - so minusculas,
// numeros e hifen, sem hifen duplicado/nas pontas.
const entradaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da estetica"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Slug invalido - use so minusculas, numeros e hifen (ex: "estetica-do-joao")'
    ),
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
});

// Le a senha em modo raw, mascarada (sem eco no terminal) - nunca como
// argumento de CLI, que ficaria visivel no historico do shell e em `ps aux`.
// So faz sentido com um TTY real: quem chama decide a alternativa sem TTY.
async function lerSenhaOculta(pergunta: string): Promise<string> {
  const ENTER = [10, 13]; // \n, \r
  const CTRL_D = 4;
  const CTRL_C = 3;
  const BACKSPACE = 127;

  return new Promise((resolve) => {
    stdout.write(pergunta);
    let senha = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char: string) => {
      const codigo = char.charCodeAt(0);
      if (ENTER.includes(codigo) || codigo === CTRL_D) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(senha);
        return;
      }
      if (codigo === CTRL_C) {
        stdout.write("\n");
        process.exit(1);
      }
      if (codigo === BACKSPACE) {
        senha = senha.slice(0, -1);
        return;
      }
      senha += char;
    };
    stdin.on("data", onData);
  });
}

// Le uma linha de um stdin nao-TTY (ex: pipe) puxando do iterador assincrono
// da interface em vez de encadear rl.question() - question() encadeado tem
// uma corrida conhecida do readline: se as linhas ja chegaram bufferizadas
// antes da segunda pergunta ser feita, o "line" da segunda e emitido sem
// nenhum listener esperando por ele e se perde. O iterador nao tem esse
// problema porque consome uma linha por vez sob demanda.
function criarLeitorDeLinhas(rl: Interface) {
  const linhas = rl[Symbol.asyncIterator]();
  return async (pergunta: string): Promise<string> => {
    stdout.write(pergunta);
    const { value } = await linhas.next();
    return value ?? "";
  };
}

async function main() {
  const argsBrutos = lerArgs();

  if (!argsBrutos.nome || !argsBrutos.slug || !argsBrutos.email) {
    console.error(
      'Uso: npx tsx prisma/criar-tenant.ts --nome "Estetica X" --slug "estetica-x" --email "admin@x.com"\n' +
        "A senha do admin e pedida interativamente, sem entrar no historico do shell."
    );
    process.exit(1);
  }

  const entrada = entradaSchema.safeParse(argsBrutos);
  if (!entrada.success) {
    console.error(entrada.error.issues.map((i) => `- ${i.message}`).join("\n"));
    process.exit(1);
  }
  const { nome, slug, email } = entrada.data;

  // rl so existe no caminho nao-TTY (pipe): sem terminal para mascarar, senha
  // e confirmacao saem da mesma interface, lida linha a linha pelo iterador.
  const rl = stdin.isTTY ? null : createInterface({ input: stdin, output: stdout, terminal: false });
  const perguntar = rl ? criarLeitorDeLinhas(rl) : null;

  const senha = perguntar ? await perguntar("Senha do admin: ") : await lerSenhaOculta("Senha do admin: ");
  if (senha.length < 8) {
    rl?.close();
    console.error("Senha muito curta - use pelo menos 8 caracteres.");
    process.exit(1);
  }

  // Confirmacao do alvo: o script escreve no banco que DATABASE_URL apontar
  // no momento (dev ou prod), sem aviso previo se nao fosse por isto aqui.
  const destino = new URL(process.env.DATABASE_URL ?? "");
  console.log(`\nBanco de destino: ${destino.hostname}${destino.pathname}`);
  const perguntaConfirmacao = `Criar a estetica "${nome}" (/${slug}) nesse banco? Digite "sim" para confirmar: `;
  let resposta: string;
  if (perguntar) {
    resposta = await perguntar(perguntaConfirmacao);
  } else {
    const rlConfirmacao = createInterface({ input: stdin, output: stdout });
    resposta = await rlConfirmacao.question(perguntaConfirmacao);
    rlConfirmacao.close();
  }
  rl?.close();
  const confirmado = resposta.trim().toLowerCase() === "sim";
  if (!confirmado) {
    console.log("Cancelado.");
    process.exit(0);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const tenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { nome, slug } });

      // RLS (migration 20260723_rls) exige app.tenant_id na sessao para
      // escrever em usuario. Dentro de $transaction todas as queries usam a
      // MESMA conexao, entao SET de sessao (nao SET LOCAL) e seguro aqui -
      // e, diferente do script antigo, tenant e admin sao atomicos: se o
      // segundo passo falhar, o primeiro tambem desfaz.
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, false)`,
        tenant.id
      );

      await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome: `Admin ${nome}`,
          email,
          senhaHash,
          role: "ADMIN",
        },
      });

      return tenant;
    });

    console.log(`\nEstetica "${tenant.nome}" criada em /${tenant.slug}`);
    console.log(`Login do admin: ${email}`);
  } catch (e) {
    // O adapter de driver (@prisma/adapter-pg) nao preenche e.meta.target
    // com os nomes das colunas como o Prisma padrao - so da pra saber que
    // foi uma violacao de unicidade, nao qual campo exatamente.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      console.error("Ja existe uma estetica com esse slug ou um admin com esse e-mail.");
      process.exit(1);
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
