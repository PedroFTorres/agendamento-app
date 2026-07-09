(function () {
  function escapar(valor) {
    if (typeof escapeHtmlRelatorio === "function") return escapeHtmlRelatorio(valor);
    return String(valor || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function obterDataPedido(pedido = {}) {
    const dataDireta = String(pedido.data || pedido.dataPedido || pedido.dataEntrega || "").slice(0, 10);
    if (dataDireta) return dataDireta;

    const criadoEm = pedido.createdAt;
    if (criadoEm?.toDate) return criadoEm.toDate().toISOString().slice(0, 10);
    if (criadoEm instanceof Date) return criadoEm.toISOString().slice(0, 10);
    if (typeof criadoEm === "string") return criadoEm.slice(0, 10);

    return "";
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
    if (document.getElementById("ranking-clientes-cancelamentos")) return;

    const rankingAtual = document.getElementById("ranking-clientes-lista");
    const cardRanking = rankingAtual?.closest(".bg-white");
    if (!cardRanking) return;

    cardRanking.insertAdjacentHTML("afterend", `
      <div class="bg-white p-3 sm:p-4 rounded shadow mt-4">
        <h3 class="text-lg font-semibold mb-1">Clientes que Mais Cancelam</h3>
        <p class="text-sm text-gray-500 mb-3">Ranking por quantidade de pedidos cancelados no período, com os motivos informados.</p>
        <div id="ranking-clientes-cancelamentos" class="space-y-2"></div>
      </div>
    `);
  }

  async function carregarPedidosCancelados(user, clienteSel) {
    if (PERFIL === "representante") {
      const pedidosPorId = new Map();
      const pedidosProprios = await db.collection("pedidos")
        .where("status", "==", "cancelado")
        .where("userId", "==", user.uid)
        .get();

      pedidosProprios.docs.forEach(doc => pedidosPorId.set(doc.id, doc));

      const clientes = clienteSel
        ? [clienteSel]
        : Array.from(document.querySelectorAll("#rel-cliente option"))
            .map(opt => opt.value)
            .filter(Boolean);

      for (let inicio = 0; inicio < clientes.length; inicio += 10) {
        const lote = clientes.slice(inicio, inicio + 10);
        if (!lote.length) continue;

        const snap = await db.collection("pedidos")
          .where("status", "==", "cancelado")
          .where("clienteNome", "in", lote)
          .get();

        snap.docs.forEach(doc => pedidosPorId.set(doc.id, doc));
      }

      return Array.from(pedidosPorId.values());
    }

    const snap = await db.collection("pedidos")
      .where("status", "==", "cancelado")
      .get();
    return snap.docs;
  }

  async function renderRankingCancelamentos() {
    garantirBlocoCancelamentos();

    const rankingEl = document.getElementById("ranking-clientes-cancelamentos");
    if (!rankingEl) return;

    rankingEl.innerHTML = `<p class="text-gray-500">Carregando cancelamentos...</p>`;

    try {
      const user = await waitForAuth();
      const start = document.getElementById("rel-start")?.value || "";
      const end = document.getElementById("rel-end")?.value || "";
      const clienteSel = document.getElementById("rel-cliente")?.value || "";
      const produtoSel = document.getElementById("rel-produto")?.value || "";
      const representanteSel = document.getElementById("rel-representante")?.value || "";
      const docs = await carregarPedidosCancelados(user, clienteSel);
      const porCliente = {};

      docs.forEach(doc => {
        const pedido = doc.data() || {};
        const data = obterDataPedido(pedido);
        if ((start || end) && !data) return;
        if (start && data < start) return;
        if (end && data > end) return;
        if (clienteSel && String(pedido.clienteNome || "") !== clienteSel) return;

        if (produtoSel) {
          const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
          const temProduto = String(pedido.produtoNome || "") === produtoSel ||
            itens.some(item => String(item.produtoNome || "") === produtoSel);
          if (!temProduto) return;
        }

        if (PERFIL === "admin" && representanteSel && String(pedido.representanteNome || "") !== representanteSel) return;

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
    } catch (e) {
      console.error("Erro ao carregar ranking de cancelamentos:", e);
      rankingEl.innerHTML = `<p class="text-red-600">Não foi possível carregar o ranking de cancelamentos.</p>`;
    }
  }

  function instalarRankingCancelamentos() {
    const renderRelatoriosOriginal = window.renderRelatorios || (typeof renderRelatorios === "function" ? renderRelatorios : null);
    const gerarRelatorioOriginal = window.gerarRelatorio || (typeof gerarRelatorio === "function" ? gerarRelatorio : null);

    if (typeof renderRelatoriosOriginal === "function") {
      window.renderRelatorios = function (...args) {
        const retorno = renderRelatoriosOriginal.apply(this, args);
        garantirBlocoCancelamentos();
        return retorno;
      };
      try { renderRelatorios = window.renderRelatorios; } catch (_) {}
    }

    if (typeof gerarRelatorioOriginal === "function") {
      window.gerarRelatorio = async function (...args) {
        const retorno = await gerarRelatorioOriginal.apply(this, args);
        await renderRankingCancelamentos();
        return retorno;
      };
      try { gerarRelatorio = window.gerarRelatorio; } catch (_) {}
    }
  }

  instalarRankingCancelamentos();
})();
