const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const raiz = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const scriptsLocais = [...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map((match) => match[1].split("?")[0])
  .filter((src) => !/^https?:/i.test(src));

const erros = [];
for (const src of scriptsLocais) {
  const arquivo = path.join(raiz, src);
  if (!fs.existsSync(arquivo)) {
    erros.push(`Script referenciado e inexistente: ${src}`);
    continue;
  }
  try {
    execFileSync(process.execPath, ["--check", arquivo], { stdio: "pipe" });
  } catch (erro) {
    erros.push(`Erro de sintaxe em ${src}: ${erro.stderr?.toString().trim() || erro.message}`);
  }
}

const crud = fs.readFileSync(path.join(raiz, "js", "crud.js"), "utf8");
const pedidos = fs.readFileSync(path.join(raiz, "js", "pedidos-filtros.js"), "utf8");
if (/function\s+renderPedidos\s*\(/.test(crud)) {
  erros.push("crud.js voltou a declarar a tela antiga renderPedidos.");
}
if (!/window\.renderPedidos\s*=/.test(pedidos)) {
  erros.push("pedidos-filtros.js não publica a tela oficial de pedidos.");
}
if (!pedidos.includes('value="20 dias"') || !pedidos.includes('value="45 dias"')) {
  erros.push("A tela oficial de pedidos perdeu os prazos de 20 ou 45 dias.");
}
if (!pedidos.includes("pedido-preco-negociado") || !pedidos.includes("precoManual: true")) {
  erros.push("A tela oficial de pedidos perdeu o preço negociado do administrador.");
}

if (erros.length) {
  console.error(erros.join("\n"));
  process.exit(1);
}

console.log(`OK: ${scriptsLocais.length} scripts locais verificados.`);

