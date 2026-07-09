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

  function obterMotivo(pedido = {}) {
    return String(
      pedido.motivoCancelamento ||
      pedido.motivo ||
      pedido.observacaoCancelamento ||
      pedido.cancelamentoMotivo ||
      "Motivo não informado"
    ).trim() || "Motivo não informado";
  }

  function garantirBlocoCancelamentos() {
    if (document.getElementById("ranking-clientes-cancelamentos")) return true;

    const rankingAtual = document.getElementById("ranking-clientes-lista");
    const cardRanking = rankingAtual?.closest(".bg-white");
    if (!cardRanking) return false;

    cardRanking.insertAdjacentHTML("afterend", `
      <div class="bg-white p-3 sm:p-4 rounded shadow mt-4">
        <h3 class="text-lg font-semibold mb-1">Clientes que Mais Cancelam</h3>
        <p class="text-sm text-gray-500 mb-3">Ranking pelo histórico de pedidos cancelados, com os motivos informados.</p>
        <div id="ranking-clientes-cancelamentos" class="space-y-2"></div>
      </div>
    `);

    return true;
  }

  function filtrosAtuais() {
    return {
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
    if (filtros.cliente && String(pedido.clienteNome || "") !== filtros.cliente) return false;

    if (filtros.produto) {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      const temProduto = String(pedido.produtoNome || "") === filtros.produto ||
        itens.some(item => String(item.produtoNome || "") === filtros.produto);
      if (!temProduto) return false;
    }

    if (PERFIL === "admin" && filtros.representante && String(pedido.representanteNome || "") !== filtros.representante) {
      return false;
    }

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
      rankingEl.innerHTML = `<p class="text-gray-500">Nenhum pedido cancelado encontrado.</p>`;
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
    if (!garantirBlocoCancelamentos()) return;

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
    setTimeout(() => renderRankingCancelamentos(forcar), 300);
    setTimeout(() => renderRankingCancelamentos(forcar), 1200);
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
    if (document.getElementById("ranking-clientes-lista")) {
      agendarRender(false);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  agendarRender(false);
})();
