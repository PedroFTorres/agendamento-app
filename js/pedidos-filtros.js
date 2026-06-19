(() => {
  let pedidosDataAtual = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let pedidosFiltroStatus = "todos";
  let pedidosFiltroRepresentante = "";
  let unsubscribePedidos = null;

  function atualizarCabecalhoDashboard(page) {
    const header = document.getElementById("dashboard-header");
    if (!header) return;
    header.classList.toggle("hidden", page !== "dashboard");
  }

  function formatarMes(data) {
    return data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    });
  }

  function dataCriacaoPedido(pedido) {
    if (pedido.createdAt?.toDate) return pedido.createdAt.toDate();
    if (pedido.createdAt?.seconds) return new Date(pedido.createdAt.seconds * 1000);
    return null;
  }

  function normalizarNomeRepresentante(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function preencherSelectProduto(select, listaProdutos) {
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione produto</option>`;
    listaProdutos.forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      select.appendChild(opt);
    });
    if (valorAtual) select.value = valorAtual;
  }

  function formatarInputQuantidadePedido(input) {
    input?.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (!v) {
        e.target.value = "";
        return;
      }
      e.target.value = Number(v).toLocaleString("pt-BR");
    });
  }

  function atualizarBotoesRemoverProduto() {
    const linhas = document.querySelectorAll("#p-itens .pedido-item");
    linhas.forEach((linha) => {
      linha
        .querySelector(".btn-remover-produto")
        ?.classList.toggle("hidden", linhas.length === 1);
    });
  }

  function montarPedidoCard(p) {
    const corStatus =
      p.status === "pendente" ? "orange" :
      p.status === "aprovado" ? "green" :
      "red";

    const item = document.createElement("div");
    item.className = "bg-white p-3 rounded shadow cursor-pointer";
    item.innerHTML = `
      <div style="font-size:12px; color:#666;">
        Pedido: <b>${p.codigo || "-"}</b>
      </div>

      <b>${p.clienteNome || "-"}</b> - ${
        typeof formatarItensPedidoTexto === "function"
          ? formatarItensPedidoTexto(p)
          : `${p.produtoNome || "-"} (${formatQuantidade(p.quantidade)})`
      }<br>

      <div style="font-size:12px; color:#555;">
        Representante: ${p.representanteNome || "nao informado"}
      </div>

      <span style="color:${corStatus}; font-weight:bold">
        ${p.status || "-"}
      </span>

      ${PERFIL === "admin" ? `
        <div class="mt-2 space-x-2">
          ${p.status === "aprovado" ? `
            <button data-id="${p.id}" class="btn-excluir bg-red-800 text-white px-2 py-1 rounded">
              Excluir
            </button>
          ` : ""}

          ${p.status === "pendente" ? `
            <button data-id="${p.id}" class="btn-aprovar bg-green-600 text-white px-2 py-1 rounded">
              Aprovar
            </button>
          ` : ""}

          ${["pendente", "aprovado"].includes(p.status) ? `
            <button data-id="${p.id}" class="btn-cancelar bg-red-600 text-white px-2 py-1 rounded">
              Cancelar
            </button>
          ` : ""}

          <button data-id="${p.id}" class="btn-editar bg-blue-600 text-white px-2 py-1 rounded">
            Editar
          </button>
        </div>
      ` : ""}
    `;

    item.addEventListener("click", () => {
      if (typeof window.abrirModalDetalhesPedido === "function") {
        window.abrirModalDetalhesPedido(p);
        return;
      }

      const prazoFallback = p.prazoPagamento || p.data || "-";
      alert(
        `Pedido: ${p.codigo || "-"}\n` +
        `Cliente: ${p.clienteNome || "-"}\n` +
        `Produtos: ${
          typeof formatarItensPedidoTexto === "function"
            ? formatarItensPedidoTexto(p)
            : (p.produtoNome || "-")
        }\n` +
        `Quantidade total: ${formatQuantidade(p.quantidade || 0)}\n` +
        `Prazo: ${prazoFallback}\n` +
        `Observacao: ${p.observacao || "-"}`
      );
    });

    item.querySelector(".btn-excluir")?.addEventListener("click", (e) => {
      e.stopPropagation();
      excluirPedidoCompleto(p.id);
    });
    item.querySelector(".btn-editar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      editarPedidoAprovado(p.id);
    });
    item.querySelector(".btn-aprovar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      aprovarPedido(p.id, e.target);
    });
    item.querySelector(".btn-cancelar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      cancelarPedido(p.id, e.target);
    });

    return item;
  }

  async function configurarNovoPedido(user, listaProdutos) {
    const clienteSelect = document.getElementById("p-cliente");
    const produtoSelect = document.getElementById("p-produto");
    if (!clienteSelect || !produtoSelect) return;

    let cliQuery = db.collection("clientes");
    if (PERFIL === "representante") {
      cliQuery = cliQuery.where("userId", "==", user.uid);
    }

    const cliSnap = await cliQuery.orderBy("nome").get();
    clienteSelect.innerHTML = `<option value="">Selecione cliente</option>`;
    cliSnap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().nome;
      opt.textContent = doc.data().nome;
      opt.dataset.id = doc.id;
      clienteSelect.appendChild(opt);
    });

    preencherSelectProduto(produtoSelect, listaProdutos);
    formatarInputQuantidadePedido(document.getElementById("p-qtd"));
    document.getElementById("p-responsavel").value = REPRESENTANTE_ATUAL || "";

    function adicionarLinhaProduto() {
      const containerItens = document.getElementById("p-itens");
      const primeiraLinha = containerItens?.querySelector(".pedido-item");
      if (!containerItens || !primeiraLinha) return;

      const novaLinha = primeiraLinha.cloneNode(true);
      novaLinha.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      preencherSelectProduto(novaLinha.querySelector(".pedido-produto"), listaProdutos);
      const inputQuantidade = novaLinha.querySelector(".pedido-qtd");
      if (inputQuantidade) inputQuantidade.value = "";
      formatarInputQuantidadePedido(inputQuantidade);
      novaLinha.querySelector(".btn-remover-produto")?.addEventListener("click", () => {
        novaLinha.remove();
        atualizarBotoesRemoverProduto();
      });
      containerItens.appendChild(novaLinha);
      atualizarBotoesRemoverProduto();
    }

    document.querySelector("#p-itens .btn-remover-produto")?.addEventListener("click", (e) => {
      e.currentTarget.closest(".pedido-item")?.remove();
      atualizarBotoesRemoverProduto();
    });
    atualizarBotoesRemoverProduto();
    document.getElementById("btn-adicionar-produto")?.addEventListener("click", adicionarLinhaProduto);

    let pedidoEmEnvio = false;
    document.getElementById("btn-pedido")?.addEventListener("click", async () => {
      if (pedidoEmEnvio) return;

      const btnPedido = document.getElementById("btn-pedido");
      const btnCancelar = document.getElementById("btn-cancelar-modal-pedido");
      const msgEnviando = document.getElementById("msg-enviando-pedido");
      const cliente = clienteSelect.value;
      const clienteDocId = clienteSelect.selectedOptions[0]?.dataset.id || "";
      const itens = Array.from(document.querySelectorAll("#p-itens .pedido-item"))
        .map((linha) => {
          const produtoNome = linha.querySelector(".pedido-produto")?.value || "";
          const valor = (linha.querySelector(".pedido-qtd")?.value || "").replace(/\./g, "");
          return { produtoNome, quantidade: parseInt(valor, 10) || 0 };
        })
        .filter((item) => item.produtoNome && item.quantidade > 0);
      const prazo = document.getElementById("p-prazo").value;
      const obs = document.getElementById("p-obs").value;
      const responsavel = document.getElementById("p-responsavel")?.value.trim() || REPRESENTANTE_ATUAL || "Administrativo";

      if (!prazo) return alert("Selecione o prazo de pagamento.");
      if (!cliente || !itens.length) return alert("Selecione pelo menos um produto com quantidade.");

      pedidoEmEnvio = true;
      try {
        btnPedido.disabled = true;
        btnPedido.textContent = "Enviando...";
        if (btnCancelar) btnCancelar.disabled = true;
        msgEnviando?.classList.remove("hidden");

        const codigo = await gerarCodigoPedidoUnico();
        let clienteSnapshot = {};
        let pedidoUserId = user.uid;

        try {
          let clienteDoc = null;
          if (clienteDocId) {
            const docCliente = await db.collection("clientes").doc(clienteDocId).get();
            if (docCliente.exists) clienteDoc = docCliente.data() || {};
          }

          if (!clienteDoc) {
            let clienteQuery = db.collection("clientes").where("nome", "==", cliente).limit(1);
            if (PERFIL === "representante") {
              clienteQuery = db.collection("clientes")
                .where("userId", "==", user.uid)
                .where("nome", "==", cliente)
                .limit(1);
            }
            const clienteSnap = await clienteQuery.get();
            if (!clienteSnap.empty) clienteDoc = clienteSnap.docs[0].data() || {};
          }

          if (clienteDoc) {
            pedidoUserId = clienteDoc.userId || user.uid;
            clienteSnapshot = {
              clienteCnpj: clienteDoc.cnpj || "",
              clienteWhatsapp: clienteDoc.whatsapp || "",
              clienteIe: clienteDoc.ie || "",
              clienteEndereco: clienteDoc.endereco || "",
              clienteNumero: clienteDoc.numero || "",
              clienteBairro: clienteDoc.bairro || "",
              clienteCidade: clienteDoc.cidade || "",
              clienteUf: clienteDoc.uf || ""
            };
          }
        } catch (e) {
          console.warn("Nao foi possivel carregar snapshot do cliente.", e);
        }

        const quantidade = itens.reduce((total, item) => total + item.quantidade, 0);
        await db.collection("pedidos").add({
          codigo,
          userId: pedidoUserId,
          clienteNome: cliente,
          produtoNome: itens[0]?.produtoNome || "",
          produtosResumo: itens.map((item) => `${item.produtoNome} (${formatQuantidade(item.quantidade)})`).join(", "),
          itens,
          prazoPagamento: prazo,
          observacao: obs,
          quantidade,
          representanteNome: responsavel,
          status: "pendente",
          criadoPorAdmin: PERFIL === "admin",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          ...clienteSnapshot
        });

        const adminsSnap = await db.collection("usuarios")
          .where("perfil", "==", "admin")
          .get();

        await Promise.all(adminsSnap.docs
          .map(doc => {
            const dados = doc.data() || {};
            return dados.uid || dados.userId || doc.id;
          })
          .filter(Boolean)
          .map(adminUid => db.collection("notificacoes").add({
            userId: adminUid,
            pedidoId: codigo,
            texto: `Novo pedido ${codigo} recebido de ${responsavel}`,
            lida: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          })));

        alert("Pedido enviado para aprovacao!");
        document.getElementById("modal-pedido")?.classList.add("hidden");
      } catch (e) {
        console.error(e);
        alert("Erro ao enviar pedido. Tente novamente.");
      } finally {
        pedidoEmEnvio = false;
        btnPedido.disabled = false;
        btnPedido.textContent = "Enviar Pedido";
        if (btnCancelar) btnCancelar.disabled = false;
        msgEnviando?.classList.add("hidden");
      }
    });
  }

  window.renderPedidos = function renderPedidosCorrigido() {
    atualizarCabecalhoDashboard("pedidos");

    const pageContent = document.getElementById("page-content");
    pageContent.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Pedidos</h2>

      ${["representante", "admin"].includes(PERFIL) ? `
        <div class="bg-white p-4 rounded shadow mb-4">
          <button id="btn-abrir-modal-pedido" type="button" class="w-full md:w-auto text-white p-2 rounded" style="background-color: #E67E22;">+ Novo Pedido</button>
          <div id="modal-pedido" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-0 md:p-4">
            <div class="bg-white w-full md:max-w-2xl md:mx-auto md:mt-12 rounded-t-2xl md:rounded-xl p-4 md:p-6 max-h-[92vh] overflow-y-auto absolute bottom-0 left-0 right-0 md:static space-y-2">
              <h3 class="text-lg font-bold mb-2">Novo Pedido</h3>
              <select id="p-cliente" class="border p-2 w-full"></select>
              <div id="p-itens" class="space-y-2">
                <div class="pedido-item grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <select id="p-produto" class="pedido-produto border p-2 w-full md:col-span-7"></select>
                  <input id="p-qtd" type="text" class="pedido-qtd border p-2 w-full md:col-span-4" placeholder="Quantidade">
                  <button type="button" class="btn-remover-produto hidden bg-red-600 text-white p-2 rounded md:col-span-1">x</button>
                </div>
              </div>
              <button id="btn-adicionar-produto" type="button" class="border border-blue-600 text-blue-700 p-2 rounded w-full">+ Adicionar outro produto</button>
              <select id="p-prazo" class="border p-2 w-full" required>
                <option value="" selected disabled>Prazo de pagamento *</option>
                <option value="À vista">À vista</option>
                <option value="10 dias">10 dias</option>
                <option value="15 dias">15 dias</option>
                <option value="30 dias">30 dias</option>
                <option value="30/60 dias">30/60 dias</option>
              </select>
              <input id="p-responsavel" type="text" class="border p-2 w-full" placeholder="Representante/responsavel">
              <input id="p-obs" type="text" class="border p-2 w-full" placeholder="Observacoes (opcional)">
              <p id="msg-enviando-pedido" class="hidden text-center text-sm font-semibold text-blue-700">ENVIANDO SEU PEDIDO...</p>
              <button id="btn-pedido" class="bg-blue-600 text-white p-2 rounded w-full">Enviar Pedido</button>
              <button id="btn-cancelar-modal-pedido" type="button" class="bg-gray-400 text-white p-2 rounded w-full">Cancelar</button>
            </div>
          </div>
        </div>
      ` : ""}

      <div class="flex items-center justify-between mb-3">
        <button id="mes-anterior" class="px-3 py-1 bg-gray-200 rounded">←</button>
        <span id="mes-atual" class="font-bold"></span>
        <button id="mes-proximo" class="px-3 py-1 bg-gray-200 rounded">→</button>
      </div>

      <div class="bg-white p-3 rounded shadow mb-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-semibold text-gray-700 mb-1">Status</span>
            <select id="filtro-status-pedidos" class="border p-2 rounded w-full">
              <option value="todos" ${pedidosFiltroStatus === "todos" ? "selected" : ""}>Todos</option>
              <option value="pendente" ${pedidosFiltroStatus === "pendente" ? "selected" : ""}>Pendente</option>
              <option value="aprovado" ${pedidosFiltroStatus === "aprovado" ? "selected" : ""}>Aprovado</option>
              <option value="cancelado" ${pedidosFiltroStatus === "cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </label>

          ${PERFIL === "admin" ? `
            <form id="filtro-representante-form" class="block">
              <span class="block text-sm font-semibold text-gray-700 mb-1">Representante</span>
              <div class="flex gap-2">
                <input id="filtro-representante-pedidos" type="search" class="border p-2 rounded w-full" value="${pedidosFiltroRepresentante}" placeholder="Buscar por representante">
                <button type="submit" class="bg-blue-600 text-white px-3 py-2 rounded">Buscar</button>
              </div>
            </form>
          ` : ""}
        </div>
      </div>

      <div id="lista-pedidos" class="space-y-2"></div>
    `;

    const lista = document.getElementById("lista-pedidos");
    const mesAtualEl = document.getElementById("mes-atual");

    document.getElementById("mes-anterior").onclick = () => {
      pedidosDataAtual = new Date(pedidosDataAtual.getFullYear(), pedidosDataAtual.getMonth() - 1, 1);
      window.renderPedidos();
    };

    document.getElementById("mes-proximo").onclick = () => {
      pedidosDataAtual = new Date(pedidosDataAtual.getFullYear(), pedidosDataAtual.getMonth() + 1, 1);
      window.renderPedidos();
    };

    document.getElementById("filtro-status-pedidos").addEventListener("change", (e) => {
      pedidosFiltroStatus = e.target.value;
      window.renderPedidos();
    });

    document.getElementById("filtro-representante-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      pedidosFiltroRepresentante = document.getElementById("filtro-representante-pedidos")?.value.trim() || "";
      window.renderPedidos();
    });

    document.getElementById("btn-abrir-modal-pedido")?.addEventListener("click", () => {
      document.getElementById("modal-pedido")?.classList.remove("hidden");
    });
    document.getElementById("btn-cancelar-modal-pedido")?.addEventListener("click", () => {
      document.getElementById("modal-pedido")?.classList.add("hidden");
    });

    waitForAuth().then(async user => {
      if (!PERFIL) await carregarUsuario();

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
      await configurarNovoPedido(user, listaProdutos);

      let query = db.collection("pedidos");
      if (PERFIL === "representante") {
        query = query.where("userId", "==", user.uid);
      }

      if (unsubscribePedidos) {
        unsubscribePedidos();
        unsubscribePedidos = null;
      }

      unsubscribePedidos = query.orderBy("createdAt", "desc").onSnapshot(snap => {
        lista.innerHTML = "";
        const mesSelecionado = formatarMes(pedidosDataAtual);
        mesAtualEl.textContent = mesSelecionado;

        if (snap.empty) {
          lista.innerHTML = `<p class="text-gray-500">Nenhum pedido.</p>`;
          return;
        }

        const pedidos = [];
        const anoSelecionado = pedidosDataAtual.getFullYear();
        const mesSelecionadoIndex = pedidosDataAtual.getMonth();

        snap.forEach(doc => {
          const p = doc.data();
          const data = dataCriacaoPedido(p);
          if (!data || Number.isNaN(data.getTime())) return;

          const mesmoMes =
            data.getFullYear() === anoSelecionado &&
            data.getMonth() === mesSelecionadoIndex;
          const mesmoStatus =
            pedidosFiltroStatus === "todos" ||
            String(p.status || "").toLowerCase() === pedidosFiltroStatus;
          const termoRepresentante = normalizarNomeRepresentante(pedidosFiltroRepresentante);
          const mesmoRepresentante =
            PERFIL !== "admin" ||
            !termoRepresentante ||
            normalizarNomeRepresentante(p.representanteNome).includes(termoRepresentante);

          if (mesmoMes && mesmoStatus && mesmoRepresentante) {
            pedidos.push({ id: doc.id, ...p });
          }
        });

        if (!pedidos.length) {
          lista.innerHTML = `<p class="text-gray-500">Nenhum pedido encontrado para os filtros selecionados.</p>`;
          return;
        }

        const header = document.createElement("div");
        header.className = "bg-gray-200 p-2 rounded font-bold";
        header.textContent = mesSelecionado;

        const container = document.createElement("div");
        container.className = "space-y-2 mt-2";
        pedidos.forEach(p => container.appendChild(montarPedidoCard(p)));

        lista.appendChild(header);
        lista.appendChild(container);
      });
    });
  };

  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.addEventListener("click", () => atualizarCabecalhoDashboard(btn.dataset.page));
  });
})();
