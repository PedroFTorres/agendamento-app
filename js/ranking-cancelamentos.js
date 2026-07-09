(function () {
  let renderizando = false;
  let ultimoFiltro = "";

  function escapar(valor) {
    if (typeof escapeHtmlRelatorio === "function") return escapeHtmlRelatorio(valor);
    return String(valor || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function dataParaISO(valor) {
    if (!valor) return "";
    if (valor?.toDate) return valor.toDate().toISOString().slice(0, 10);
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    if (typeof valor === "string") return valor.slice(0, 10);
    return "";
  }

  function obterDataReferencia(pedido = {}) {
    return dataParaISO(
      pedido.dataCancelamento ||
      pedido.canceladoEm ||
      pedido.canceladoAt ||
      pedido.updatedAt ||
      pedido.editadoEm ||
      pedido.createdAt ||
      pedido.data ||
      pedido.dataPedido ||
      pedido.dataEntrega
    );
  }

  function obterMotivo(pedido = {}) {
    return String(
      pedido.motivoCancelamento ||
      pedido.motivo ||
      pedido.observacaoCancelamento ||
      pedido.cancelamentoMotivo ||
      "Motivo não informado"
    ).trim() || "Motivo não informado";
  }

  function ativarAbaRanking(tipo) {
    const normalPanel = document.getElementById("ranking-clientes-normal-panel");
    const cancelPanel = document.getElementById("ranking-clientes-cancelamentos-panel");
    const btnNormal = document.getElementById("tab-ranking-clientes-normal");
    const btnCancel = document.getElementById("tab-ranking-clientes-cancelamentos");
    if (!normalPanel || !cancelPanel || !btnNormal || !btnCancel) return;

    const cancelamentos = tipo === "cancelamentos";
    normalPanel.classList.toggle("hidden", cancelamentos);
    cancelPanel.classList.toggle("hidden", !cancelamentos);

    btnNormal.className = cancelamentos
      ? "px-3 py-2 rounded border text-sm font-semibold text-gray-600 bg-white"
      : "px-3 py-2 rounded border text-sm font-semibold text-white bg-blue-600";
    btnCancel.className = cancelamentos
      ? "px-3 py-2 rounded border text-sm font-semibold text-white bg-red-600"
      : "px-3 py-2 rounded border text-sm font-semibold text-gray-600 bg-white";

    if (cancelamentos) renderRankingCancelamentos(true);
  }

  function garantirAbasRanking() {
    if (document.getElementById("ranking-clientes-cancelamentos")) return true;

    const rankingAtual = document.getElementById("ranking-clientes-lista");
    const cardRanking = rankingAtual?.closest(".bg-white");
    if (!cardRanking) return false;

    const normalPanel = document.createElement("div");
    normalPanel.id = "ranking-clientes-normal-panel";
    normalPanel.className = "space-y-0";

    while (cardRanking.firstChild) {
      normalPanel.appendChild(cardRanking.firstChild);
    }

    const abas = document.createElement("div");
    abas.id = "ranking-clientes-tabs";
    abas.className = "flex flex-col sm:flex-row gap-2 mb-3";
    abas.innerHTML = `
      <button id="tab-ranking-clientes-normal" type="button" class="px-3 py-2 rounded border text-sm font-semibold text-white bg-blue-600">
        Ranking de Clientes
      </button>
      <button id="tab-ranking-clientes-cancelamentos" type="button" class="px-3 py-2 rounded border text-sm font-semibold text-gray-600 bg-white">
        Clientes que Mais Cancelam
      </button>
    `;

    const cancelPanel = document.createElement("div");
    cancelPanel.id = "ranking-clientes-cancelamentos-panel";
    cancelPanel.className = "hidden";
    cancelPanel.innerHTML = `
      <h3 class="text-lg font-semibold mb-1">Clientes que Mais Cancelam</h3>
      <p class="text-sm text-gray-500 mb-3">Ranking por pedidos cancelados no período selecionado, com os motivos informados.</p>
      <div id="ranking-clientes-cancelamentos" class="space-y-2"></div>
    `;

    cardRanking.appendChild(abas);
    cardRanking.appendChild(normalPanel);
    cardRanking.appendChild(cancelPanel);

    document.getElementById("tab-ranking-clientes-normal")?.addEventListener("click", () => ativarAbaRanking("normal"));
    document.getElementById("tab-ranking-clientes-cancelamentos")?.addEventListener("click", () => ativarAbaRanking("cancelamentos"));
    return true;
  }

  function filtrosAtuais() {
    return {
      start: document.getElementById("rel-start")?.value || "",
      end: document.getElementById("rel-end")?.value || "",
      cliente: document.getElementById("rel-cliente")?.value || "",
      produto: document.getElementById("rel-produto")?.value || "",
      representante: document.getElementById("rel-representante")?.value || ""
    };
  }

  function pedidoCancelado(pedido = {}) {
    const status = String(pedido.status || "").trim().toLowerCase();
    return status === "cancelado" || status === "cancelada" || status.includes("cancel");
  }

  function pedidoPassaFiltros(pedido, filtros) {
    if (!pedidoCancelado(pedido)) return false;

    const data = obterDataReferencia(pedido);
    if ((filtros.start || filtros.end) && !data) return false;
    if (filtros.start && data < filtros.start) return false;
    if (filtros.end && data > filtros.end) return false;
    if (filtros.cliente && String(pedido.clienteNome || "") !== filtros.cliente) return false;

    if (filtros.produto) {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      const temProduto = String(pedido.produtoNome || "") === filtros.produto ||
        itens.some(item => String(item.produtoNome || "") === filtros.produto);
      if (!temProduto) return false;
    }

    if (PERFIL === "admin" && filtros.representante && String(pedido.representanteNome || "") !== filtros.representante) return false;
    return true;
  }

  async function carregarPedidos() {
    const snap = await db.collection("pedidos").get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  function renderizarLista(rankingEl, pedidos, filtros) {
    const porCliente = {};

    pedidos
      .filter(pedido => pedidoPassaFiltros(pedido, filtros))
      .forEach(pedido => {
        const cliente = pedido.clienteNome || "Não informado";
        const motivo = obterMotivo(pedido);
        porCliente[cliente] = porCliente[cliente] || { total: 0, motivos: {} };
        porCliente[cliente].total += 1;
        porCliente[cliente].motivos[motivo] = (porCliente[cliente].motivos[motivo] || 0) + 1;
      });

    const ranking = Object.entries(porCliente)
      .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "pt-BR"));

    if (!ranking.length) {
      rankingEl.innerHTML = `<p class="text-gray-500">Nenhum pedido cancelado neste período.</p>`;
      return;
    }

    rankingEl.innerHTML = ranking.map(([cliente, dados], index) => {
      const motivos = Object.entries(dados.motivos)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
        .map(([motivo, total]) => `
          <li class="text-sm text-gray-600">
            <span class="font-medium">${escapar(motivo)}</span>
            <span class="text-gray-500">(${total}x)</span>
          </li>
        `).join("");

      return `
        <div class="border border-red-100 bg-red-50 p-3 rounded-lg">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-red-700">#${index + 1}</span>
              <span class="font-semibold break-words">${escapar(cliente)}</span>
            </div>
            <strong class="text-red-700 whitespace-nowrap">${dados.total} cancelamento(s)</strong>
          </div>
          <ul class="mt-2 list-disc list-inside space-y-1">
            ${motivos}
          </ul>
        </div>
      `;
    }).join("");
  }

  async function renderRankingCancelamentos(forcar = false) {
    if (renderizando) return;
    if (!garantirAbasRanking()) return;

    const rankingEl = document.getElementById("ranking-clientes-cancelamentos");
    if (!rankingEl) return;

    const filtros = filtrosAtuais();
    const chaveFiltro = JSON.stringify(filtros);
    if (!forcar && chaveFiltro === ultimoFiltro && rankingEl.dataset.carregado === "1") return;

    renderizando = true;
    ultimoFiltro = chaveFiltro;
    rankingEl.dataset.carregado = "1";
    rankingEl.innerHTML = `<p class="text-gray-500">Carregando cancelamentos...</p>`;

    try {
      await waitForAuth();
      const pedidos = await carregarPedidos();
      renderizarLista(rankingEl, pedidos, filtros);
    } catch (e) {
      console.error("Erro ao carregar ranking de cancelamentos:", e);
      rankingEl.innerHTML = `<p class="text-red-600">Não foi possível carregar o ranking de cancelamentos.</p>`;
    } finally {
      renderizando = false;
    }
  }

  function agendarRender(forcar = false) {
    setTimeout(() => {
      garantirAbasRanking();
      renderRankingCancelamentos(forcar);
    }, 300);
    setTimeout(() => {
      garantirAbasRanking();
      renderRankingCancelamentos(forcar);
    }, 1200);
  }

  document.addEventListener("click", (event) => {
    const alvo = event.target.closest("[data-page], #rel-filtrar, #rel-aplicar-periodo");
    if (!alvo) return;

    const pagina = alvo.getAttribute("data-page");
    if (pagina === "ranking-clientes" || pagina === "relatorios" || alvo.id === "rel-filtrar" || alvo.id === "rel-aplicar-periodo") {
      agendarRender(true);
    }
  }, true);

  document.addEventListener("change", (event) => {
    if (["rel-mes", "rel-start", "rel-end", "rel-cliente", "rel-produto", "rel-representante"].includes(event.target.id)) {
      agendarRender(true);
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (document.getElementById("ranking-clientes-lista")) agendarRender(false);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  agendarRender(false);
})();
