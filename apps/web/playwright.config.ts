import { defineConfig } from "@playwright/test";

const API_PORT = 3000;
// decisão: a porta é parâmetro, e não constante. Os runners desta casa são
// processos da MESMA máquina, e dois jobs do mesmo fluxo — o que verifica a
// política e o que roda esta suíte — subiam ambos `vite preview` na 4173. O
// segundo a chegar morria com `http://localhost:4173 is already used`, e o
// portão de política, com `já há alguém atendendo em localhost:4173`. Nenhum dos
// dois é defeito de diff: é recurso da máquina tratado como se o job fosse dono
// dela. O padrão continua 4173 para quem roda na mão.
const WEB_PORT = Number(process.env.WEB_PREVIEW_PORT ?? 4173);
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

// decisão: a suíte sobe a aplicação UMA vez e mede tudo nessa subida. O custo de
// uma execução é dominado pelo build e pelo boot da API, não pelos casos, e o
// validador cego tem um critério comportamental por requisito — invocar o
// Playwright uma vez por critério multiplicaria o mesmo custo pelo número de
// critérios sem medir nada a mais. O relatório JSON abaixo é o que torna isso
// possível: uma execução produz o veredicto de todos os casos, e cada critério é
// respondido lendo o relatório, nunca subindo a aplicação de novo.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  // decisão: zero é "sem teto", e está escrito porque o padrão é invisível. Um
  // `maxFailures` diferente de zero encerra a execução no primeiro punhado de
  // falhas, e os casos que não chegaram a rodar viram ausência de resultado —
  // que o validador leria como "não reprovou". Uma parte falhar não pode
  // impedir o resto de ser medido na mesma subida.
  maxFailures: 0,

  // decisão: sem repetição. Repetir esconde instabilidade atrás de um verde no
  // segundo tento, e o custo dela é outra rodada da mesma aplicação. Caso
  // instável é defeito a corrigir, não ruído a diluir.
  retries: 0,

  // decisão: dois relatórios da MESMA execução. `list` é para quem lê no
  // terminal; o JSON é a evidência que o critério comportamental consulta, e é
  // por existir que ninguém precisa reexecutar a suíte para responder por um
  // caso específico.
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e-resultado.json" }],
    ["html", { open: "never" }],
  ],

  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },

  webServer: [
    {
      command: "pnpm --filter api run start",
      cwd: "../../",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL: "postgresql://folioteca:senha@localhost:5433/folioteca",
        WEB_ORIGIN: WEB_URL,
      },
    },
    {
      // decisão: o artefato de build, servido por `vite preview`, e não o
      // servidor de desenvolvimento. A política de conteúdo é injetada no HTML
      // apenas no build — em `vite dev` ela não existe, porque proibiria o
      // script embutido do recarregamento a quente. Medir contra o servidor de
      // desenvolvimento é medir uma página sem a política que a de produção
      // tem, e o defeito que escapa é justamente o da fonte servida por outra
      // origem: o texto cai na fonte de reserva e nada acusa.
      command: `pnpm --filter web run build && pnpm --filter web exec vite preview --port ${WEB_PORT}`,
      cwd: "../../",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_URL: API_URL,
      },
    },
  ],
});
