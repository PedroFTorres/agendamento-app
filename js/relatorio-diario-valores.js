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

function formatMoedaUnitarioRelatorio(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
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
    // Preços especiais são definidos pelo admin, mas pertencem ao cliente/produto.
    const precosQuery = db.collection("precos_clientes");
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
  const formatarDocumentoCliente = (valor) => {
    const original = String(valor || "").trim();
    const numeros = original.replace(/\D/g, "");
    if (numeros.length === 11) {
      return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (numeros.length === 14) {
      return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return original || "-";
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
      <td>${escapar(formatarDocumentoCliente(item.clienteDocumento))}</td>
      <td>${escapar(item.prazoPagamento || "-")}</td>
      <td class="produto">${escapar(item.produtoNome || "-")}</td>
      <td class="quantidade">${formatQuantidade(item.quantidade || 0)}</td>
      <td class="numero">${formatMoedaUnitarioRelatorio(item.precoUnitario || 0)}</td>
      <td class="numero">${formatMoedaRelatorio(item.valorVenda || 0)}</td>
      <td>${escapar(item.representanteNome || "-")}</td>
      <td class="observacao ${item.observacao ? "" : "sem-observacao"}">${escapar(item.observacao || "-")}</td>
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
          th:nth-child(1), td:nth-child(1) { width: 3%; }
          th:nth-child(2), td:nth-child(2) { width: 15%; }
          th:nth-child(3), td:nth-child(3) { width: 13%; }
          th:nth-child(4), td:nth-child(4) { width: 7%; }
          th:nth-child(5), td:nth-child(5) { width: 13%; }
          th:nth-child(6), td:nth-child(6) { width: 7%; }
          th:nth-child(7), td:nth-child(7) { width: 10%; }
          th:nth-child(8), td:nth-child(8) { width: 11%; }
          th:nth-child(9), td:nth-child(9) { width: 9%; }
          th:nth-child(10), td:nth-child(10) { width: 12%; }
          .produto { padding-right: 2px; }
          .quantidade, th.quantidade { text-align: center; font-weight: bold; padding-left: 2px; padding-right: 2px; }
          .numero, th.numero { text-align: right; font-weight: bold; }
          .observacao { color: #dc2626; font-weight: 700; }
          .observacao.sem-observacao { color: #6b7280; font-weight: 400; }
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
              <th>CNPJ/CPF</th>
              <th>Prazo</th>
              <th>Produto</th>
              <th class="quantidade">Qtd.</th>
              <th class="numero">Valor unit.</th>
              <th class="numero">Valor total</th>
              <th>Rep.</th>
              <th>Observa&ccedil;&atilde;o</th>
            </tr>
          </thead>
          <tbody>${linhasTabela || `<tr><td colspan="10">Nenhum agendamento.</td></tr>`}</tbody>
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

function numeroRelatorioDiario(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor || "").trim().replace(/[^\d,.-]/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function imprimirRelatorioGerencialDiario(dataSelecionada, lista, opcoes = {}) {
  const orientacao = opcoes.orientacao === "landscape" ? "landscape" : "portrait";
  const janela = opcoes.janelaReservada && !opcoes.janelaReservada.closed
    ? opcoes.janelaReservada
    : window.open("", "", "width=1100,height=800");
  if (!janela) {
    alert("Permita a abertura de janelas para gerar o PDF.");
    return;
  }

  const escapar = valor => typeof escapeHtmlRelatorio === "function"
    ? escapeHtmlRelatorio(valor)
    : String(valor || "");
  const dataFormatada = (() => {
    const [ano, mes, dia] = String(dataSelecionada || "").split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : String(dataSelecionada || "");
  })();
  const formatoNumero = (valor, casas = 2) => Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
  const formatoQuantidade = valor => Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
  const chave = valor => normalizarChavePrecoRelatorio(valor);
  const logoUrl = new URL("img/logo.png", window.location.href).href;
  const pesoTotal = numeroRelatorioDiario(opcoes.pesoTotal);
  const valorNota = numeroRelatorioDiario(opcoes.valorNota);
  const valorRecibo = numeroRelatorioDiario(opcoes.valorRecibo);
  const pedidosNota = Math.max(0, Math.trunc(numeroRelatorioDiario(opcoes.pedidosNota)));
  const pedidosRecibo = Math.max(0, Math.trunc(numeroRelatorioDiario(opcoes.pedidosRecibo)));

  const pedidos = new Map();
  const produtos = new Map();

  (lista || []).forEach((item, indice) => {
    const pedidoId = String(item.pedidoDocumentoId || item.pedidoId || `sem-pedido-${indice}`);
    if (!pedidos.has(pedidoId)) {
      pedidos.set(pedidoId, {
        prazo: String(item.prazoPagamento || "Não informado").trim() || "Não informado",
        cidade: String(item.clienteCidade || "").trim(),
        uf: String(item.clienteUf || "").trim()
      });
    }

    const nomeProduto = String(item.produtoNome || "Não informado").trim() || "Não informado";
    const produtoId = chave(nomeProduto);
    if (!produtos.has(produtoId)) {
      produtos.set(produtoId, { nome: nomeProduto, quantidade: 0, valor: 0 });
    }
    const produto = produtos.get(produtoId);
    produto.quantidade += Number(item.quantidade || 0);
    produto.valor += Number(item.valorVenda || 0);
  });

  const pagamentos = new Map();
  const cidades = new Map();
  pedidos.forEach((pedido, pedidoId) => {
    if (!pagamentos.has(pedido.prazo)) pagamentos.set(pedido.prazo, { valor: 0, pedidos: new Set() });
    pagamentos.get(pedido.prazo).pedidos.add(pedidoId);

    const nomeCidade = [pedido.uf, pedido.cidade].filter(Boolean).join(" ") || "Não informado";
    if (!cidades.has(nomeCidade)) cidades.set(nomeCidade, new Set());
    cidades.get(nomeCidade).add(pedidoId);
  });
  (lista || []).forEach((item, indice) => {
    const pedidoId = String(item.pedidoDocumentoId || item.pedidoId || `sem-pedido-${indice}`);
    const prazo = pedidos.get(pedidoId)?.prazo || "Não informado";
    if (!pagamentos.has(prazo)) pagamentos.set(prazo, { valor: 0, pedidos: new Set([pedidoId]) });
    pagamentos.get(prazo).valor += Number(item.valorVenda || 0);
  });

  const itensProdutos = [...produtos.values()]
    .map(item => ({
      ...item,
      medio: item.quantidade ? (item.valor / item.quantidade) * 1000 : 0
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const telhas = itensProdutos.filter(item => chave(item.nome).includes("telha"));
  const tijolos = itensProdutos.filter(item => chave(item.nome).includes("tijolo"));
  const outros = itensProdutos.filter(item => !chave(item.nome).includes("telha") && !chave(item.nome).includes("tijolo"));
  const resumoCategoria = itens => ({
    quantidade: itens.reduce((total, item) => total + item.quantidade, 0),
    valor: itens.reduce((total, item) => total + item.valor, 0),
    medio: itens.length ? itens.reduce((total, item) => total + item.medio, 0) / itens.length : 0
  });
  const totalTelhas = resumoCategoria(telhas);
  const totalTijolos = resumoCategoria(tijolos);
  const totalOutros = resumoCategoria(outros);
  const totalProdutos = resumoCategoria(itensProdutos);
  const valorProdutos = totalProdutos.valor;
  const valorDocumentos = valorNota + valorRecibo;
  const valorTotal = valorDocumentos > 0 ? valorDocumentos : valorProdutos;

  const linhasPagamento = [...pagamentos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, dados]) => `<tr><td>${escapar(nome)}</td><td class="num">${formatoNumero(dados.valor)}</td><td>Pedidos:</td><td class="num">${dados.pedidos.size}</td></tr>`)
    .join("") || '<tr><td>Não informado</td><td class="num">0,00</td><td>Pedidos:</td><td class="num">0</td></tr>';

  const linhasCidades = [...cidades.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, ids]) => `<tr><td>${escapar(nome)}</td><td class="num">${ids.size}</td><td></td><td></td></tr>`)
    .join("") || '<tr><td>Não informado</td><td class="num">0</td><td></td><td></td></tr>';

  const linhaProduto = item => `<tr><td>${escapar(item.nome)}</td><td class="num">${formatoQuantidade(item.quantidade)}</td><td class="num">${formatoNumero(item.valor)}</td><td class="num">${formatoNumero(item.medio)}</td></tr>`;
  const linhaTotal = (rotulo, dados, classe) => `<tr class="${classe}"><td>${rotulo}</td><td class="num">${formatoQuantidade(dados.quantidade)}</td><td class="num">${formatoNumero(dados.valor)}</td><td class="num">${formatoNumero(dados.medio)}</td></tr>`;
  const linhasItens = [
    ...telhas.map(linhaProduto),
    telhas.length ? linhaTotal("TOTAL DE TELHAS", totalTelhas, "total-telhas") : "",
    ...tijolos.map(linhaProduto),
    tijolos.length ? linhaTotal("TOTAL DE TIJOLOS", totalTijolos, "total-tijolos") : "",
    ...outros.map(linhaProduto),
    outros.length ? linhaTotal("TOTAL DE OUTROS ITENS", totalOutros, "total-outros") : ""
  ].join("") || '<tr><td>Nenhum item</td><td class="num">0</td><td class="num">0,00</td><td class="num">0,00</td></tr>';

  janela.document.open();
  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatório Diário - ${escapar(dataFormatada)}</title>
      <style>
        @page { size: A4 ${orientacao}; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #000; background: #fff; font-family: "Courier New", Courier, monospace; font-size: 8pt; line-height: 1.05; }
        .relatorio { width: 820px; max-width: 100%; }
        .cabecalho { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-bottom: 5px; border-bottom: 1px solid #000; }
        .marca { display: flex; align-items: center; gap: 8px; }
        .logo { width: 42px; height: 42px; object-fit: contain; }
        .nome-relatorio { font-size: 11pt; font-weight: bold; }
        .data-relatorio { font-weight: bold; white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        col:nth-child(1) { width: 46%; }
        col:nth-child(2) { width: 21%; }
        col:nth-child(3) { width: 18%; }
        col:nth-child(4) { width: 15%; }
        td { height: 16px; padding: 1px 4px; line-height: 1.05; vertical-align: middle; border-top: 1px solid #000; overflow-wrap: anywhere; }
        .num { text-align: right; white-space: nowrap; }
        .titulo td { font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .espaco td { height: 4px; border: 0; padding: 0; }
        .total td { font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .total-telhas td { background: #ffff00; font-weight: bold; }
        .total-tijolos td { background: #d9ead3; font-weight: bold; }
        .total-outros td { background: #eeeeee; font-weight: bold; }
        .total-geral td { font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <main class="relatorio">
        <header class="cabecalho">
          <div class="marca">
            <img class="logo" src="${logoUrl}" alt="Logo">
            <div class="nome-relatorio">RELATÓRIO DIÁRIO</div>
          </div>
          <div class="data-relatorio">${escapar(dataFormatada)}</div>
        </header>
        <table>
        <colgroup><col><col><col><col></colgroup>
        <tbody>
          <tr class="titulo"><td>Forma de pagamento</td><td></td><td></td><td></td></tr>
          ${linhasPagamento}
          <tr class="espaco"><td colspan="4"></td></tr>

          <tr class="titulo"><td>Tipo de documento</td><td></td><td></td><td></td></tr>
          <tr><td>NOTA FISCAL</td><td class="num">${formatoNumero(valorNota)}</td><td>Pedidos:</td><td class="num">${pedidosNota}</td></tr>
          <tr><td>RECIBO</td><td class="num">${formatoNumero(valorRecibo)}</td><td>Pedidos:</td><td class="num">${pedidosRecibo}</td></tr>
          <tr class="total"><td>Valor Total</td><td class="num">${formatoNumero(valorTotal)}</td><td></td><td></td></tr>
          <tr><td>Peso Total</td><td class="num">${formatoNumero(pesoTotal, 3)}</td><td></td><td></td></tr>
          <tr><td>Quantidade de Pedidos</td><td class="num">${pedidos.size}</td><td></td><td></td></tr>
          <tr class="espaco"><td colspan="4"></td></tr>

          <tr class="titulo"><td>Resumo por Cidade</td><td class="num">Qtd Pedidos</td><td></td><td></td></tr>
          ${linhasCidades}
          <tr class="espaco"><td colspan="4"></td></tr>

          <tr class="titulo"><td>Resumo por Item</td><td class="num">Qtd Itens</td><td class="num">Valor</td><td class="num">Valor Médio</td></tr>
          ${linhasItens}
          <tr class="total-geral"><td>TOTAL GERAL</td><td class="num">${formatoQuantidade(totalProdutos.quantidade)}</td><td class="num">${formatoNumero(valorProdutos)}</td><td class="num">${formatoNumero(totalProdutos.medio)}</td></tr>
        </tbody>
        </table>
      </main>
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () { window.print(); }, 250);
        });
      <\/script>
    </body>
    </html>
  `);
  janela.document.close();
}

async function abrirResumoDoDia(dataSelecionada, opcoesRelatorio = {}) {
  if (window.__resumoDiarioCarregando) return;

  const modalExistente = document.querySelector('[data-modal-resumo-diario="true"]');
  if (modalExistente) {
    modalExistente.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  window.__resumoDiarioCarregando = true;
  const indicador = document.createElement("div");
  indicador.id = "resumo-diario-carregando";
  indicador.className = "fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50";
  indicador.innerHTML = '<div class="bg-white px-5 py-4 rounded-lg shadow-lg font-semibold text-blue-900">Carregando relatório...</div>';
  document.body.appendChild(indicador);

  try {
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

  const dadosPedidoPorVinculo = new Map();

  async function buscarDadosPedido(agendamento) {
    const chave = agendamento.pedidoId ? `pedido:${agendamento.pedidoId}` : `agendamento:${agendamento.id}`;
    if (dadosPedidoPorVinculo.has(chave)) return dadosPedidoPorVinculo.get(chave);

    const consulta = (async () => {
      let pedidoDoc = null;
      if (agendamento.pedidoId) {
        const porCodigo = await db.collection("pedidos").where("codigo", "==", agendamento.pedidoId).limit(1).get();
        if (!porCodigo.empty) pedidoDoc = porCodigo.docs[0];
        else {
          const porId = await db.collection("pedidos").doc(String(agendamento.pedidoId)).get();
          if (porId.exists) pedidoDoc = porId;
        }
      }
      if (!pedidoDoc && agendamento.id) {
        const porListaIds = await db.collection("pedidos").where("agendamentoIds", "array-contains", agendamento.id).limit(1).get();
        if (!porListaIds.empty) pedidoDoc = porListaIds.docs[0];
      }
      if (!pedidoDoc && agendamento.id) {
        const porIdPrincipal = await db.collection("pedidos").where("agendamentoId", "==", agendamento.id).limit(1).get();
        if (!porIdPrincipal.empty) pedidoDoc = porIdPrincipal.docs[0];
      }
      const pedido = pedidoDoc?.data() || {};
      return {
        pedidoDocumentoId: pedidoDoc?.id || "",
        observacao: String(pedido.observacao || "").trim(),
        prazoPagamento: String(pedido.prazoPagamento || "").trim(),
        clienteDocumento: String(
          pedido.clienteCnpj ||
          pedido.clienteCpf ||
          pedido.cnpj ||
          pedido.cpf ||
          pedido.clienteDocumento ||
          ""
        ).trim(),
        clienteCidade: String(pedido.clienteCidade || pedido.cidade || "").trim(),
        clienteUf: String(pedido.clienteUf || pedido.uf || "").trim()
      };
    })();

    dadosPedidoPorVinculo.set(chave, consulta);
    return consulta;
  }

  await Promise.all(lista.map(async agendamento => {
    if (
      String(agendamento.observacao || "").trim() &&
      String(agendamento.prazoPagamento || "").trim() &&
      String(agendamento.clienteDocumento || "").trim() &&
      String(agendamento.clienteCidade || "").trim() &&
      String(agendamento.clienteUf || "").trim() &&
      String(agendamento.pedidoDocumentoId || "").trim()
    ) return;
    try {
      const dadosPedido = await buscarDadosPedido(agendamento);
      if (dadosPedido.pedidoDocumentoId) agendamento.pedidoDocumentoId = dadosPedido.pedidoDocumentoId;
      if (!String(agendamento.observacao || "").trim() && dadosPedido.observacao) agendamento.observacao = dadosPedido.observacao;
      if (!String(agendamento.prazoPagamento || "").trim() && dadosPedido.prazoPagamento) {
        agendamento.prazoPagamento = dadosPedido.prazoPagamento;
      }
      if (!String(agendamento.clienteDocumento || "").trim() && dadosPedido.clienteDocumento) {
        agendamento.clienteDocumento = dadosPedido.clienteDocumento;
      }
      if (!String(agendamento.clienteCidade || "").trim() && dadosPedido.clienteCidade) {
        agendamento.clienteCidade = dadosPedido.clienteCidade;
      }
      if (!String(agendamento.clienteUf || "").trim() && dadosPedido.clienteUf) {
        agendamento.clienteUf = dadosPedido.clienteUf;
      }
    } catch (e) {
      console.warn("Nao foi possivel recuperar os dados do pedido.", e);
    }
  }));

  const previsaoFaturamento = await aplicarValoresAgendamentosRelatorio(lista, user);

  if (opcoesRelatorio.gerarDireto === true) {
    imprimirRelatorioGerencialDiario(dataSelecionada, lista, opcoesRelatorio);
    return;
  }

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
              <div
                class="py-2 px-2 ${i % 2 === 0 ? "bg-gray-100" : "bg-white"} rounded ${PERFIL === "admin" && item.pedidoDocumentoId ? "cursor-pointer border border-transparent hover:border-blue-500 hover:bg-blue-50 transition-colors" : ""}"
                ${PERFIL === "admin" && item.pedidoDocumentoId ? `data-editar-pedido-id="${escapeHtmlRelatorio(item.pedidoDocumentoId)}" title="Clique para editar este pedido"` : ""}
              >
                <div class="font-medium flex items-center justify-between gap-2">
                  <span>${escapeHtmlRelatorio(item.clienteNome)}</span>
                  ${PERFIL === "admin" && item.pedidoDocumentoId ? '<span class="text-xs text-blue-700 font-semibold">Editar pedido</span>' : ""}
                </div>
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

  modal.dataset.modalResumoDiario = "true";
  document.body.appendChild(modal);

  const fecharResumo = () => modal.remove();
  modal.querySelector("#fechar").onclick = fecharResumo;

  if (PERFIL === "admin") {
    modal.querySelectorAll("[data-editar-pedido-id]").forEach(cartao => {
      cartao.onclick = async () => {
        const pedidoId = cartao.dataset.editarPedidoId;
        if (!pedidoId || typeof editarPedidoAprovado !== "function") {
          alert("Não foi possível localizar a edição deste pedido.");
          return;
        }
        fecharResumo();
        await editarPedidoAprovado(pedidoId);
      };
    });
  }

  if (!representanteSomenteConsulta) {
    modal.querySelector("#novo").onclick = () => {
      fecharResumo();
      abrirModalAgendamento(dataSelecionada);
    };

    modal.querySelector("#imprimir").onclick = () => {
      imprimirResumoDiario(dataSelecionada, totalGeral, porProduto, porRep, lista, previsaoFaturamento);
    };
  }
  } catch (erro) {
    console.error("Erro ao carregar o relatório diário.", erro);
    alert("Não foi possível carregar o relatório. Tente novamente.");
  } finally {
    indicador.remove();
    window.__resumoDiarioCarregando = false;
  }
}

function renderRelatoriosDiarios() {
  const agora = new Date();
  const dataLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  pageContent.innerHTML = `
    <section class="max-w-4xl mx-auto space-y-4">
      <div>
        <h2 class="text-2xl font-bold text-blue-900">Relatório Gerencial Diário</h2>
        <p class="text-sm text-gray-500">Gere diretamente o relatório usado na apresentação diária, sem converter PDF para Excel.</p>
      </div>

      <div class="bg-white rounded-xl shadow overflow-hidden">
        <div class="px-5 py-4 border-b">
          <h3 class="font-bold text-blue-900">Dados do relatório</h3>
          <p class="text-xs text-gray-500 mt-1">Pedidos, clientes, cidades, produtos, quantidades e valores são calculados automaticamente.</p>
        </div>

        <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block">
            <span class="block font-semibold mb-1">Data do relatório *</span>
            <input id="relatorio-diario-data" type="date" value="${dataLocal}" class="border rounded p-3 w-full">
          </label>

          <label class="block">
            <span class="block font-semibold mb-1">Orientação do PDF *</span>
            <select id="relatorio-diario-orientacao" class="border rounded p-3 w-full">
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </label>

          <label class="block">
            <span class="block font-semibold mb-1">Peso total (kg)</span>
            <input id="relatorio-diario-peso" inputmode="decimal" class="border rounded p-3 w-full" placeholder="Ex.: 222088,320">
            <small class="text-gray-500">Preenchimento manual, se desejar mostrar no PDF.</small>
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="block font-semibold mb-1">Valor de nota fiscal</span>
              <input id="relatorio-diario-nota" inputmode="decimal" class="border rounded p-3 w-full" placeholder="R$ 0,00">
            </label>
            <label class="block">
              <span class="block font-semibold mb-1">Pedidos com nota fiscal</span>
              <input id="relatorio-diario-nota-pedidos" type="number" min="0" step="1" class="border rounded p-3 w-full" placeholder="0">
            </label>
            <label class="block">
              <span class="block font-semibold mb-1">Valor de recibo</span>
              <input id="relatorio-diario-recibo" inputmode="decimal" class="border rounded p-3 w-full" placeholder="R$ 0,00">
            </label>
            <label class="block">
              <span class="block font-semibold mb-1">Pedidos com recibo</span>
              <input id="relatorio-diario-recibo-pedidos" type="number" min="0" step="1" class="border rounded p-3 w-full" placeholder="0">
            </label>
          </div>
        </div>

        <div class="px-5 py-4 bg-gray-50 border-t flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button id="relatorio-diario-abrir" class="border border-blue-700 text-blue-700 font-semibold px-5 py-3 rounded">
            Conferir pedidos
          </button>
          <button id="relatorio-diario-pdf" class="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-3 rounded">
            Gerar PDF gerencial
          </button>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
        O PDF inclui formas de pagamento, documentos, totais, cidades, clientes, produtos, quantidade, valor e preço médio por milheiro.
      </div>
      <p id="relatorio-diario-status" class="text-sm text-gray-500"></p>
    </section>
  `;

  const data = document.getElementById("relatorio-diario-data");
  const orientacao = document.getElementById("relatorio-diario-orientacao");
  const peso = document.getElementById("relatorio-diario-peso");
  const nota = document.getElementById("relatorio-diario-nota");
  const recibo = document.getElementById("relatorio-diario-recibo");
  const notaPedidos = document.getElementById("relatorio-diario-nota-pedidos");
  const reciboPedidos = document.getElementById("relatorio-diario-recibo-pedidos");
  const botaoAbrir = document.getElementById("relatorio-diario-abrir");
  const botaoPdf = document.getElementById("relatorio-diario-pdf");
  const status = document.getElementById("relatorio-diario-status");

  const bloquear = estado => {
    [botaoAbrir, botaoPdf].forEach(botao => {
      botao.disabled = estado;
      botao.classList.toggle("opacity-60", estado);
      botao.classList.toggle("cursor-wait", estado);
    });
  };

  botaoAbrir.onclick = async () => {
    if (!data.value || botaoAbrir.disabled) return;
    bloquear(true);
    status.textContent = "Carregando pedidos do dia...";
    try {
      await abrirResumoDoDia(data.value);
      status.textContent = "";
    } finally {
      bloquear(false);
    }
  };

  botaoPdf.onclick = async () => {
    if (!data.value || botaoPdf.disabled) return;

    const janelaReservada = window.open("", "_blank");
    if (janelaReservada) {
      janelaReservada.document.title = "Preparando relatório...";
      janelaReservada.document.body.innerHTML = '<p style="font:16px Arial;padding:24px;color:#1f3b64">Aguarde, preparando o relatório gerencial...</p>';
    }

    bloquear(true);
    status.textContent = "Calculando e preparando o PDF...";
    try {
      await abrirResumoDoDia(data.value, {
        gerarDireto: true,
        orientacao: orientacao.value,
        pesoTotal: peso.value,
        valorNota: nota.value,
        valorRecibo: recibo.value,
        pedidosNota: notaPedidos.value,
        pedidosRecibo: reciboPedidos.value,
        janelaReservada
      });
      status.textContent = "";
    } finally {
      bloquear(false);
    }
  };
}

window.renderRelatoriosDiarios = renderRelatoriosDiarios;
