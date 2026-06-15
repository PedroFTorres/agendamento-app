(() => {
  async function buscarPedidoDoAgendamento(agendamento) {
    const pedidoId = String(agendamento.pedidoId || "").trim();
    if (!pedidoId) return null;

    const snap = await db.collection("pedidos")
      .where("codigo", "==", pedidoId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  function montarAtualizacaoPedidoPorAgendamento(pedido, agendamentoId, agendamentoAnterior, agendamentoAtualizado) {
    const atualizacao = {
      dataAnterior: pedido.data || agendamentoAnterior.data || "",
      data: agendamentoAtualizado.data,
      notificadoData: (pedido.data || agendamentoAnterior.data || "") !== agendamentoAtualizado.data
    };

    if (Array.isArray(pedido.itens) && pedido.itens.length) {
      const itens = pedido.itens.map((item) => ({ ...item }));
      const agendamentoIds = Array.isArray(pedido.agendamentoIds) ? pedido.agendamentoIds : [];
      let index = agendamentoIds.indexOf(agendamentoId);

      if (index < 0) {
        index = itens.findIndex((item) => item.produtoNome === agendamentoAnterior.produtoNome);
      }

      if (index >= 0 && itens[index]) {
        itens[index] = {
          ...itens[index],
          produtoNome: agendamentoAtualizado.produtoNome,
          quantidade: agendamentoAtualizado.quantidade
        };

        const quantidadeTotal = itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
        atualizacao.itens = itens;
        atualizacao.produtoNome = itens[0]?.produtoNome || agendamentoAtualizado.produtoNome;
        atualizacao.produtosResumo = itens
          .map((item) => `${item.produtoNome} (${typeof formatQuantidade === "function" ? formatQuantidade(item.quantidade) : item.quantidade})`)
          .join(", ");
        atualizacao.qtdAnterior = pedido.quantidade;
        atualizacao.quantidade = quantidadeTotal;
        atualizacao.notificadoQtd = Number(pedido.quantidade || 0) !== quantidadeTotal;
      }
    } else {
      atualizacao.produtoNome = agendamentoAtualizado.produtoNome;
      atualizacao.quantidade = agendamentoAtualizado.quantidade;
      atualizacao.qtdAnterior = pedido.quantidade;
      atualizacao.notificadoQtd = Number(pedido.quantidade || 0) !== Number(agendamentoAtualizado.quantidade || 0);
    }

    return atualizacao;
  }

  async function atualizarPedidoVinculadoAoAgendamento(agendamentoId, agendamentoAnterior, agendamentoAtualizado) {
    const pedido = await buscarPedidoDoAgendamento(agendamentoAnterior);
    if (!pedido) return;

    const atualizacaoPedido = montarAtualizacaoPedidoPorAgendamento(
      pedido,
      agendamentoId,
      agendamentoAnterior,
      agendamentoAtualizado
    );

    await db.collection("pedidos").doc(pedido.id).update(atualizacaoPedido);

    if (pedido.status === "aprovado" && typeof window.abrirWhatsappPedidoAtualizado === "function") {
      await window.abrirWhatsappPedidoAtualizado(
        pedido,
        { ...pedido, ...atualizacaoPedido },
        pedido.data || agendamentoAnterior.data,
        agendamentoAtualizado.data
      );
    }
  }

  async function abrirEdicaoAgendamentoComFechar(id) {
    const user = await waitForAuth();
    const snap = await db.collection("agendamentos").doc(id).get();
    const d = snap.data();
    const clientesSnap = await getClientesFiltrados();

    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white p-6 rounded w-full max-w-md space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-bold">Editar Agendamento</h3>
          <button id="fechar-modal-agendamento" type="button" class="text-gray-500 hover:text-gray-800 text-2xl leading-none" aria-label="Fechar">×</button>
        </div>

        <select id="edit-cliente" class="border p-2 w-full"></select>
        <select id="edit-representante" class="border p-2 w-full"></select>
        <select id="edit-produto" class="border p-2 w-full"></select>

        <input id="edit-data" type="date" class="border p-2 w-full">
        <input id="edit-qtd" type="number" class="border p-2 w-full">

        <div class="flex justify-between gap-2">
          <button id="excluir" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button>
          <div class="flex gap-2">
            <button id="cancelar" type="button" class="bg-gray-400 text-white px-3 py-1 rounded">Fechar</button>
            <button id="salvar" class="bg-green-600 text-white px-3 py-1 rounded">Salvar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fecharModal = () => modal.remove();
    modal.querySelector("#cancelar").onclick = fecharModal;
    modal.querySelector("#fechar-modal-agendamento").onclick = fecharModal;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) fecharModal();
    });
    document.addEventListener("keydown", function fecharNoEscape(event) {
      if (event.key !== "Escape" || !document.body.contains(modal)) return;
      document.removeEventListener("keydown", fecharNoEscape);
      fecharModal();
    });

    const selCliente = modal.querySelector("#edit-cliente");
    const selProduto = modal.querySelector("#edit-produto");
    const selRepresentante = modal.querySelector("#edit-representante");

    clientesSnap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().nome;
      opt.textContent = doc.data().nome;
      if (doc.data().nome === d.clienteNome) opt.selected = true;
      selCliente.appendChild(opt);
    });

    const repOpt = document.createElement("option");
    repOpt.value = d.representanteNome || REPRESENTANTE_ATUAL || "";
    repOpt.textContent = d.representanteNome || REPRESENTANTE_ATUAL || "Representante";
    repOpt.selected = true;
    selRepresentante.appendChild(repOpt);

    const prodSnap = await db.collection("produtos").get();
    const nomesUnicos = new Set();
    const listaProdutos = [];

    prodSnap.forEach(doc => {
      const nome = String(doc.data()?.nome || "").trim();
      const chave = nome.toLowerCase();
      if (!nome || nomesUnicos.has(chave)) return;
      nomesUnicos.add(chave);
      listaProdutos.push(nome);
    });

    listaProdutos.sort((a, b) => a.localeCompare(b, "pt-BR"));
    listaProdutos.forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      if (nome === d.produtoNome) opt.selected = true;
      selProduto.appendChild(opt);
    });

    modal.querySelector("#edit-qtd").value = d.quantidade || 0;
    modal.querySelector("#edit-data").value = d.data || "";

    modal.querySelector("#salvar").onclick = async () => {
      const dadosAtualizados = {
        clienteNome: selCliente.value,
        representanteNome: selRepresentante.value || REPRESENTANTE_ATUAL,
        produtoNome: selProduto.value,
        quantidade: parseInt(modal.querySelector("#edit-qtd").value, 10) || 0,
        data: modal.querySelector("#edit-data").value
      };

      await db.collection("agendamentos").doc(id).update(dadosAtualizados);
      await atualizarPedidoVinculadoAoAgendamento(id, d, dadosAtualizados);

      fecharModal();
    };

    modal.querySelector("#excluir").onclick = async () => {
      if (confirm("Excluir agendamento?")) {
        await db.collection("agendamentos").doc(id).delete();
        fecharModal();
      }
    };
  }

  window.abrirEdicaoAgendamento = abrirEdicaoAgendamentoComFechar;
  try {
    abrirEdicaoAgendamento = abrirEdicaoAgendamentoComFechar;
  } catch (_) {
    // Mantem compatibilidade caso o navegador bloqueie reatribuicao global.
  }
})();
