function normalizarChavePrecoRelatorio(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatMoedaRelatorio(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function aplicarValoresAgendamentosRelatorio(lista, user) {
  const produtosPorNome = new Map();
  const precosPorClienteProduto = new Map();

  try {
    const produtosSnap = await db.collection("produtos").get();
    produtosSnap.forEach(doc => {
      const produto = doc.data() || {};
      const nome = normalizarChavePrecoRelatorio(produto.nome);
      const preco = Number(produto.preco || 0);
      if (nome && Number.isFinite(preco)) produtosPorNome.set(nome, preco);
    });
  } catch (e) {
    console.warn("Nao foi possivel carregar os precos dos produtos.", e);
  }

  try {
    let precosQuery = db.collection("precos_clientes");
    if (PERFIL === "representante") {
      precosQuery = precosQuery.where("userId", "==", user.uid);
    }

    const precosSnap = await precosQuery.get();
    precosSnap.forEach(doc => {
      const item = doc.data() || {};
      const cliente = normalizarChavePrecoRelatorio(item.clienteNome);
      const produto = normalizarChavePrecoRelatorio(item.produtoNome);
      const preco = Number(item.preco || 0);
      if (cliente && produto && Number.isFinite(preco)) {
        precosPorClienteProduto.set(`${cliente}::${produto}`, preco);
      }
    });
  } catch (e) {
    console.warn("Nao foi possivel carregar precos diferenciados por cliente.", e);
  }

  let total = 0;
  for (const item of lista) {
    const cliente = normalizarChavePrecoRelatorio(item.clienteNome);
    const produto = normalizarChavePrecoRelatorio(item.produtoNome);
    const precoDiferenciado = precosPorClienteProduto.get(`${cliente}::${produto}`);
    const precoProduto = produtosPorNome.get(produto);
    let precoUnitario = Number.isFinite(precoDiferenciado)
      ? precoDiferenciado
      : (Number.isFinite(precoProduto) ? precoProduto : 0);
    let origem = Number.isFinite(precoDiferenciado) ? "cliente" : "produto";

    // Consulta novamente o preço atual para refletir cadastros feitos após a aprovação.
    if (typeof buscarPrecoUnitarioPedido === "function") {
      const resultadoAtual = await buscarPrecoUnitarioPedido(
        item.clienteNome,
        item.produtoNome,
        item.prazoPagamento || "",
        item.userId || user?.uid || ""
      );
      precoUnitario = Number(resultadoAtual.preco || 0);
      origem = resultadoAtual.origem;
    }

    const valorVenda = precoUnitario * Number(item.quantidade || 0);
    item.precoUnitario = precoUnitario;
    item.valorVenda = valorVenda;
    item.precoOrigem = origem;
    total += valorVenda;
  }
  return total;
}

function imprimirResumoDiario(dataSelecionada, totalGeral, porProduto, porRep, lista, previsaoFaturamento = 0) {
  const janela = window.open("", "", "width=1000,height=750");
  if (!janela) {
    alert("Permita a abertura de janelas para imprimir o relatorio.");
    return;
  }

  const escapar = (valor) => typeof escapeHtmlRelatorio === "function"
    ? escapeHtmlRelatorio(valor)
    : String(valor || "");
  const formatarData = (data) => {
    const [ano, mes, dia] = String(data || "").split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  };
  const logoUrl = new URL("img/logo.png", window.location.href).href;
  const produtos = Object.entries(porProduto || {}).sort((a, b) => b[1] - a[1]);
  const representantes = Object.entries(porRep || {}).sort((a, b) => b[1] - a[1]);
  const agendamentos = [...(lista || [])].sort((a, b) =>
    String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""), "pt-BR")
  );

  const linhasResumo = (itens) => itens.map(([nome, quantidade]) => `
    <div class="resumo-linha">
      <span>${escapar(nome)}</span>
      <strong>${formatQuantidade(quantidade)}</strong>
    </div>
  `).join("") || `<p class="vazio">Nenhum registro.</p>`;

  const linhasTabela = agendamentos.map((item, indice) => `
    <tr>
      <td>${indice + 1}</td>
      <td>${escapar(item.clienteNome || "-")}</td>
      <td>${escapar(item.produtoNome || "-")}</td>
      <td class="numero">${formatQuantidade(item.quantidade || 0)}</td>
      <td class="numero">${formatMoedaRelatorio(item.valorVenda || 0)}</td>
      <td>${escapar(item.representanteNome || "-")}</td>
      <td>${escapar(item.observacao || "-")}</td>
    </tr>
  `).join("");

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Agendamentos de ${formatarData(dataSelecionada)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 11px; background: #fff; }
          .cabecalho { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #f28c28; padding-bottom: 10px; margin-bottom: 14px; }
          .cabecalho img { width: 54px; height: 54px; object-fit: contain; }
          h1 { margin: 0 0 4px; color: #1f3b64; font-size: 21px; }
          .subtitulo { color: #6b7280; font-size: 12px; }
          .totais { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
          .total { background: #eef4ff; border: 1px solid #c7d7f2; border-radius: 8px; padding: 12px; }
          .total-faturamento { background: #ecfdf5; border-color: #86efac; }
          .total span { display: block; color: #6b7280; margin-bottom: 3px; }
          .total strong { color: #1f3b64; font-size: 22px; }
          .total-faturamento strong { color: #047857; }
          .resumos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
          .card { border: 1px solid #dfe6f1; border-radius: 8px; overflow: hidden; }
          .card h2 { margin: 0; padding: 7px 9px; color: #fff; background: #1f3b64; font-size: 12px; }
          .resumo-linha { display: flex; justify-content: space-between; gap: 10px; padding: 6px 9px; border-bottom: 1px solid #edf0f5; }
          .resumo-linha:last-child { border-bottom: 0; }
          .vazio { padding: 8px; color: #6b7280; }
          h2.tabela-titulo { color: #1f3b64; font-size: 14px; margin: 0 0 7px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          th { background: #1f3b64; color: #fff; text-align: left; padding: 7px 5px; font-size: 9px; }
          td { border-bottom: 1px solid #dfe6f1; padding: 6px 5px; vertical-align: top; overflow-wrap: anywhere; }
          tbody tr:nth-child(even) { background: #f8fafc; }
          th:nth-child(1), td:nth-child(1) { width: 5%; }
          th:nth-child(2), td:nth-child(2) { width: 22%; }
          th:nth-child(3), td:nth-child(3) { width: 17%; }
          th:nth-child(4), td:nth-child(4) { width: 9%; }
          th:nth-child(5), td:nth-child(5) { width: 13%; }
          th:nth-child(6), td:nth-child(6) { width: 16%; }
          th:nth-child(7), td:nth-child(7) { width: 18%; }
          .numero, th.numero { text-align: right; font-weight: bold; }
          .rodape { margin-top: 12px; padding-top: 7px; border-top: 1px solid #dfe6f1; color: #6b7280; font-size: 9px; text-align: right; }
          @media (max-width: 700px) { .resumos, .totais { grid-template-columns: 1fr; } }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <header class="cabecalho">
          <img src="${logoUrl}" alt="Logo">
          <div>
            <h1>Relat&oacute;rio Di&aacute;rio de Agendamentos</h1>
            <div class="subtitulo">Data: ${formatarData(dataSelecionada)}</div>
          </div>
        </header>

        <section class="totais">
          <div class="total">
            <span>Quantidade total agendada</span>
            <strong>${formatQuantidade(totalGeral)}</strong>
          </div>
          <div class="total total-faturamento">
            <span>Previs&atilde;o de faturamento</span>
            <strong>${formatMoedaRelatorio(previsaoFaturamento)}</strong>
          </div>
        </section>

        <section class="resumos">
          <div class="card">
            <h2>Totais por Produto</h2>
            ${linhasResumo(produtos)}
          </div>
          <div class="card">
            <h2>Totais por Representante</h2>
            ${linhasResumo(representantes)}
          </div>
        </section>

        <h2 class="tabela-titulo">Agendamentos do dia</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th class="numero">Qtd.</th>
              <th class="numero">Valor</th>
              <th>Representante</th>
              <th>Observa&ccedil;&atilde;o</th>
            </tr>
          </thead>
          <tbody>${linhasTabela || `<tr><td colspan="7">Nenhum agendamento.</td></tr>`}</tbody>
        </table>

        <footer class="rodape">
          Emitido em ${new Date().toLocaleString("pt-BR")}
        </footer>
      </body>
    </html>
  `);
  janela.onload = () => setTimeout(() => janela.print(), 250);
  janela.document.close();
  janela.focus();
}

async function abrirResumoDoDia(dataSelecionada) {
  const user = await waitForAuth();
  const representanteSomenteConsulta = PERFIL === "representante";

  let query = db.collection("agendamentos").where("data", "==", dataSelecionada);
  if (PERFIL === "representante") query = query.where("userId", "==", user.uid);

  const snap = await query.get();
  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};
  const lista = [];

  snap.forEach(doc => {
    const d = doc.data();
    const qtd = Number(d.quantidade || 0);
    totalGeral += qtd;
    porProduto[d.produtoNome] = (porProduto[d.produtoNome] || 0) + qtd;
    porRep[d.representanteNome || "Sem rep"] = (porRep[d.representanteNome || "Sem rep"] || 0) + qtd;
    lista.push({ id: doc.id, ...d });
  });

  const observacoesPorVinculo = new Map();

  async function buscarObservacaoPedido(agendamento) {
    const chave = agendamento.pedidoId
      ? `pedido:${agendamento.pedidoId}`
      : `agendamento:${agendamento.id}`;

    if (observacoesPorVinculo.has(chave)) return observacoesPorVinculo.get(chave);

    const consulta = (async () => {
      let pedidoDoc = null;

      if (agendamento.pedidoId) {
        const porCodigo = await db.collection("pedidos")
          .where("codigo", "==", agendamento.pedidoId)
          .limit(1)
          .get();

        if (!porCodigo.empty) {
          pedidoDoc = porCodigo.docs[0];
        } else {
          const porId = await db.collection("pedidos").doc(String(agendamento.pedidoId)).get();
          if (porId.exists) pedidoDoc = porId;
        }
      }

      if (!pedidoDoc && agendamento.id) {
        const porListaIds = await db.collection("pedidos")
          .where("agendamentoIds", "array-contains", agendamento.id)
          .limit(1)
          .get();

        if (!porListaIds.empty) pedidoDoc = porListaIds.docs[0];
      }

      if (!pedidoDoc && agendamento.id) {
        const porIdPrincipal = await db.collection("pedidos")
          .where("agendamentoId", "==", agendamento.id)
          .limit(1)
          .get();

        if (!porIdPrincipal.empty) pedidoDoc = porIdPrincipal.docs[0];
      }

      return String(pedidoDoc?.data()?.observacao || "").trim();
    })();

    observacoesPorVinculo.set(chave, consulta);
    return consulta;
  }

  await Promise.all(lista.map(async (agendamento) => {
    if (String(agendamento.observacao || "").trim()) return;

    try {
      const observacaoPedido = await buscarObservacaoPedido(agendamento);
      if (observacaoPedido) agendamento.observacao = observacaoPedido;
    } catch (e) {
      console.warn("Nao foi possivel recuperar a observacao do pedido.", e);
    }
  }));

  const previsaoFaturamento = await aplicarValoresAgendamentosRelatorio(lista, user);

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto";
  modal.innerHTML = `
    <div class="bg-white p-6 rounded w-full max-w-3xl max-h-[90vh] flex flex-col gap-4 overflow-hidden my-6">
      <h3 class="text-lg font-bold">${representanteSomenteConsulta ? "Resumo das suas vendas" : "Resumo do dia"} ${dataSelecionada}</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="bg-blue-50 border border-blue-200 p-4 rounded text-center">
          <div class="text-sm text-gray-600">${representanteSomenteConsulta ? "Total vendido por voce" : "Total Geral"}</div>
          <div class="text-2xl font-bold text-blue-700">${totalGeral.toLocaleString("pt-BR")}</div>
        </div>
        <div class="bg-green-50 border border-green-200 p-4 rounded text-center">
          <div class="text-sm text-gray-600">Previs&atilde;o de faturamento</div>
          <div class="text-2xl font-bold text-green-700">${formatMoedaRelatorio(previsaoFaturamento)}</div>
        </div>
      </div>

      <div class="overflow-y-auto pr-1 space-y-4">
        <div class="grid ${representanteSomenteConsulta ? "grid-cols-1" : "grid-cols-2"} gap-4">
          <div class="bg-gray-50 p-3 rounded">
            <h4 class="font-bold mb-2">Por Produto</h4>
            ${Object.entries(porProduto).map(([prod, qtd]) => `
              <div class="flex justify-between border-b py-1">
                <span>${escapeHtmlRelatorio(prod)}</span>
                <strong>${formatQuantidade(qtd)}</strong>
              </div>
            `).join("")}
          </div>
          ${representanteSomenteConsulta ? "" : `
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold mb-2">Por Representante</h4>
              ${Object.entries(porRep).map(([rep, qtd]) => `
                <div class="flex justify-between border-b py-1">
                  <span>${escapeHtmlRelatorio(rep)}</span>
                  <strong>${formatQuantidade(qtd)}</strong>
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <div>
          <h4 class="font-bold mb-2">Agendamentos:</h4>
          <div class="max-h-72 overflow-y-auto space-y-1 pr-1">
            ${lista.map((item, i) => `
              <div class="py-2 px-2 ${i % 2 === 0 ? "bg-gray-100" : "bg-white"} rounded">
                <div class="font-medium">${escapeHtmlRelatorio(item.clienteNome)}</div>
                <div class="text-sm text-gray-600">
                  ${escapeHtmlRelatorio(item.produtoNome)} &bull; ${formatQuantidade(item.quantidade || 0)}
                </div>
                <div class="text-xs font-semibold text-green-700">
                  Valor: ${formatMoedaRelatorio(item.valorVenda || 0)}
                </div>
                <div class="text-xs text-gray-500">
                  Rep: ${escapeHtmlRelatorio(item.representanteNome || "-")}
                </div>
                ${item.observacao ? `
                  <div class="text-xs font-semibold text-red-600 mt-1">
                    Obs: ${escapeHtmlRelatorio(item.observacao)}
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="flex ${representanteSomenteConsulta ? "justify-end" : "justify-between"} mt-2">
        ${representanteSomenteConsulta ? "" : `
          <button id="novo" class="bg-green-600 text-white px-3 py-1 rounded">+ Novo Agendamento</button>
        `}
        <div class="space-x-2">
          ${representanteSomenteConsulta ? "" : `
            <button id="imprimir" class="bg-blue-600 text-white px-3 py-1 rounded">Imprimir</button>
          `}
          <button id="fechar" class="bg-gray-400 text-white px-3 py-1 rounded">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#fechar").onclick = () => modal.remove();

  if (!representanteSomenteConsulta) {
    modal.querySelector("#novo").onclick = () => {
      modal.remove();
      abrirModalAgendamento(dataSelecionada);
    };

    modal.querySelector("#imprimir").onclick = () => {
      imprimirResumoDiario(dataSelecionada, totalGeral, porProduto, porRep, lista, previsaoFaturamento);
    };
  }
}
