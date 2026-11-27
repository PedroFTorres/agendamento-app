const fs = require("fs");
const vm = require("vm");

let html = "";
global.window = {
  location: { href: "https://agendacf.com.br/" },
  open: () => ({
    closed: false,
    document: {
      open() {},
      write(valor) { html = valor; },
      close() {}
    }
  })
};
global.escapeHtmlRelatorio = valor => String(valor);

vm.runInThisContext(fs.readFileSync("js/relatorio-diario-valores.js", "utf8"));

imprimirRelatorioGerencialDiario("2026-11-26", [
  {
    produtoNome: "Telha Canal",
    produtoCategoria: "Telhas",
    quantidade: 90000,
    valorVenda: 80390,
    pedidoId: "1"
  },
  {
    produtoNome: "Telha Canal - Segunda",
    produtoCategoria: "Telhas de Segunda",
    quantidade: 4000,
    valorVenda: 2000,
    pedidoId: "2"
  }
]);

const esperados = [
  'TOTAL DE TELHAS</td><td class="num">90.000',
  'TOTAL DE TELHAS DE SEGUNDA</td><td class="num">4.000'
];

esperados.forEach(texto => {
  if (!html.includes(texto)) throw new Error(`Subtotal ausente: ${texto}`);
});

console.log("OK: materiais normais e de segunda possuem subtotais separados.");
