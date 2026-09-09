const PADROES_PROIBIDOS = ["bg-[", "text-[", "p-[", "h-["];

const MARCA_JUSTIFICATIVA =
  /^\s*(\/\/|\/\*)\s*(motivo|por ?qu[êe]|decis[ãa]o|contorno|invariante|limita[çc][ãa]o|restri[çc][ãa]o):/i;

function trechoProibido(texto) {
  return PADROES_PROIBIDOS.find((padrao) => texto.includes(padrao));
}

function linhaAcimaJustificada(sourceCode, linha) {
  const anterior = sourceCode.lines[linha - 2];
  return typeof anterior === "string" && MARCA_JUSTIFICATIVA.test(anterior);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "reprova sintaxe arbitrária do Tailwind (bg-[, text-[, p-[, h-[) em className sem marca de justificativa na linha acima",
    },
    schema: [],
    messages: {
      valorMagico:
        "valor mágico em className ('{{trecho}}'): use um token do tema ou justifique com uma marca (motivo:, por quê:, decisão:, contorno:, invariante:, limitação:, restrição:) na linha acima.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function verificar(node, texto) {
      if (typeof texto !== "string") return;
      const trecho = trechoProibido(texto);
      if (!trecho) return;
      if (linhaAcimaJustificada(sourceCode, node.loc.start.line)) return;
      context.report({ node, messageId: "valorMagico", data: { trecho } });
    }

    return {
      JSXAttribute(node) {
        if (
          node.name.type !== "JSXIdentifier" ||
          node.name.name !== "className"
        ) {
          return;
        }
        const valor = node.value;
        if (!valor) return;
        if (valor.type === "Literal" && typeof valor.value === "string") {
          verificar(valor, valor.value);
          return;
        }
        if (valor.type === "JSXExpressionContainer") {
          const expressao = valor.expression;
          if (
            expressao.type === "Literal" &&
            typeof expressao.value === "string"
          ) {
            verificar(expressao, expressao.value);
          } else if (expressao.type === "TemplateLiteral") {
            for (const quasi of expressao.quasis) {
              verificar(quasi, quasi.value.raw);
            }
          }
        }
      },
    };
  },
};
