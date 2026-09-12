import type { AccessOrigin } from "@/shared/components/access/access-spine";

export type ExampleOrganization = {
  name: string;
};

export type ExampleSpaceKind = "unit" | "free";

export type ExampleSpace = {
  id: string;
  name: string;
  parentId: string | null;
  kind: ExampleSpaceKind;
  restricted: boolean;
};

export type ExampleInlineContent = {
  type: "text";
  text: string;
  styles: Record<string, never>;
};

export type ExampleHeadingBlock = {
  id: string;
  type: "heading";
  props: { level: 2 | 3 };
  content: ExampleInlineContent[];
  children: ExampleBlock[];
};

export type ExampleParagraphBlock = {
  id: string;
  type: "paragraph";
  props: Record<string, never>;
  content: ExampleInlineContent[];
  children: ExampleBlock[];
};

export type ExampleBulletListItemBlock = {
  id: string;
  type: "bulletListItem";
  props: Record<string, never>;
  content: ExampleInlineContent[];
  children: ExampleBlock[];
};

export type ExampleNumberedListItemBlock = {
  id: string;
  type: "numberedListItem";
  props: Record<string, never>;
  content: ExampleInlineContent[];
  children: ExampleBlock[];
};

export type ExampleBlock =
  | ExampleHeadingBlock
  | ExampleParagraphBlock
  | ExampleBulletListItemBlock
  | ExampleNumberedListItemBlock;

export type ExampleDocument = {
  id: string;
  title: string;
  origin: AccessOrigin;
  spaceId: string | null;
  ownerName: string;
  updatedAt: string;
  blocks: ExampleBlock[];
};

function text(value: string): ExampleInlineContent[] {
  return [{ type: "text", text: value, styles: {} }];
}

function heading(id: string, level: 2 | 3, value: string): ExampleHeadingBlock {
  return { id, type: "heading", props: { level }, content: text(value), children: [] };
}

function paragraph(id: string, value: string): ExampleParagraphBlock {
  return { id, type: "paragraph", props: {}, content: text(value), children: [] };
}

function bulletListItem(id: string, value: string): ExampleBulletListItemBlock {
  return { id, type: "bulletListItem", props: {}, content: text(value), children: [] };
}

export const EXEMPLO_ORGANIZACAO: ExampleOrganization = {
  name: "Arcabouço Tecnologia",
};

export const EXEMPLO_ESPACOS: ExampleSpace[] = [
  { id: "produto", name: "Produto", parentId: null, kind: "unit", restricted: false },
  { id: "design", name: "Design", parentId: "produto", kind: "unit", restricted: false },
  { id: "engenharia", name: "Engenharia", parentId: "produto", kind: "unit", restricted: false },
  { id: "backend", name: "Backend", parentId: "engenharia", kind: "unit", restricted: false },
  { id: "frontend", name: "Frontend", parentId: "engenharia", kind: "unit", restricted: false },
  { id: "operacoes", name: "Operações", parentId: null, kind: "unit", restricted: false },
  { id: "financeiro", name: "Financeiro", parentId: "operacoes", kind: "unit", restricted: false },
  { id: "pessoas", name: "Pessoas", parentId: "operacoes", kind: "unit", restricted: false },
  {
    id: "comite-seguranca",
    name: "Comitê de Segurança",
    parentId: null,
    kind: "free",
    restricted: true,
  },
];

export const EXEMPLO_DOCUMENTOS: ExampleDocument[] = [
  {
    id: "guia-onboarding-engenharia",
    title: "Guia de onboarding de engenharia",
    origin: "canal",
    spaceId: "engenharia",
    ownerName: "Diego Almeida",
    updatedAt: "2026-09-09",
    blocks: [
      heading("guia-onboarding-engenharia-1", 2, "Antes do primeiro dia"),
      paragraph(
        "guia-onboarding-engenharia-2",
        "Configure a conta na Folioteca e leia o guia de acesso enviado pelo RH.",
      ),
      heading("guia-onboarding-engenharia-3", 2, "Primeira semana"),
      bulletListItem("guia-onboarding-engenharia-4", "Conhecer o time de Backend e Frontend."),
      bulletListItem("guia-onboarding-engenharia-5", "Configurar o ambiente local."),
      bulletListItem(
        "guia-onboarding-engenharia-6",
        "Ler a especificação da API de pagamentos.",
      ),
      heading("guia-onboarding-engenharia-7", 2, "Primeiro mês"),
      paragraph(
        "guia-onboarding-engenharia-8",
        "Participar de uma reunião do Comitê de Segurança como ouvinte.",
      ),
    ],
  },
  {
    id: "especificacao-api-pagamentos",
    title: "Especificação da API de pagamentos",
    origin: "canal",
    spaceId: "backend",
    ownerName: "Diego Almeida",
    updatedAt: "2026-09-08",
    blocks: [
      heading("especificacao-api-pagamentos-1", 2, "Visão geral"),
      paragraph(
        "especificacao-api-pagamentos-2",
        "Define os endpoints e os contratos para cobrar e conciliar pagamentos dos espaços da Folioteca.",
      ),
      heading("especificacao-api-pagamentos-3", 2, "Endpoints"),
      bulletListItem("especificacao-api-pagamentos-4", "POST /payments cria uma cobrança."),
      bulletListItem(
        "especificacao-api-pagamentos-5",
        "GET /payments/:id consulta o status.",
      ),
      bulletListItem(
        "especificacao-api-pagamentos-6",
        "POST /payments/:id/refund devolve o valor.",
      ),
      heading("especificacao-api-pagamentos-7", 2, "Erros"),
      paragraph(
        "especificacao-api-pagamentos-8",
        "Toda falha de cobrança devolve o código do provedor junto com a mensagem traduzida para a pessoa.",
      ),
    ],
  },
  {
    id: "sistema-design-principios",
    title: "Sistema de design — princípios",
    origin: "canal",
    spaceId: "design",
    ownerName: "Bianca Ferraz",
    updatedAt: "2026-09-05",
    blocks: [
      heading("sistema-design-principios-1", 2, "Propósito"),
      paragraph(
        "sistema-design-principios-2",
        "Reúne os princípios que guiam cor, tipografia e espaço em todos os produtos da Arcabouço.",
      ),
      heading("sistema-design-principios-3", 2, "Princípios"),
      bulletListItem("sistema-design-principios-4", "Conteúdo antes do ornamento."),
      bulletListItem("sistema-design-principios-5", "Contraste suficiente em qualquer tema."),
      bulletListItem("sistema-design-principios-6", "Um só sinal nunca é o único sinal."),
      heading("sistema-design-principios-7", 2, "Como usar"),
      paragraph(
        "sistema-design-principios-8",
        "Consulte os tokens antes de escrever um valor novo; token que falta é uma conversa com o time, não um valor solto.",
      ),
    ],
  },
  {
    id: "politica-despesas-2026",
    title: "Política de despesas 2026",
    origin: "canal",
    spaceId: "financeiro",
    ownerName: "Marina Lopes",
    updatedAt: "2026-09-10",
    blocks: [
      heading("politica-despesas-2026-1", 2, "Quem pode pedir reembolso"),
      paragraph(
        "politica-despesas-2026-2",
        "Toda pessoa contratada, a partir do primeiro dia, pode solicitar reembolso de despesas ligadas ao trabalho.",
      ),
      heading("politica-despesas-2026-3", 2, "Limites por categoria"),
      bulletListItem("politica-despesas-2026-4", "Transporte: até R$ 60 por dia."),
      bulletListItem(
        "politica-despesas-2026-5",
        "Alimentação em viagem: até R$ 120 por dia.",
      ),
      bulletListItem("politica-despesas-2026-6", "Equipamento: sob aprovação da liderança."),
      heading("politica-despesas-2026-7", 2, "Como solicitar"),
      paragraph(
        "politica-despesas-2026-8",
        "Envie a nota fiscal e a categoria pelo formulário do Financeiro até o quinto dia útil do mês seguinte.",
      ),
    ],
  },
  {
    id: "plano-contratacoes-trimestre",
    title: "Plano de contratações do trimestre",
    origin: "canal",
    spaceId: "pessoas",
    ownerName: "Renata Sales",
    updatedAt: "2026-08-28",
    blocks: [
      heading("plano-contratacoes-trimestre-1", 2, "Vagas abertas"),
      bulletListItem("plano-contratacoes-trimestre-2", "Duas vagas de Engenharia Backend."),
      bulletListItem("plano-contratacoes-trimestre-3", "Uma vaga de Design de produto."),
      bulletListItem(
        "plano-contratacoes-trimestre-4",
        "Uma vaga de Operações Financeiras.",
      ),
      heading("plano-contratacoes-trimestre-5", 2, "Processo"),
      paragraph(
        "plano-contratacoes-trimestre-6",
        "Cada vaga passa por triagem, entrevista com o time e conversa final com a liderança da área.",
      ),
      heading("plano-contratacoes-trimestre-7", 2, "Prazo"),
      paragraph(
        "plano-contratacoes-trimestre-8",
        "A meta é fechar as quatro posições até o fim do trimestre.",
      ),
    ],
  },
  {
    id: "ata-comite-seguranca-agosto",
    title: "Ata do comitê de segurança — agosto",
    origin: "canal",
    spaceId: "comite-seguranca",
    ownerName: "Renata Sales",
    updatedAt: "2026-08-20",
    blocks: [
      heading("ata-comite-seguranca-agosto-1", 2, "Presentes"),
      paragraph(
        "ata-comite-seguranca-agosto-2",
        "Participaram a liderança de Engenharia, Operações e a própria Renata Sales, relatora do comitê.",
      ),
      heading("ata-comite-seguranca-agosto-3", 2, "Temas discutidos"),
      bulletListItem(
        "ata-comite-seguranca-agosto-4",
        "Resultado da auditoria de acesso do trimestre.",
      ),
      bulletListItem(
        "ata-comite-seguranca-agosto-5",
        "Revisão da política de retenção de dados.",
      ),
      bulletListItem("ata-comite-seguranca-agosto-6", "Plano de resposta a incidentes."),
      heading("ata-comite-seguranca-agosto-7", 2, "Próximos passos"),
      paragraph(
        "ata-comite-seguranca-agosto-8",
        "A auditoria de acesso se repete no próximo trimestre, com relatório aberto ao comitê.",
      ),
    ],
  },
  {
    id: "notas-1-1-gestora",
    title: "Notas da 1:1 com a gestora",
    origin: "pessoa",
    spaceId: null,
    ownerName: "Marina Lopes",
    updatedAt: "2026-09-07",
    blocks: [
      heading("notas-1-1-gestora-1", 2, "Combinados"),
      paragraph(
        "notas-1-1-gestora-2",
        "Marina compartilhou estas notas depois da conversa de acompanhamento do mês.",
      ),
      heading("notas-1-1-gestora-3", 2, "Pontos levantados"),
      bulletListItem("notas-1-1-gestora-4", "Andamento das metas do trimestre."),
      bulletListItem("notas-1-1-gestora-5", "Necessidade de apoio num projeto específico."),
      heading("notas-1-1-gestora-6", 2, "Próxima conversa"),
      paragraph("notas-1-1-gestora-7", "Marcada para o início do próximo mês."),
    ],
  },
  {
    id: "rascunho-ferias",
    title: "Rascunho de férias",
    origin: "privado",
    spaceId: null,
    ownerName: "a própria pessoa",
    updatedAt: "2026-09-11",
    blocks: [
      heading("rascunho-ferias-1", 2, "Datas possíveis"),
      paragraph(
        "rascunho-ferias-2",
        "Duas semanas na segunda quinzena de outubro, a confirmar com o time.",
      ),
      heading("rascunho-ferias-3", 2, "Antes de sair"),
      bulletListItem("rascunho-ferias-4", "Passar as pendências para quem cobre."),
      bulletListItem(
        "rascunho-ferias-5",
        "Avisar o Financeiro sobre o pagamento adiantado.",
      ),
    ],
  },
];
