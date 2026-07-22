const PRAZOS_PRECO_PEDIDO = [
  { campo: "precoAVista", rotulo: "A vista" },
  { campo: "preco10Dias", rotulo: "A vista com 10 dias" },
  { campo: "preco30Dias", rotulo: "Prazo 30 dias" },
  { campo: "preco3060Dias", rotulo: "Prazo 30/60" }
];

function normalizarPrecoPrazo(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function numeroPrecoPrazo(valor, fallback = 0) {
  if (valor === "" || valor == null) return Number(fallback || 0);
  const texto = String(valor).trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : Number(fallback || 0);
}

function campoPrazoPreco(prazo) {
  const chave = normalizarPrecoPrazo(prazo);
  if (chave.includes("10")) return "preco10Dias";
  if (chave.includes("30/60") || chave.includes("30 60")) return "preco3060Dias";
  if (chave.includes("30")) return "preco30Dias";
  return "precoAVista";
}

function precoProdutoPorPrazo(produto = {}, prazo = "") {
  const campo = campoPrazoPreco(prazo);
  const base = Number(produto.precoAVista ?? produto.preco ?? 0);
  const preco = Number(produto[campo]);
  return Number.isFinite(preco) && preco > 0 ? preco : base;
}

function precoEspecialPorPrazo(item = {}, prazo = "") {
  if (!item) return null;
  if (typeof item === "number") return Number.isFinite(item) && item > 0 ? item : null;
  const campo = campoPrazoPreco(prazo);
  const direto = Number(item[campo]);
  if (Number.isFinite(direto) && direto > 0) return direto;
  const porPrazo = item.precosPorPrazo || {};
  const doMapa = Number(porPrazo[prazo] ?? porPrazo[campo]);
  if (Number.isFinite(doMapa) && doMapa > 0) return doMapa;
  const unico = Number(item.preco);
  return Number.isFinite(unico) && unico > 0 ? unico : null;
}

async function buscarPrecoUnitarioPedido(clienteNome, produtoNome, prazoPagamento, userId = "") {
  const clienteChave = normalizarPrecoPrazo(clienteNome);
  const produtoChave = normalizarPrecoPrazo(produtoNome);
  let produtoBase = null;

  const produtosSnap = await db.collection("produtos").get();
  produtosSnap.forEach(doc => {
    const produto = doc.data() || {};
    if (!produtoBase && normalizarPrecoPrazo(produto.nome) === produtoChave) produtoBase = produto;
  });

  try {
    let query = db.collection("precos_clientes");
    if (PERFIL === "representante" && userId) query = query.where("userId", "==", userId);
    const snap = await query.get();
    let especial = null;
    snap.forEach(doc => {
      if (especial != null) return;
      const item = doc.data() || {};
      const mesmoCliente = normalizarPrecoPrazo(item.clienteNome) === clienteChave;
      const mesmoProduto = normalizarPrecoPrazo(item.produtoNome) === produtoChave;
      if (mesmoCliente && mesmoProduto) especial = precoEspecialPorPrazo(item, prazoPagamento);
    });
    if (especial != null) return { preco: especial, origem: "cliente" };
  } catch (e) {
    console.warn("Nao foi possivel consultar preco especial do cliente.", e);
  }

  return { preco: precoProdutoPorPrazo(produtoBase || {}, prazoPagamento), origem: "produto" };
}

async function enriquecerPedidoComValoresPorPrazo(pedido = {}) {
  if (!Array.isArray(pedido.itens) || !pedido.itens.length) return pedido;
  const itens = await Promise.all(pedido.itens.map(async item => {
    const resultado = await buscarPrecoUnitarioPedido(
      pedido.clienteNome,
      item.produtoNome,
      pedido.prazoPagamento,
      pedido.userId
    );
    const quantidade = Number(item.quantidade || 0);
    return {
      ...item,
      precoUnitario: resultado.preco,
      valorTotal: resultado.preco * quantidade,
      precoOrigem: resultado.origem,
      prazoPagamento: pedido.prazoPagamento || ""
    };
  }));
  return {
    ...pedido,
    itens,
    valorTotal: itens.reduce((total, item) => total + Number(item.valorTotal || 0), 0)
  };
}

function removerPrazo15Dias() {
  document.querySelectorAll("#p-prazo option, #edit-prazo option").forEach(option => {
    const texto = normalizarPrecoPrazo(option.value || option.textContent);
    if (texto.includes("15")) option.remove();
  });
}

function esconderBotaoNovoAgendamentoResumo() {
  document.querySelectorAll("button").forEach(botao => {
    if (normalizarPrecoPrazo(botao.textContent).includes("novo agendamento")) botao.remove();
  });
}

function instalarCalculoPedidoPorPrazo() {
  if (window.__precosPrazoPedidosInstalado) return;
  window.__precosPrazoPedidosInstalado = true;
  window.buscarPrecoUnitarioPedido = buscarPrecoUnitarioPedido;
  window.obterPrecoProdutoPorPrazo = precoProdutoPorPrazo;
  window.obterPrecoEspecialPorPrazo = precoEspecialPorPrazo;

  if (db?.collection) {
    const collectionOriginal = db.collection.bind(db);
    db.collection = function(nomeColecao) {
      const ref = collectionOriginal(nomeColecao);
      if (nomeColecao === "pedidos" && ref?.add && !ref.__addComValoresPrazo) {
        const addOriginal = ref.add.bind(ref);
        ref.add = async payload => addOriginal(await enriquecerPedidoComValoresPorPrazo(payload));
        ref.__addComValoresPrazo = true;
      }
      return ref;
    };
  }

  const renderPedidosOriginal = window.renderPedidos;
  if (typeof renderPedidosOriginal === "function") {
    window.renderPedidos = function(...args) {
      const retorno = renderPedidosOriginal.apply(this, args);
      setTimeout(removerPrazo15Dias, 0);
      return retorno;
    };
    try { renderPedidos = window.renderPedidos; } catch (_) {}
  }

  new MutationObserver(() => {
    removerPrazo15Dias();
    esconderBotaoNovoAgendamentoResumo();
  }).observe(document.body, { childList: true, subtree: true });
}

function instalarRelatorioComPrecoDoPedido() {
  const original = window.aplicarValoresAgendamentosRelatorio;
  window.aplicarValoresAgendamentosRelatorio = async function(lista, user) {
    if (!Array.isArray(lista) || !lista.length) return 0;
    let total = 0;
    const pedidos = new Map();

    await Promise.all([...new Set(lista.map(item => String(item.pedidoId || "").trim()).filter(Boolean))]
      .map(async pedidoId => {
        try {
          const porCodigo = await db.collection("pedidos").where("codigo", "==", pedidoId).limit(1).get();
          if (!porCodigo.empty) {
            pedidos.set(pedidoId, porCodigo.docs[0].data() || {});
            return;
          }
          const porId = await db.collection("pedidos").doc(pedidoId).get();
          if (porId.exists) pedidos.set(pedidoId, porId.data() || {});
        } catch (_) {}
      }));

    for (const item of lista) {
      const pedido = pedidos.get(String(item.pedidoId || "").trim()) || null;
      const prazo = item.prazoPagamento || pedido?.prazoPagamento || "";
      const produtoChave = normalizarPrecoPrazo(item.produtoNome);
      const itemPedido = Array.isArray(pedido?.itens)
        ? pedido.itens.find(produto => normalizarPrecoPrazo(produto.produtoNome || produto.produto) === produtoChave)
        : null;
      const valorItemPedido = Number(itemPedido?.valorTotal);
      const quantidadeItemPedido = Number(itemPedido?.quantidade || item.quantidade || 0);
      let precoUnitario = Number.isFinite(valorItemPedido) && quantidadeItemPedido > 0
        ? valorItemPedido / quantidadeItemPedido
        : Number(itemPedido?.precoUnitario);
      let origem = Number.isFinite(precoUnitario) ? (itemPedido?.precoOrigem || "pedido") : "";

      const resultadoAtual = await buscarPrecoUnitarioPedido(
        item.clienteNome,
        item.produtoNome,
        prazo,
        item.userId || user?.uid || ""
      );

      // Preço especial do cliente sempre prevalece sobre o valor normal salvo.
      if (resultadoAtual.origem === "cliente" || !Number.isFinite(precoUnitario)) {
        precoUnitario = resultadoAtual.preco;
        origem = resultadoAtual.origem;
      }

      item.prazoPagamento = prazo;
      item.precoUnitario = precoUnitario;
      item.valorVenda = precoUnitario * Number(item.quantidade || 0);
      item.precoOrigem = origem;
      total += item.valorVenda;
    }

    if (!Number.isFinite(total) && typeof original === "function") return original(lista, user);
    return total;
  };
  try { aplicarValoresAgendamentosRelatorio = window.aplicarValoresAgendamentosRelatorio; } catch (_) {}
}

function formatarPrecoPrazoProduto(valor) {
  if (typeof formatPrecoProduto === "function") return formatPrecoProduto(valor);
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function instalarProdutosPorPrazo() {
  const renderProdutosNovo = function() {
    if (PERFIL !== "admin") {
      pageContent.innerHTML = `<p class="text-red-600 font-semibold">Apenas administradores podem gerenciar produtos.</p>`;
      return;
    }

    pageContent.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div><h2 class="text-xl font-bold">Produtos</h2><p class="text-sm text-gray-500">Cadastre os precos por prazo de pagamento.</p></div>
        <button id="btn-novo-produto" class="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto">+ Criar Produto</button>
      </div>
      <div class="bg-white p-3 rounded shadow mb-4"><input id="busca-produtos" type="search" class="border p-2 rounded w-full" placeholder="Buscar por produto ou categoria"></div>
      <div id="produtos-organizados" class="space-y-4"></div>
      <div id="modal-produto" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-2 sm:p-4 overflow-y-auto">
        <div class="bg-white w-full max-w-2xl mx-auto my-8 rounded-xl shadow-lg overflow-hidden">
          <div class="px-5 py-4 border-b flex items-center justify-between"><div><h3 id="modal-produto-titulo" class="text-lg font-bold">Criar Produto</h3><p class="text-xs text-gray-500">Informe os valores conforme o prazo.</p></div><button id="fechar-modal-produto" type="button" class="text-gray-500 text-2xl leading-none">&times;</button></div>
          <form id="modal-produto-form" class="p-5 space-y-4">
            <label class="block"><span class="block text-sm font-semibold mb-1">Nome do produto *</span><input id="modal-produto-nome" class="border p-2 rounded w-full" required placeholder="Ex.: Telha Canal"></label>
            <label class="block"><span class="block text-sm font-semibold mb-1">Categoria</span><input id="modal-produto-categoria" class="border p-2 rounded w-full" placeholder="Ex.: Telhas"></label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${PRAZOS_PRECO_PEDIDO.map(item => `<label class="block"><span class="block text-sm font-semibold mb-1">${item.rotulo}</span><input id="modal-produto-${item.campo}" type="text" inputmode="decimal" class="border p-2 rounded w-full" placeholder="Ex.: 0,7100"></label>`).join("")}</div>
            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2"><button id="cancelar-modal-produto" type="button" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button><button id="salvar-modal-produto" type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar Produto</button></div>
          </form>
        </div>
      </div>`;

    const modal = document.getElementById("modal-produto");
    const form = document.getElementById("modal-produto-form");
    const lista = document.getElementById("produtos-organizados");
    const busca = document.getElementById("busca-produtos");
    let produtoEmEdicao = null;
    let produtosAtuais = [];
    const escapar = valor => typeof escapeHtmlRelatorio === "function" ? escapeHtmlRelatorio(valor) : String(valor || "");
    const campo = nome => document.getElementById(`modal-produto-${nome}`);

    function fecharModal() { modal.classList.add("hidden"); form.reset(); produtoEmEdicao = null; }
    function abrirModal(produto = null) {
      produtoEmEdicao = produto?.id || null;
      document.getElementById("modal-produto-titulo").textContent = produto ? "Editar Produto" : "Criar Produto";
      campo("nome").value = produto?.nome || "";
      campo("categoria").value = produto?.categoria || "";
      PRAZOS_PRECO_PEDIDO.forEach(({ campo: c }) => {
        const valor = Number(produto?.[c] ?? (c === "precoAVista" ? produto?.preco : ""));
        campo(c).value = Number.isFinite(valor) && valor > 0 ? valor.toFixed(4).replace(".", ",") : "";
      });
      modal.classList.remove("hidden");
    }
    function renderizar() {
      const termo = normalizarPrecoPrazo(busca.value);
      const filtrados = produtosAtuais.filter(p => !termo || normalizarPrecoPrazo(`${p.nome || ""} ${p.categoria || ""}`).includes(termo));
      if (!filtrados.length) { lista.innerHTML = `<div class="bg-white p-5 rounded shadow text-gray-500">Nenhum produto encontrado.</div>`; return; }
      lista.innerHTML = filtrados.map(produto => `<article class="bg-white border rounded-lg p-3 mb-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><div class="font-semibold">${escapar(produto.nome || "Sem nome")}</div><div class="text-xs text-gray-500">${escapar(produto.categoria || "Sem categoria")}</div><div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2 text-sm">${PRAZOS_PRECO_PEDIDO.map(item => `<div class="bg-gray-50 border rounded p-2"><div class="text-xs text-gray-500">${item.rotulo}</div><strong>${formatarPrecoPrazoProduto(produto[item.campo] ?? produto.preco)}</strong></div>`).join("")}</div></div><div class="flex gap-2"><button type="button" data-acao="editar" data-id="${produto.id}" class="bg-yellow-500 text-white px-3 py-1 rounded">Editar</button><button type="button" data-acao="excluir" data-id="${produto.id}" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button></div></article>`).join("");
    }

    document.getElementById("btn-novo-produto").onclick = () => abrirModal();
    document.getElementById("fechar-modal-produto").onclick = fecharModal;
    document.getElementById("cancelar-modal-produto").onclick = fecharModal;
    busca.oninput = renderizar;
    form.onsubmit = async e => {
      e.preventDefault();
      const nome = campo("nome").value.trim();
      const categoria = campo("categoria").value.trim();
      const precoAVista = numeroPrecoPrazo(campo("precoAVista").value, 0);
      const payload = {
        nome,
        categoria,
        preco: precoAVista,
        precoAVista,
        preco10Dias: numeroPrecoPrazo(campo("preco10Dias").value, precoAVista),
        preco30Dias: numeroPrecoPrazo(campo("preco30Dias").value, precoAVista),
        preco3060Dias: numeroPrecoPrazo(campo("preco3060Dias").value, precoAVista),
        editadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!nome) { alert("Informe o nome do produto."); return; }
      if (produtoEmEdicao) await db.collection("produtos").doc(produtoEmEdicao).update(payload);
      else { const user = await waitForAuth(); await db.collection("produtos").add({ ...payload, userId: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
      fecharModal();
    };
    lista.onclick = async e => {
      const botao = e.target.closest("button[data-acao]");
      if (!botao) return;
      const produto = produtosAtuais.find(p => p.id === botao.dataset.id);
      if (!produto) return;
      if (botao.dataset.acao === "editar") abrirModal(produto);
      if (botao.dataset.acao === "excluir" && confirm(`Excluir o produto "${produto.nome}"?`)) await db.collection("produtos").doc(produto.id).delete();
    };
    db.collection("produtos").onSnapshot(snap => { produtosAtuais = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })); renderizar(); });
  };

  window.renderProdutos = renderProdutosNovo;
  try { renderProdutos = renderProdutosNovo; } catch (_) {}
}

instalarCalculoPedidoPorPrazo();
instalarRelatorioComPrecoDoPedido();
instalarProdutosPorPrazo();
removerPrazo15Dias();
esconderBotaoNovoAgendamentoResumo();
