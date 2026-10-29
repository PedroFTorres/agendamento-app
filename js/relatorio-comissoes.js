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
    // A venda pertence ao mês do carregamento, nunca ao mês de criação do pedido.
    const valor = pedido.dataCarregamento || pedido.dataAgendada || pedido.data;
    if (!valor) return null;
    if (typeof valor.toDate === "function") return valor.toDate();
    if (valor.seconds) return new Date(valor.seconds * 1000);
    if (valor instanceof Date) return valor;

    const texto = String(valor).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return new Date(texto + "T00:00:00");
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? null : data;
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

        // O valor salvo no pedido é o histórico da venda; preço atual só cobre pedidos antigos sem valor gravado.
        const precoAplicado = Number.isFinite(precoSalvo)
          ? precoSalvo
          : resultadoAtual.preco;
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
    const linhas = [["Representante", "Pedido", "Data de carregamento", "Cliente", "Produtos", "Status", "Quantidade", "Valor", "Comissão"]];

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

  async function exportarPdfComissoes() {
    if (!window.jspdf?.jsPDF) {
      alert("Gerador de PDF não está disponível.");
      return;
    }
    if (!dadosRelatorioComissao.length) {
      alert("Não há pedidos no relatório para exportar.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const mes = document.getElementById("comissao-mes")?.value || "";
    const status = document.getElementById("comissao-status")?.selectedOptions?.[0]?.textContent || "";
    const representante = document.getElementById("comissao-representante")?.selectedOptions?.[0]?.textContent || "Representante logado";
    const percentual = Math.max(0, Number(document.getElementById("comissao-percentual")?.value || 0));
    const totalVendas = dadosRelatorioComissao.reduce((soma, grupo) => soma + grupo.total, 0);
    const totalPedidos = dadosRelatorioComissao.reduce((soma, grupo) => soma + grupo.pedidos.length, 0);
    const totalComissao = totalVendas * percentual / 100;
    const azul = [31,59,100], laranja = [242,140,40], cinza = [107,114,128], borda = [226,232,240];
    const emissao = new Date().toLocaleString("pt-BR");

    let logo = null;
    try {
      if (typeof carregarLogoDataUrl === "function") {
        logo = await carregarLogoDataUrl();
      } else {
        logo = await fetch("img/logo.png").then(resposta => resposta.blob()).then(blob => new Promise((resolve,reject) => {
          const leitor = new FileReader();
          leitor.onload = () => resolve(leitor.result);
          leitor.onerror = reject;
          leitor.readAsDataURL(blob);
        }));
      }
    } catch (erro) {
      console.warn("Não foi possível carregar a logomarca no relatório de comissões:", erro);
    }
    if (logo) doc.addImage(logo, "PNG", 14, 9, 20, 20);

    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.setTextColor(...azul);
    doc.text("Relatório de Vendas e Comissões", logo ? 39 : 14, 17);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.setTextColor(...cinza);
    doc.text("Conferência mensal de vendas por data de carregamento", logo ? 39 : 14, 23);
    doc.text("Emitido em "+emissao, 283, 17, {align:"right"});
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.5);
    doc.line(14,32,283,32);

    const filtros = [
      ["Mês do carregamento", mes || "-", 14, 61],
      ["Pedidos", status || "-", 78, 52],
      ["Representante", representante || "Todos", 133, 82],
      ["Comissão", percentual.toLocaleString("pt-BR")+"%", 218, 65]
    ];
    filtros.forEach(([rotulo,valor,x,largura]) => {
      doc.setFillColor(248,250,252);
      doc.setDrawColor(...borda);
      doc.roundedRect(x,36,largura,15,2,2,"FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      doc.setTextColor(...cinza);
      doc.text(rotulo,x+4,41);
      doc.setFont("helvetica","normal");
      doc.setFontSize(9);
      doc.setTextColor(31,41,55);
      doc.text(doc.splitTextToSize(String(valor),largura-8).slice(0,2),x+4,47);
    });

    const cards = [
      ["PEDIDOS", quantidade(totalPedidos), 14, [239,246,255], azul],
      ["TOTAL VENDIDO", moeda(totalVendas), 105, [248,250,252], azul],
      ["COMISSÃO ESTIMADA", moeda(totalComissao), 196, [236,253,245], [4,120,87]]
    ];
    cards.forEach(([rotulo,valor,x,fundo,texto]) => {
      doc.setFillColor(...fundo);
      doc.setDrawColor(...borda);
      doc.roundedRect(x,56,87,18,2,2,"FD");
      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      doc.setTextColor(...cinza);
      doc.text(rotulo,x+4,62);
      doc.setFont("helvetica","bold");
      doc.setFontSize(13);
      doc.setTextColor(...texto);
      doc.text(String(valor),x+4,70);
    });

    let y = 82;
    dadosRelatorioComissao.forEach((grupo, indice) => {
      if (indice > 0 && y > 174) {
        doc.addPage();
        y = 16;
      }

      doc.setFillColor(248,250,252);
      doc.setDrawColor(...borda);
      doc.roundedRect(14,y-5,269,13,2,2,"FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(...azul);
      doc.text(grupo.nome,18,y);
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.setTextColor(...cinza);
      doc.text(
        grupo.pedidos.length+" pedido(s)  |  Vendas: "+moeda(grupo.total)+"  |  Comissão: "+moeda(grupo.total*percentual/100),
        18,y+5
      );

      doc.autoTable({
        startY:y+11,
        margin:{left:14,right:14,top:16,bottom:17},
        head:[["Carregamento","Pedido","Cliente","Produtos","Qtd.","Valor","Comissão"]],
        body:grupo.pedidos.slice().sort((a,b)=>b.data-a.data).map(pedido=>[
          pedido.dataFormatada,
          pedido.codigo||pedido.id,
          pedido.clienteNome||"-",
          pedido.produtosResumo||pedido.produtoNome||"-",
          quantidade(pedido.quantidade),
          moeda(pedido.valorVenda),
          moeda(pedido.valorVenda*percentual/100)
        ]),
        theme:"grid",
        styles:{font:"helvetica",fontSize:7.2,cellPadding:2,textColor:[55,65,81],lineColor:borda,lineWidth:0.15,valign:"middle",overflow:"linebreak"},
        headStyles:{fillColor:azul,textColor:[255,255,255],fontStyle:"bold",fontSize:7.5,cellPadding:2.5},
        alternateRowStyles:{fillColor:[248,250,252]},
        columnStyles:{
          0:{cellWidth:21},
          1:{cellWidth:45},
          2:{cellWidth:54,fontStyle:"bold"},
          3:{cellWidth:61},
          4:{cellWidth:17,halign:"right",fontStyle:"bold"},
          5:{cellWidth:25,halign:"right"},
          6:{cellWidth:26,halign:"right",textColor:[4,120,87],fontStyle:"bold"}
        }
      });
      y=Number(doc.lastAutoTable?.finalY||y+15)+11;
    });

    const paginas=doc.internal.getNumberOfPages();
    for(let pagina=1;pagina<=paginas;pagina+=1){
      doc.setPage(pagina);
      doc.setDrawColor(...borda);
      doc.setLineWidth(0.2);
      doc.line(14,196,283,196);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...cinza);
      doc.text("AgendaCF - Gestão Comercial",14,201);
      doc.text("Relatório de Vendas e Comissões",148.5,201,{align:"center"});
      doc.text("Página "+pagina+" de "+paginas,283,201,{align:"right"});
      doc.setFillColor(...laranja);
      doc.rect(14,204,269,1,"F");
    }

    doc.save("relatorio-comissoes-"+(mes||"periodo")+".pdf");
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
            <td class="p-2 text-right font-semibold text-green-700 whitespace-nowrap">${moeda(pedido.valorVenda * percentual / 100)}</td>
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
              <thead><tr class="text-left bg-white"><th class="p-2">Carregamento</th><th class="p-2">Pedido</th><th class="p-2">Cliente</th><th class="p-2">Produtos</th><th class="p-2 text-right">Qtd.</th><th class="p-2 text-right">Valor</th><th class="p-2 text-right">Comissão</th></tr></thead>
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
          <label><span class="block text-sm font-semibold mb-1">Mês do carregamento</span><input id="comissao-mes" type="month" value="${mesAtual}" class="border p-2 rounded w-full"></label>
          <label><span class="block text-sm font-semibold mb-1">Pedidos</span><select id="comissao-status" class="border p-2 rounded w-full"><option value="aprovado">Aprovados</option><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="cancelado">Cancelados</option></select></label>
          ${PERFIL === "admin" ? '<label><span class="block text-sm font-semibold mb-1">Representante</span><select id="comissao-representante" class="border p-2 rounded w-full"><option value="">Todos os representantes</option></select></label>' : ""}
          <label><span class="block text-sm font-semibold mb-1">Comissão (%)</span><input id="comissao-percentual" type="number" min="0" step="0.01" value="0" class="border p-2 rounded w-full"></label>
          <button id="comissao-atualizar" class="bg-blue-600 text-white px-4 py-2 rounded w-full">Atualizar relatório</button>
        </div>
        <div class="mt-3 flex flex-col md:flex-row gap-2">
          <button id="comissao-csv" class="border border-green-700 text-green-700 px-4 py-2 rounded w-full md:w-auto">Exportar CSV</button>
          <button id="comissao-pdf" class="border border-red-700 text-red-700 px-4 py-2 rounded w-full md:w-auto">Exportar PDF</button>
        </div>
      </div>
      <div id="comissao-resumo"></div>
      <div id="comissao-lista" class="space-y-4"></div>
    `;

    document.getElementById("comissao-atualizar").onclick = gerarRelatorioComissoes;
    document.getElementById("comissao-csv").onclick = exportarCsvComissoes;
    document.getElementById("comissao-pdf").onclick = exportarPdfComissoes;
    document.getElementById("comissao-percentual").onchange = gerarRelatorioComissoes;
    const filtroRepresentante = document.getElementById("comissao-representante");
    if (filtroRepresentante) filtroRepresentante.onchange = gerarRelatorioComissoes;
    gerarRelatorioComissoes().catch(e => {
      console.error(e);
      document.getElementById("comissao-lista").innerHTML = '<div class="bg-white p-5 rounded shadow text-red-600">Não foi possível gerar o relatório.</div>';
    });
  };

})();
