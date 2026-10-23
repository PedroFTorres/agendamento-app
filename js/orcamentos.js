(() => {
  const COLECAO_ORCAMENTOS = "orcamentos";
  let unsubscribeOrcamentos = null;

  const escOrcamento = (valor) => String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const numeroOrcamento = (valor) => {
    const texto = String(valor ?? "").trim();
    if (!texto) return 0;
    const normalizado = texto.includes(",")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto;
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  };

  const moedaOrcamento = (valor, casas = 2) => Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });

  const quantidadeOrcamento = (valor) => Number(valor || 0).toLocaleString("pt-BR");

  const dataISOHoje = () => {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const adicionarDias = (dataISO, dias) => {
    const data = new Date(`${dataISO}T12:00:00`);
    data.setDate(data.getDate() + dias);
    return data.toISOString().slice(0, 10);
  };

  const dataBR = (valor) => {
    if (!valor) return "-";
    if (valor?.toDate) return valor.toDate().toLocaleDateString("pt-BR");
    const texto = String(valor).slice(0, 10);
    const partes = texto.split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto;
  };

  const codigoNovoOrcamento = () => {
    const agora = new Date();
    const pad = (n, t = 2) => String(n).padStart(t, "0");
    return `ORC-${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}-${pad(Math.floor(Math.random() * 100))}`;
  };

  const obterCampoPreco = (prazo) => {
    const chave = String(prazo || "").toLowerCase();
    if (chave.includes("10")) return "preco10Dias";
    if (chave.includes("30/60")) return "preco3060Dias";
    if (chave.includes("30") || chave.includes("45") || chave.includes("20")) return "preco30Dias";
    return "precoAVista";
  };

  async function precoDoOrcamento(clienteNome, produto, pagamento) {
    if (!produto?.nome) return 0;
    if (typeof window.buscarPrecoUnitarioPedido === "function") {
      try {
        const resultado = await window.buscarPrecoUnitarioPedido(clienteNome, produto.nome, pagamento, "");
        const preco = Number(resultado?.preco || 0);
        if (preco > 0) return preco;
      } catch (erro) {
        console.warn("Não foi possível consultar o preço do orçamento.", erro);
      }
    }
    const campo = obterCampoPreco(pagamento);
    return numeroOrcamento(produto[campo] ?? produto.precoAVista ?? produto.preco);
  }

  async function gerarPdfOrcamento(orcamento) {
    if (!window.jspdf?.jsPDF) {
      alert("Gerador de PDF indisponível.");
      return;
    }

    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const azul = [31, 59, 100], cinza = [107, 114, 128], borda = [226, 232, 240];
    const laranja = [242, 140, 40];
    let logo = null;
    try {
      if (typeof carregarLogoDataUrl === "function") logo = await carregarLogoDataUrl();
    } catch (_) {}
    if (logo) doc.addImage(logo, "PNG", 14, 9, 20, 20);

    doc.setTextColor(...azul); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Proposta Comercial", logo ? 39 : 14, 17);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...cinza);
    doc.text(`Orçamento ${orcamento.codigo || "-"}`, logo ? 39 : 14, 23);
    doc.text(`Emissão: ${dataBR(orcamento.dataEmissao)}`, 196, 17, { align: "right" });
    doc.text(`Validade: ${dataBR(orcamento.validade)}`, 196, 23, { align: "right" });
    doc.setDrawColor(...azul); doc.setLineWidth(0.5); doc.line(14, 33, 196, 33);

    const campo = (rotulo, valor, x, y, largura) => {
      doc.setFillColor(248, 250, 252); doc.setDrawColor(...borda);
      doc.roundedRect(x, y, largura, 16, 2, 2, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...cinza);
      doc.text(rotulo, x + 4, y + 5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(31, 41, 55);
      doc.text(doc.splitTextToSize(String(valor || "-"), largura - 8).slice(0, 2), x + 4, y + 11);
    };

    campo("Cliente", orcamento.clienteNome, 14, 38, 116);
    campo("CNPJ/CPF", orcamento.clienteCnpj || "-", 134, 38, 62);
    campo("WhatsApp", orcamento.clienteWhatsapp || "-", 14, 57, 56);
    campo("Forma de pagamento", orcamento.formaPagamento || "-", 74, 57, 56);
    campo("Representante", orcamento.representanteNome || "-", 134, 57, 62);

    doc.autoTable({
      startY: 79,
      margin: { left: 14, right: 14, bottom: 28 },
      head: [["Item", "Produto", "Quantidade", "Valor unitário", "Valor total"]],
      body: (orcamento.itens || []).map((item, indice) => [
        indice + 1,
        item.produtoNome || "-",
        quantidadeOrcamento(item.quantidade),
        moedaOrcamento(item.precoUnitario, 3),
        moedaOrcamento(item.valorTotal, 2)
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: [55, 65, 81], lineColor: borda, lineWidth: 0.15, valign: "middle" },
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 34, halign: "right" },
        4: { cellWidth: 34, halign: "right", fontStyle: "bold" }
      }
    });

    let y = (doc.lastAutoTable?.finalY || 90) + 6;
    if (y > 238) { doc.addPage(); y = 25; }
    doc.setFillColor(239, 246, 255); doc.setDrawColor(...borda);
    doc.roundedRect(116, y, 80, 26, 2, 2, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...cinza);
    doc.text("QUANTIDADE TOTAL", 121, y + 7);
    doc.text("VALOR TOTAL", 121, y + 16);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...azul); doc.setFontSize(11);
    doc.text(quantidadeOrcamento(orcamento.quantidadeTotal), 191, y + 7, { align: "right" });
    doc.setFontSize(13); doc.text(moedaOrcamento(orcamento.valorTotal), 191, y + 17, { align: "right" });

    if (orcamento.observacao) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...azul);
      doc.text("Observações", 14, y + 7);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(55, 65, 81);
      doc.text(doc.splitTextToSize(orcamento.observacao, 94).slice(0, 5), 14, y + 13);
    }

    const paginas = doc.internal.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      doc.setPage(pagina);
      doc.setDrawColor(...borda); doc.line(14, 281, 196, 281);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...cinza);
      doc.text("AgendaCF - Proposta Comercial", 14, 286);
      doc.text(`Página ${pagina} de ${paginas}`, 196, 286, { align: "right" });
      doc.setFillColor(...laranja); doc.rect(14, 289, 182, 1, "F");
    }

    doc.save(`orcamento-${orcamento.codigo || "sem-codigo"}.pdf`);
  }

  async function renderOrcamentos() {
    const user = await waitForAuth();
    if (!PERFIL && typeof carregarUsuario === "function") await carregarUsuario();

    const clientesQuery = PERFIL === "representante"
      ? db.collection("clientes").where("userId", "==", user.uid)
      : db.collection("clientes");
    const [clientesSnap, produtosSnap] = await Promise.all([
      clientesQuery.get(),
      db.collection("produtos").get()
    ]);
    const clientes = clientesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(cliente => cliente.nome)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const produtos = produtosSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(produto => produto.nome)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    pageContent.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 class="text-xl font-bold text-blue-900">Orçamentos</h2><p class="text-sm text-gray-500">Crie, salve e imprima propostas comerciais.</p></div>
        <button id="orc-novo" class="bg-blue-700 text-white px-4 py-2 rounded">+ Novo orçamento</button>
      </div>
      <section class="bg-white p-4 rounded-xl shadow">
        <div class="flex flex-col md:flex-row gap-2 mb-4">
          <input id="orc-busca" class="border p-2 rounded flex-1" placeholder="Pesquisar cliente ou número do orçamento">
          <select id="orc-filtro-status" class="border p-2 rounded"><option value="">Todos</option><option value="valido">Válidos</option><option value="vencido">Vencidos</option></select>
        </div>
        <div id="orc-lista" class="space-y-3"><p class="text-gray-500">Carregando...</p></div>
      </section>
    `;

    let orcamentos = [];
    const lista = document.getElementById("orc-lista");
    const renderLista = () => {
      const busca = String(document.getElementById("orc-busca")?.value || "").toLowerCase().trim();
      const filtro = document.getElementById("orc-filtro-status")?.value || "";
      const hoje = dataISOHoje();
      const filtrados = orcamentos.filter(item => {
        const texto = `${item.codigo || ""} ${item.clienteNome || ""}`.toLowerCase();
        const valido = !item.validade || item.validade >= hoje;
        return (!busca || texto.includes(busca)) && (!filtro || (filtro === "valido" ? valido : !valido));
      });
      if (!filtrados.length) { lista.innerHTML = '<p class="text-gray-500">Nenhum orçamento encontrado.</p>'; return; }
      lista.innerHTML = filtrados.map(item => `
        <article class="border border-slate-200 rounded-xl p-4 bg-white">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div class="text-xs text-gray-500">${escOrcamento(item.codigo || "-")} - emitido em ${escOrcamento(dataBR(item.dataEmissao))}</div>
              <h3 class="font-bold text-blue-900">${escOrcamento(item.clienteNome || "-")}</h3>
              <div class="text-sm text-gray-600">${(item.itens || []).length} item(ns) - ${quantidadeOrcamento(item.quantidadeTotal)} unidades - validade ${escOrcamento(dataBR(item.validade))}</div>
              <div class="font-bold text-green-700 mt-1">${moedaOrcamento(item.valorTotal)}</div>
            </div>
            <button data-pdf="${escOrcamento(item.id)}" class="bg-blue-700 text-white px-4 py-2 rounded">Gerar PDF</button>
          </div>
        </article>`).join("");
      lista.querySelectorAll("[data-pdf]").forEach(botao => botao.onclick = () => {
        const item = orcamentos.find(orcamento => orcamento.id === botao.dataset.pdf);
        if (item) gerarPdfOrcamento(item);
      });
    };

    document.getElementById("orc-busca").oninput = renderLista;
    document.getElementById("orc-filtro-status").onchange = renderLista;

    const abrirNovo = () => {
      const modal = document.createElement("div");
      modal.className = "fixed inset-0 bg-black bg-opacity-50 z-50 p-2 md:p-4 overflow-y-auto";
      modal.innerHTML = `
        <div class="bg-white max-w-4xl mx-auto my-4 rounded-xl shadow-xl overflow-hidden">
          <div class="px-5 py-4 text-white flex items-center justify-between" style="background:#1f3b64"><div><h3 class="text-xl font-bold">Novo orçamento</h3><p class="text-xs text-blue-100">Proposta comercial</p></div><button type="button" class="orc-fechar text-2xl">&times;</button></div>
          <div class="p-4 md:p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="md:col-span-2"><span class="font-semibold text-sm block mb-1">Cliente *</span><select id="orc-cliente" class="border p-2 rounded w-full"><option value="">Selecione o cliente</option>${clientes.map(c => `<option value="${escOrcamento(c.id)}">${escOrcamento(c.nome)}</option>`).join("")}</select></label>
              <label><span class="font-semibold text-sm block mb-1">Validade da proposta *</span><input id="orc-validade" type="date" value="${adicionarDias(dataISOHoje(), 7)}" min="${dataISOHoje()}" class="border p-2 rounded w-full"></label>
              <label class="md:col-span-2"><span class="font-semibold text-sm block mb-1">Forma de pagamento *</span><select id="orc-pagamento" class="border p-2 rounded w-full"><option>À vista</option><option>10 dias</option><option>20 dias</option><option>30 dias</option><option>45 dias</option><option>30/60 dias</option></select></label>
            </div>
            <div><div class="flex items-center justify-between mb-2"><h4 class="font-bold text-blue-900">Itens da proposta</h4><button id="orc-adicionar-item" type="button" class="border border-blue-700 text-blue-700 px-3 py-1 rounded">+ Adicionar produto</button></div><div id="orc-itens" class="space-y-2"></div></div>
            <label><span class="font-semibold text-sm block mb-1">Observações</span><textarea id="orc-observacao" rows="3" class="border p-2 rounded w-full" placeholder="Condições, prazo de entrega ou outras informações"></textarea></label>
            <div class="grid grid-cols-2 gap-3 bg-blue-50 border border-blue-100 rounded-lg p-4"><div><span class="text-xs text-gray-500">QUANTIDADE TOTAL</span><strong id="orc-qtd-total" class="block text-xl text-blue-900">0</strong></div><div class="text-right"><span class="text-xs text-gray-500">VALOR TOTAL</span><strong id="orc-valor-total" class="block text-xl text-green-700">R$ 0,00</strong></div></div>
          </div>
          <div class="p-4 border-t bg-gray-50 flex justify-end gap-2"><button type="button" class="orc-fechar bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button><button id="orc-salvar" class="bg-blue-700 text-white px-4 py-2 rounded">Salvar orçamento</button></div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelectorAll(".orc-fechar").forEach(botao => botao.onclick = () => modal.remove());
      const itensEl = modal.querySelector("#orc-itens");

      const atualizarTotais = () => {
        const linhas = [...itensEl.querySelectorAll(".orc-item")];
        let quantidadeTotal = 0, valorTotal = 0;
        linhas.forEach(linha => {
          const quantidade = numeroOrcamento(linha.querySelector(".orc-quantidade").value);
          const preco = numeroOrcamento(linha.querySelector(".orc-preco").value);
          quantidadeTotal += quantidade; valorTotal += quantidade * preco;
          linha.querySelector(".orc-total-item").textContent = moedaOrcamento(quantidade * preco);
        });
        modal.querySelector("#orc-qtd-total").textContent = quantidadeOrcamento(quantidadeTotal);
        modal.querySelector("#orc-valor-total").textContent = moedaOrcamento(valorTotal);
      };

      const atualizarPrecoLinha = async (linha) => {
        const cliente = clientes.find(c => c.id === modal.querySelector("#orc-cliente").value);
        const produto = produtos.find(p => p.id === linha.querySelector(".orc-produto").value);
        if (!cliente || !produto) return;
        const preco = await precoDoOrcamento(cliente.nome, produto, modal.querySelector("#orc-pagamento").value);
        linha.querySelector(".orc-preco").value = preco ? preco.toFixed(3).replace(".", ",") : "";
        atualizarTotais();
      };

      const adicionarItem = () => {
        const linha = document.createElement("div");
        linha.className = "orc-item grid grid-cols-1 md:grid-cols-12 gap-2 items-center border rounded-lg p-2";
        linha.innerHTML = `<select class="orc-produto border p-2 rounded md:col-span-4"><option value="">Selecione o produto</option>${produtos.map(p => `<option value="${escOrcamento(p.id)}">${escOrcamento(p.nome)}</option>`).join("")}</select><input class="orc-quantidade border p-2 rounded md:col-span-2" type="text" inputmode="numeric" placeholder="Quantidade"><input class="orc-preco border p-2 rounded md:col-span-2" type="text" inputmode="decimal" placeholder="Valor unitário" ${PERFIL === "admin" ? "" : "readonly"}><div class="orc-total-item md:col-span-3 font-bold text-right text-green-700">R$ 0,00</div><button type="button" class="orc-remover bg-red-600 text-white p-2 rounded md:col-span-1">&times;</button>`;
        itensEl.appendChild(linha);
        linha.querySelector(".orc-produto").onchange = () => atualizarPrecoLinha(linha);
        linha.querySelectorAll(".orc-quantidade,.orc-preco").forEach(input => input.oninput = atualizarTotais);
        linha.querySelector(".orc-remover").onclick = () => { linha.remove(); if (!itensEl.children.length) adicionarItem(); atualizarTotais(); };
      };
      adicionarItem();
      modal.querySelector("#orc-adicionar-item").onclick = adicionarItem;
      modal.querySelector("#orc-cliente").onchange = () => itensEl.querySelectorAll(".orc-item").forEach(atualizarPrecoLinha);
      modal.querySelector("#orc-pagamento").onchange = () => itensEl.querySelectorAll(".orc-item").forEach(atualizarPrecoLinha);

      modal.querySelector("#orc-salvar").onclick = async () => {
        const cliente = clientes.find(c => c.id === modal.querySelector("#orc-cliente").value);
        const validade = modal.querySelector("#orc-validade").value;
        const formaPagamento = modal.querySelector("#orc-pagamento").value;
        const itens = [...itensEl.querySelectorAll(".orc-item")].map(linha => {
          const produto = produtos.find(p => p.id === linha.querySelector(".orc-produto").value);
          const quantidade = numeroOrcamento(linha.querySelector(".orc-quantidade").value);
          const precoUnitario = numeroOrcamento(linha.querySelector(".orc-preco").value);
          return { produtoId: produto?.id || "", produtoNome: produto?.nome || "", quantidade, precoUnitario, valorTotal: quantidade * precoUnitario };
        }).filter(item => item.produtoId && item.quantidade > 0 && item.precoUnitario > 0);
        if (!cliente) return alert("Selecione o cliente.");
        if (!validade) return alert("Informe a validade da proposta.");
        if (!itens.length) return alert("Adicione ao menos um produto com quantidade e valor.");
        const quantidadeTotal = itens.reduce((t, item) => t + item.quantidade, 0);
        const valorTotal = itens.reduce((t, item) => t + item.valorTotal, 0);
        const botao = modal.querySelector("#orc-salvar"); botao.disabled = true; botao.textContent = "Salvando...";
        const dados = {
          codigo: codigoNovoOrcamento(), userId: user.uid, criadoPor: user.uid,
          representanteNome: REPRESENTANTE_ATUAL || "Administrativo",
          clienteId: cliente.id, clienteNome: cliente.nome, clienteCnpj: cliente.cnpj || "", clienteWhatsapp: cliente.whatsapp || "",
          clienteEndereco: [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(", "),
          itens, quantidadeTotal, valorTotal, formaPagamento, validade, dataEmissao: dataISOHoje(),
          observacao: modal.querySelector("#orc-observacao").value.trim(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
          const ref = await db.collection(COLECAO_ORCAMENTOS).add(dados);
          modal.remove();
          await gerarPdfOrcamento({ id: ref.id, ...dados });
        } catch (erro) {
          console.error(erro); botao.disabled = false; botao.textContent = "Salvar orçamento";
          alert(erro?.code === "permission-denied" ? "O Firebase ainda não permite salvar orçamentos. É necessário liberar a coleção orcamentos para os usuários autorizados." : "Não foi possível salvar o orçamento.");
        }
      };
    };

    document.getElementById("orc-novo").onclick = abrirNovo;
    if (unsubscribeOrcamentos) unsubscribeOrcamentos();
    let query = db.collection(COLECAO_ORCAMENTOS);
    if (PERFIL === "representante") query = query.where("criadoPor", "==", user.uid);
    unsubscribeOrcamentos = query.onSnapshot(snapshot => {
      orcamentos = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
        .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
      renderLista();
    }, erro => {
      console.error(erro);
      lista.innerHTML = '<p class="text-red-600">Não foi possível carregar os orçamentos. Verifique a permissão da coleção orcamentos.</p>';
    });
  }

  window.renderOrcamentos = renderOrcamentos;
  window.gerarPdfOrcamento = gerarPdfOrcamento;
})();

