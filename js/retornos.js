Attempting to perform the InitializeDefaultDrives operation on the 'FileSystem' provider failed.
// ================== AGENDA DE RETORNOS ==================
(function () {
  "use strict";

  const COLECAO = "retornosClientes";

  function escapeHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function agoraLocalInput(data = new Date()) {
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function formatarDataHora(valor) {
    if (!valor) return "Sem data";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function inicioDoDia(data = new Date()) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate());
  }

  function fimDoDia(data = new Date()) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);
  }

  function normalizarWhatsapp(valor) {
    const digitos = String(valor || "").replace(/\D/g, "");
    if (!digitos) return "";
    return digitos.startsWith("55") ? digitos : `55${digitos}`;
  }

  function abrirWhatsapp(retorno) {
    const numero = normalizarWhatsapp(retorno.clienteWhatsapp);
    if (!numero) {
      alert("Este cliente não possui WhatsApp cadastrado.");
      return;
    }
    const mensagem = `Olá, ${retorno.clienteNome || "cliente"}. Estou entrando em contato para dar continuidade ao seu atendimento.`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
  }

  function classificar(retorno, agora = new Date()) {
    if (retorno.status === "concluido") return "concluidos";
    const data = new Date(retorno.retornoEm || "");
    if (Number.isNaN(data.getTime())) return "proximos";
    if (data < inicioDoDia(agora)) return "atrasados";
    if (data <= fimDoDia(agora)) return "hoje";
    return "proximos";
  }

  function prioridadeVisual(prioridade) {
    if (prioridade === "urgente") return { nome: "Urgente", classe: "bg-red-100 text-red-700", borda: "border-red-500" };
    if (prioridade === "importante") return { nome: "Importante", classe: "bg-orange-100 text-orange-700", borda: "border-orange-500" };
    return { nome: "Normal", classe: "bg-blue-100 text-blue-700", borda: "border-blue-500" };
  }

  async function processarLembretesRetornos() {
    if (window.__PROCESSANDO_RETORNOS__ || typeof db === "undefined" || typeof waitForAuth !== "function") return;
    window.__PROCESSANDO_RETORNOS__ = true;

    try {
      const user = await waitForAuth();
      const agora = new Date();
      const snap = await db.collection(COLECAO).where("userId", "==", user.uid).get();

      for (const documento of snap.docs) {
        const retorno = documento.data() || {};
        const horario = new Date(retorno.retornoEm || "");
        if (
          retorno.status === "concluido" ||
          retorno.lembreteNotificado === true ||
          Number.isNaN(horario.getTime()) ||
          horario > agora
        ) continue;

        const deveNotificar = await db.runTransaction(async (transacao) => {
          const atual = await transacao.get(documento.ref);
          const dados = atual.data() || {};
          if (!atual.exists || dados.status === "concluido" || dados.lembreteNotificado === true) return false;
          transacao.update(documento.ref, {
            lembreteNotificado: true,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
          });
          return true;
        });

        if (!deveNotificar) continue;
        await db.collection("notificacoes").add({
          userId: user.uid,
          retornoId: documento.id,
          tipo: "lembrete_retorno",
          texto: `⏰ Retornar para ${retorno.clienteNome || "cliente"}: ${String(retorno.anotacao || "").slice(0, 180)}`,
          lida: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (erro) {
      console.error("Erro ao processar lembretes de retorno:", erro);
    } finally {
      window.__PROCESSANDO_RETORNOS__ = false;
    }
  }

  function iniciarMonitorRetornos() {
    if (window.__INTERVALO_RETORNOS__) return;
    processarLembretesRetornos();
    window.__INTERVALO_RETORNOS__ = setInterval(processarLembretesRetornos, 60000);
  }

  function renderRetornos() {
    pageContent.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold">Agenda de Retornos</h2>
            <p class="text-sm text-gray-500">Organize contatos, lembretes e acompanhamentos dos clientes.</p>
          </div>
          <button id="novo-retorno" class="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto">+ Novo retorno</button>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button data-aba="hoje" class="aba-retorno bg-white rounded shadow p-3 text-left border-2 border-blue-600">
            <div class="text-xs text-gray-500">Hoje</div><div data-contador="hoje" class="text-2xl font-bold text-blue-700">0</div>
          </button>
          <button data-aba="atrasados" class="aba-retorno bg-white rounded shadow p-3 text-left border-2 border-transparent">
            <div class="text-xs text-gray-500">Atrasados</div><div data-contador="atrasados" class="text-2xl font-bold text-red-700">0</div>
          </button>
          <button data-aba="proximos" class="aba-retorno bg-white rounded shadow p-3 text-left border-2 border-transparent">
            <div class="text-xs text-gray-500">Próximos</div><div data-contador="proximos" class="text-2xl font-bold text-orange-700">0</div>
          </button>
          <button data-aba="concluidos" class="aba-retorno bg-white rounded shadow p-3 text-left border-2 border-transparent">
            <div class="text-xs text-gray-500">Concluídos</div><div data-contador="concluidos" class="text-2xl font-bold text-green-700">0</div>
          </button>
        </div>

        <div class="bg-white rounded shadow p-3 flex flex-col sm:flex-row gap-2">
          <input id="buscar-retorno" type="search" class="border p-2 rounded flex-1" placeholder="Buscar cliente ou anotação">
          <select id="filtrar-prioridade" class="border p-2 rounded">
            <option value="">Todas as prioridades</option>
            <option value="urgente">Urgente</option>
            <option value="importante">Importante</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div id="lista-retornos" class="space-y-3"></div>
      </div>

      <div id="modal-retorno" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-3 overflow-y-auto">
        <div class="bg-white max-w-xl mx-auto my-6 rounded-xl shadow-xl overflow-hidden">
          <div class="px-5 py-4 border-b flex justify-between items-center">
            <div><h3 id="titulo-modal-retorno" class="font-bold text-lg">Novo retorno</h3><p class="text-xs text-gray-500">Uma tarefa rápida para um cliente.</p></div>
            <button type="button" data-fechar-modal class="text-2xl text-gray-500">×</button>
          </div>
          <form id="form-retorno" class="p-5 space-y-4">
            <label class="block"><span class="block text-sm font-semibold mb-1">Cliente *</span>
              <select id="retorno-cliente" class="border p-2 rounded w-full" required><option value="">Selecione o cliente</option></select>
            </label>
            <label class="block"><span class="block text-sm font-semibold mb-1">O que precisa ser feito? *</span>
              <textarea id="retorno-anotacao" class="border p-2 rounded w-full" rows="3" required placeholder="Ex.: Ligar para confirmar quantidade e prazo"></textarea>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label><span class="block text-sm font-semibold mb-1">Data e horário *</span><input id="retorno-data" type="datetime-local" class="border p-2 rounded w-full" required></label>
              <label><span class="block text-sm font-semibold mb-1">Prioridade</span>
                <select id="retorno-prioridade" class="border p-2 rounded w-full"><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select>
              </label>
            </div>
            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" data-fechar-modal class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
              <button id="salvar-retorno" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar retorno</button>
            </div>
          </form>
        </div>
      </div>

      <div id="modal-adiar" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-3 overflow-y-auto">
        <div class="bg-white max-w-md mx-auto my-20 rounded-xl shadow-xl p-5 space-y-4">
          <div class="flex justify-between items-center"><h3 class="font-bold text-lg">Adiar retorno</h3><button type="button" data-fechar-adiar class="text-2xl text-gray-500">×</button></div>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" data-atalho-adiar="amanha" class="border border-blue-600 text-blue-700 p-2 rounded">Amanhã às 9h</button>
            <button type="button" data-atalho-adiar="semana" class="border border-blue-600 text-blue-700 p-2 rounded">Daqui a 7 dias</button>
          </div>
          <label class="block"><span class="block text-sm font-semibold mb-1">Escolher data e horário</span><input id="nova-data-retorno" type="datetime-local" class="border p-2 rounded w-full"></label>
          <button id="confirmar-adiamento" type="button" class="bg-blue-600 text-white px-4 py-2 rounded w-full">Confirmar nova data</button>
        </div>
      </div>

      <div id="modal-concluir" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-3 overflow-y-auto">
        <div class="bg-white max-w-md mx-auto my-20 rounded-xl shadow-xl p-5 space-y-4">
          <div class="flex justify-between items-center"><h3 class="font-bold text-lg">Concluir atendimento</h3><button type="button" data-fechar-concluir class="text-2xl text-gray-500">×</button></div>
          <label class="block"><span class="block text-sm font-semibold mb-1">Resultado do atendimento (opcional)</span><textarea id="resultado-retorno" class="border p-2 rounded w-full" rows="3" placeholder="Ex.: Cliente confirmou o pedido"></textarea></label>
          <button id="confirmar-conclusao" type="button" class="bg-green-600 text-white px-4 py-2 rounded w-full">Marcar como concluído</button>
        </div>
      </div>
    `;

    const lista = document.getElementById("lista-retornos");
    const busca = document.getElementById("buscar-retorno");
    const filtroPrioridade = document.getElementById("filtrar-prioridade");
    const modal = document.getElementById("modal-retorno");
    const modalAdiar = document.getElementById("modal-adiar");
    const modalConcluir = document.getElementById("modal-concluir");
    const form = document.getElementById("form-retorno");
    const clienteSelect = document.getElementById("retorno-cliente");
    const botaoSalvar = document.getElementById("salvar-retorno");
    let retornos = [];
    let abaAtual = "hoje";
    let editandoId = "";
    let acaoId = "";

    function fecharModal() {
      modal.classList.add("hidden");
      form.reset();
      editandoId = "";
    }

    function abrirModal(retorno = null) {
      editandoId = retorno?.id || "";
      document.getElementById("titulo-modal-retorno").textContent = retorno ? "Editar retorno" : "Novo retorno";
      clienteSelect.value = retorno?.clienteId || "";
      document.getElementById("retorno-anotacao").value = retorno?.anotacao || "";
      document.getElementById("retorno-prioridade").value = retorno?.prioridade || "normal";
      const padrao = new Date(Date.now() + 60 * 60 * 1000);
      document.getElementById("retorno-data").value = retorno?.retornoEm || agoraLocalInput(padrao);
      modal.classList.remove("hidden");
      setTimeout(() => (retorno ? document.getElementById("retorno-anotacao") : clienteSelect).focus(), 50);
    }

    function mudarAba(aba) {
      abaAtual = aba;
      document.querySelectorAll(".aba-retorno").forEach(botao => {
        botao.classList.toggle("border-blue-600", botao.dataset.aba === aba);
        botao.classList.toggle("border-transparent", botao.dataset.aba !== aba);
      });
      renderizar();
    }

    function atualizarContadores() {
      ["hoje", "atrasados", "proximos", "concluidos"].forEach(tipo => {
        const elemento = document.querySelector(`[data-contador="${tipo}"]`);
        if (elemento) elemento.textContent = retornos.filter(item => classificar(item) === tipo).length;
      });
    }

    function renderizar() {
      atualizarContadores();
      const termo = String(busca.value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const prioridadeFiltro = filtroPrioridade.value;
      const visiveis = retornos
        .filter(item => classificar(item) === abaAtual)
        .filter(item => !prioridadeFiltro || item.prioridade === prioridadeFiltro)
        .filter(item => {
          const texto = `${item.clienteNome || ""} ${item.anotacao || ""} ${item.resultado || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          return !termo || texto.includes(termo);
        })
        .sort((a, b) => new Date(a.retornoEm || 0) - new Date(b.retornoEm || 0));

      if (!visiveis.length) {
        const textos = { hoje: "Nenhum retorno para hoje.", atrasados: "Nenhum retorno atrasado.", proximos: "Nenhum próximo retorno.", concluidos: "Nenhum atendimento concluído." };
        lista.innerHTML = `<div class="bg-white rounded shadow p-8 text-center text-gray-500">${textos[abaAtual]}</div>`;
        return;
      }

      lista.innerHTML = visiveis.map(item => {
        const prioridade = prioridadeVisual(item.prioridade);
        const concluido = item.status === "concluido";
        return `
          <article class="bg-white rounded-lg shadow border-l-4 ${prioridade.borda} p-4">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="font-bold text-lg text-gray-800">${escapeHtml(item.clienteNome || "Cliente")}</h3>
                  <span class="text-xs px-2 py-1 rounded-full ${prioridade.classe}">${prioridade.nome}</span>
                </div>
                <p class="mt-2 text-gray-700 whitespace-pre-wrap">${escapeHtml(item.anotacao || "")}</p>
                <div class="mt-2 text-sm ${classificar(item) === "atrasados" ? "text-red-700 font-semibold" : "text-gray-500"}">🗓️ ${escapeHtml(formatarDataHora(item.retornoEm))}</div>
                ${item.resultado ? `<div class="mt-3 bg-green-50 border border-green-100 rounded p-2 text-sm"><strong>Resultado:</strong> ${escapeHtml(item.resultado)}</div>` : ""}
              </div>
              <div class="flex flex-wrap gap-2 sm:justify-end">
                ${!concluido ? `<button data-acao="whatsapp" data-id="${item.id}" class="bg-green-600 text-white px-3 py-2 rounded text-sm">WhatsApp</button><button data-acao="adiar" data-id="${item.id}" class="bg-orange-500 text-white px-3 py-2 rounded text-sm">Adiar</button><button data-acao="concluir" data-id="${item.id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm">✓ Concluir</button>` : `<button data-acao="reabrir" data-id="${item.id}" class="bg-yellow-500 text-white px-3 py-2 rounded text-sm">Reabrir</button>`}
                <button data-acao="editar" data-id="${item.id}" class="bg-gray-600 text-white px-3 py-2 rounded text-sm">Editar</button>
                <button data-acao="excluir" data-id="${item.id}" class="border border-red-500 text-red-600 px-3 py-2 rounded text-sm">Excluir</button>
              </div>
            </div>
          </article>`;
      }).join("");
    }

    document.getElementById("novo-retorno").addEventListener("click", () => abrirModal());
    document.querySelectorAll("[data-fechar-modal]").forEach(botao => botao.addEventListener("click", fecharModal));
    document.querySelectorAll(".aba-retorno").forEach(botao => botao.addEventListener("click", () => mudarAba(botao.dataset.aba)));
    busca.addEventListener("input", renderizar);
    filtroPrioridade.addEventListener("change", renderizar);

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const opcao = clienteSelect.options[clienteSelect.selectedIndex];
      const clienteId = clienteSelect.value;
      const clienteNome = opcao?.dataset.nome || opcao?.textContent || "";
      const clienteWhatsapp = opcao?.dataset.whatsapp || "";
      const anotacao = document.getElementById("retorno-anotacao").value.trim();
      const retornoEm = document.getElementById("retorno-data").value;
      const prioridade = document.getElementById("retorno-prioridade").value;
      if (!clienteId || !anotacao || !retornoEm) return;

      botaoSalvar.disabled = true;
      try {
        const user = await waitForAuth();
        const dados = {
          userId: user.uid,
          clienteId,
          clienteNome,
          clienteWhatsapp,
          anotacao,
          retornoEm,
          prioridade,
          lembreteNotificado: false,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (editandoId) {
          await db.collection(COLECAO).doc(editandoId).update(dados);
        } else {
          await db.collection(COLECAO).add({ ...dados, status: "pendente", resultado: "", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        fecharModal();
      } catch (erro) {
        console.error(erro);
        alert("Não foi possível salvar o retorno.");
      } finally {
        botaoSalvar.disabled = false;
      }
    });

    lista.addEventListener("click", async (evento) => {
      const botao = evento.target.closest("[data-acao]");
      if (!botao) return;
      const retorno = retornos.find(item => item.id === botao.dataset.id);
      if (!retorno) return;
      const acao = botao.dataset.acao;

      if (acao === "whatsapp") return abrirWhatsapp(retorno);
      if (acao === "editar") return abrirModal(retorno);
      if (acao === "adiar") {
        acaoId = retorno.id;
        document.getElementById("nova-data-retorno").value = retorno.retornoEm || agoraLocalInput();
        modalAdiar.classList.remove("hidden");
        return;
      }
      if (acao === "concluir") {
        acaoId = retorno.id;
        document.getElementById("resultado-retorno").value = "";
        modalConcluir.classList.remove("hidden");
        return;
      }
      if (acao === "reabrir") {
        await db.collection(COLECAO).doc(retorno.id).update({ status: "pendente", concluidoEm: null, lembreteNotificado: false, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
        return;
      }
      if (acao === "excluir" && confirm(`Excluir o retorno de ${retorno.clienteNome}?`)) {
        await db.collection(COLECAO).doc(retorno.id).delete();
      }
    });

    document.querySelectorAll("[data-fechar-adiar]").forEach(botao => botao.addEventListener("click", () => modalAdiar.classList.add("hidden")));
    document.querySelectorAll("[data-fechar-concluir]").forEach(botao => botao.addEventListener("click", () => modalConcluir.classList.add("hidden")));
    document.querySelectorAll("[data-atalho-adiar]").forEach(botao => botao.addEventListener("click", () => {
      const data = new Date();
      if (botao.dataset.atalhoAdiar === "amanha") {
        data.setDate(data.getDate() + 1); data.setHours(9, 0, 0, 0);
      } else {
        data.setDate(data.getDate() + 7);
      }
      document.getElementById("nova-data-retorno").value = agoraLocalInput(data);
    }));

    document.getElementById("confirmar-adiamento").addEventListener("click", async () => {
      const retornoEm = document.getElementById("nova-data-retorno").value;
      if (!acaoId || !retornoEm) return alert("Escolha a nova data e horário.");
      await db.collection(COLECAO).doc(acaoId).update({ retornoEm, status: "pendente", lembreteNotificado: false, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
      modalAdiar.classList.add("hidden");
    });

    document.getElementById("confirmar-conclusao").addEventListener("click", async () => {
      if (!acaoId) return;
      const resultado = document.getElementById("resultado-retorno").value.trim();
      await db.collection(COLECAO).doc(acaoId).update({ status: "concluido", resultado, concluidoEm: firebase.firestore.FieldValue.serverTimestamp(), atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
      modalConcluir.classList.add("hidden");
    });

    waitForAuth().then(async (user) => {
      try {
        const clientesSnap = await getClientesFiltrados();
        const clientes = clientesSnap.docs.map(documento => ({ id: documento.id, ...(documento.data() || {}) })).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
        clientes.forEach(cliente => {
          const option = new Option(cliente.nome || "Cliente sem nome", cliente.id);
          option.dataset.nome = cliente.nome || "";
          option.dataset.whatsapp = cliente.whatsapp || "";
          clienteSelect.appendChild(option);
        });

        if (window.__UNSUB_RETORNOS__) window.__UNSUB_RETORNOS__();
        window.__UNSUB_RETORNOS__ = db.collection(COLECAO).where("userId", "==", user.uid).onSnapshot((snap) => {
          retornos = snap.docs.map(documento => ({ id: documento.id, ...(documento.data() || {}) }));
          renderizar();
        }, (erro) => {
          console.error("Erro ao carregar retornos:", erro);
          lista.innerHTML = `<div class="bg-white rounded shadow p-5 text-red-600">Não foi possível carregar a agenda de retornos.</div>`;
        });
      } catch (erro) {
        console.error("Erro ao iniciar agenda de retornos:", erro);
        lista.innerHTML = `<div class="bg-white rounded shadow p-5 text-red-600">Não foi possível iniciar a agenda de retornos.</div>`;
      }
    });
  }

  window.renderRetornos = renderRetornos;
  window.processarLembretesRetornos = processarLembretesRetornos;
  window.addEventListener("load", () => setTimeout(iniciarMonitorRetornos, 1500));
})();

