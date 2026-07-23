(() => {
  let dadosRelatorioComissao = [];

  const escapar = valor => String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const moeda = valor => Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const quantidade = valor => Math.floor(Number(valor || 0)).toLocaleString("pt-BR");

  function dataPedido(pedido) {
    if (pedido.createdAt?.toDate) return pedido.createdAt.toDate();
    if (pedido.createdAt?.seconds) return new Date(pedido.createdAt.seconds * 1000);
    if (pedido.data) return new Date(String(pedido.data) + "T00:00:00");
    return null;
  }

  function valorPedidoSalvo(pedido) {
    const total = Number(pedido.valorTotal);
    if (Number.isFinite(total) && total >= 0) return total;
    if (!Array.isArray(pedido.itens)) return 0;
    return pedido.itens.reduce((soma, item) => {
      const valorItem = Number(item.valorTotal);
      if (Number.isFinite(valorItem)) return soma + valorItem;
      const preco = Number(item.precoUnitario);
      return soma + (Number.isFinite(preco) ? preco * Number(item.quantidade || 0) : 0);
    }, 0);
  }

  async function obterValorPedido(pedido) {
    const salvo = valorPedidoSalvo(pedido);
    if (typeof buscarPrecoUnitarioPedido !== "function") return salvo;

    const itensPedido = Array.isArray(pedido.itens) && pedido.itens.length
      ? pedido.itens
      : [{
          produtoNome: pedido.produtoNome,
          quantidade: pedido.quantidade,
          precoUnitario: pedido.precoUnitario,
          valorTotal: pedido.valorTotal
        }];

    try {
      let total = 0;
      for (const item of itensPedido) {
        const qtd = Number(item.quantidade || 0);
        const valorItemSalvo = Number(item.valorTotal);
        const precoSalvo = Number.isFinite(valorItemSalvo) && qtd > 0
          ? valorItemSalvo / qtd
          : Number(item.precoUnitario);
        const resultadoAtual = await buscarPrecoUnitarioPedido(
          pedido.clienteNome,
          item.produtoNome || item.produto,
          pedido.prazoPagamento,
          pedido.userId || ""
        );

        // Preço por cliente tem prioridade; sem preço especial, preserva o valor do pedido.
        const precoAplicado = resultadoAtual.origem === "cliente"
          ? resultadoAtual.preco
          : (Number.isFinite(precoSalvo) ? precoSalvo : resultadoAtual.preco);
        total += Number(precoAplicado || 0) * qtd;
      }
      return total;
    } catch (e) {
      console.warn("Não foi possível calcular o valor do pedido.", pedido.codigo, e);
      return salvo;
    }
  }

  function csvCampo(valor) {
    return '"' + String(valor ?? "").replace(/"/g, '""') + '"';
  }

  function exportarCsvComissoes() {
    const mes = document.getElementById("comissao-mes")?.value || "";
    const percentual = Number(document.getElementById("comissao-percentual")?.value || 0);
    const linhas = [["Representante", "Pedido", "Data", "Cliente", "Produtos", "Status", "Quantidade", "Valor", "Comissão"]];

    dadosRelatorioComissao.forEach(grupo => {
      grupo.pedidos.forEach(pedido => {
        linhas.push([
          grupo.nome,
          pedido.codigo || pedido.id,
          pedido.dataFormatada,
          pedido.clienteNome || "",
          pedido.produtosResumo || pedido.produtoNome || "",
          pedido.status || "",
          pedido.quantidade || 0,
          pedido.valorVenda.toFixed(2).replace(".", ","),
          (pedido.valorVenda * percentual / 100).toFixed(2).replace(".", ",")
        ]);
      });
    });

    const csv = "\uFEFF" + linhas.map(linha => linha.map(csvCampo).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-comissoes-${mes || "periodo"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function gerarRelatorioComissoes() {
    const user = await waitForAuth();
    const lista = document.getElementById("comissao-lista");
    const resumo = document.getElementById("comissao-resumo");
    const mes = document.getElementById("comissao-mes")?.value;
    const status = document.getElementById("comissao-status")?.value || "aprovado";
    const representanteSelecionado = document.getElementById("comissao-representante")?.value || "";
    const percentual = Math.max(0, Number(document.getElementById("comissao-percentual")?.value || 0));

    if (!mes) return;
    lista.innerHTML = '<div class="bg-white p-5 rounded shadow text-gray-500">Carregando vendas...</div>';
    resumo.innerHTML = "";

    const [ano, numeroMes] = mes.split("-").map(Number);
    const snap = await db.collection("pedidos").orderBy("createdAt", "desc").get();
    const selecionados = [];
    const representantesDisponiveis = new Set();

    snap.forEach(doc => {
      const pedido = { id: doc.id, ...(doc.data() || {}) };

      if (PERFIL === "representante") {
        const criadoPeloRepresentante = pedido.criadoPor
          ? pedido.criadoPor === user.uid
          : pedido.criadoPorAdmin !== true && pedido.userId === user.uid;
        if (!criadoPeloRepresentante) return;
      }

      const data = dataPedido(pedido);
      if (!data || data.getFullYear() !== ano || data.getMonth() !== numeroMes - 1) return;
      if (status !== "todos" && String(pedido.status || "").toLowerCase() !== status) return;
      const representante = String(pedido.representanteNome || "Administrativo").trim() || "Administrativo";
      representantesDisponiveis.add(representante);
      if (representanteSelecionado && representante !== representanteSelecionado) return;
      selecionados.push({ ...pedido, data });
    });

    const selectRepresentante = document.getElementById("comissao-representante");
    if (selectRepresentante) {
      selectRepresentante.innerHTML = '<option value="">Todos os representantes</option>';
      [...representantesDisponiveis]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach(nome => {
          const option = document.createElement("option");
          option.value = nome;
          option.textContent = nome;
          selectRepresentante.appendChild(option);
        });
      selectRepresentante.value = representanteSelecionado;
    }

    const calculados = await Promise.all(selecionados.map(async pedido => ({
      ...pedido,
      valorVenda: await obterValorPedido(pedido),
      dataFormatada: pedido.data.toLocaleDateString("pt-BR")
    })));

    const grupos = new Map();
    calculados.forEach(pedido => {
      const representante = String(pedido.representanteNome || "Administrativo").trim() || "Administrativo";
      if (!grupos.has(representante)) grupos.set(representante, []);
      grupos.get(representante).push(pedido);
    });

    dadosRelatorioComissao = [...grupos.entries()]
      .map(([nome, pedidos]) => ({
        nome,
        pedidos,
        total: pedidos.reduce((soma, pedido) => soma + pedido.valorVenda, 0),
        quantidade: pedidos.reduce((soma, pedido) => soma + Number(pedido.quantidade || 0), 0)
      }))
      .sort((a, b) => b.total - a.total);

    const totalVendas = dadosRelatorioComissao.reduce((soma, grupo) => soma + grupo.total, 0);
    const totalPedidos = dadosRelatorioComissao.reduce((soma, grupo) => soma + grupo.pedidos.length, 0);
    const totalComissao = totalVendas * percentual / 100;

    resumo.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div class="bg-white border rounded-lg p-4"><div class="text-xs text-gray-500">Pedidos</div><div class="text-2xl font-bold">${totalPedidos}</div></div>
        <div class="bg-white border rounded-lg p-4"><div class="text-xs text-gray-500">Total vendido</div><div class="text-2xl font-bold text-blue-800">${moeda(totalVendas)}</div></div>
        <div class="bg-white border rounded-lg p-4"><div class="text-xs text-gray-500">Comissão estimada</div><div class="text-2xl font-bold text-green-700">${moeda(totalComissao)}</div></div>
      </div>
    `;

    if (!dadosRelatorioComissao.length) {
      lista.innerHTML = '<div class="bg-white p-5 rounded shadow text-gray-500">Nenhum pedido encontrado no período.</div>';
      return;
    }

    lista.innerHTML = dadosRelatorioComissao.map(grupo => {
      const comissao = grupo.total * percentual / 100;
      const pedidos = grupo.pedidos
        .sort((a, b) => b.data - a.data)
        .map(pedido => `
          <tr class="border-t">
            <td class="p-2 whitespace-nowrap">${escapar(pedido.dataFormatada)}</td>
            <td class="p-2 font-medium">${escapar(pedido.codigo || pedido.id)}</td>
            <td class="p-2">${escapar(pedido.clienteNome || "-")}</td>
            <td class="p-2">${escapar(pedido.produtosResumo || pedido.produtoNome || "-")}</td>
            <td class="p-2 text-right whitespace-nowrap">${quantidade(pedido.quantidade)}</td>
            <td class="p-2 text-right font-semibold whitespace-nowrap">${moeda(pedido.valorVenda)}</td>
          </tr>
        `).join("");

      return `
        <section class="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div class="p-4 bg-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold">${escapar(grupo.nome)}</h3>
              <p class="text-sm text-gray-500">${grupo.pedidos.length} pedido(s) • ${quantidade(grupo.quantidade)} unidades</p>
            </div>
            <div class="grid grid-cols-2 gap-4 text-right">
              <div><div class="text-xs text-gray-500">Vendas</div><strong class="text-blue-800">${moeda(grupo.total)}</strong></div>
              <div><div class="text-xs text-gray-500">Comissão (${percentual.toLocaleString("pt-BR")}%)</div><strong class="text-green-700">${moeda(comissao)}</strong></div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left bg-white"><th class="p-2">Data</th><th class="p-2">Pedido</th><th class="p-2">Cliente</th><th class="p-2">Produtos</th><th class="p-2 text-right">Qtd.</th><th class="p-2 text-right">Valor</th></tr></thead>
              <tbody>${pedidos}</tbody>
            </table>
          </div>
        </section>
      `;
    }).join("");
  }

  window.renderRelatorioComissoes = function renderRelatorioComissoes() {
    if (!["admin", "representante"].includes(PERFIL)) {
      renderDashboard();
      return;
    }

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    pageContent.innerHTML = `
      <div class="mb-4">
        <h2 class="text-xl font-bold">Vendas e Comissões</h2>
        <p class="text-sm text-gray-500">Pedidos agrupados por representante para conferência mensal.</p>
      </div>
      <div class="bg-white p-4 rounded shadow mb-4">
        <div class="grid grid-cols-1 md:grid-cols-${PERFIL === "admin" ? "5" : "4"} gap-3 items-end">
          <label><span class="block text-sm font-semibold mb-1">Mês</span><input id="comissao-mes" type="month" value="${mesAtual}" class="border p-2 rounded w-full"></label>
          <label><span class="block text-sm font-semibold mb-1">Pedidos</span><select id="comissao-status" class="border p-2 rounded w-full"><option value="aprovado">Aprovados</option><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="cancelado">Cancelados</option></select></label>
          ${PERFIL === "admin" ? '<label><span class="block text-sm font-semibold mb-1">Representante</span><select id="comissao-representante" class="border p-2 rounded w-full"><option value="">Todos os representantes</option></select></label>' : ""}
          <label><span class="block text-sm font-semibold mb-1">Comissão (%)</span><input id="comissao-percentual" type="number" min="0" step="0.01" value="0" class="border p-2 rounded w-full"></label>
          <button id="comissao-atualizar" class="bg-blue-600 text-white px-4 py-2 rounded w-full">Atualizar relatório</button>
        </div>
        <button id="comissao-csv" class="mt-3 border border-green-700 text-green-700 px-4 py-2 rounded w-full md:w-auto">Exportar CSV</button>
      </div>
      <div id="comissao-resumo"></div>
      <div id="comissao-lista" class="space-y-4"></div>
    `;

    document.getElementById("comissao-atualizar").onclick = gerarRelatorioComissoes;
    document.getElementById("comissao-csv").onclick = exportarCsvComissoes;
    document.getElementById("comissao-percentual").onchange = gerarRelatorioComissoes;
    const filtroRepresentante = document.getElementById("comissao-representante");
    if (filtroRepresentante) filtroRepresentante.onchange = gerarRelatorioComissoes;
    gerarRelatorioComissoes().catch(e => {
      console.error(e);
      document.getElementById("comissao-lista").innerHTML = '<div class="bg-white p-5 rounded shadow text-red-600">Não foi possível gerar o relatório.</div>';
    });
  };

})();
