// ================== CENTRAL DE ANOTAÇÕES ==================
function escapeHtmlNota(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarDataNota(data) {
  if (!data) return "-";
  const [ano, mes, dia] = String(data).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : String(data);
}

function formatarLembreteNota(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR");
}

function normalizarClientesDaNota(nota) {
  const clientes = Array.isArray(nota?.clientes) ? nota.clientes : [];
  const notaConcluida = String(nota?.status || "") === "concluida";

  return clientes.map((cliente, index) => ({
    cliente: cliente?.cliente || "",
    produtos: Array.isArray(cliente?.produtos) ? cliente.produtos : [],
    status: cliente?.status || (notaConcluida ? "concluida" : "pendente"),
    lembreteEm: cliente?.lembreteEm || (index === 0 ? (nota?.lembreteEm || "") : ""),
    lembreteNotificado: typeof cliente?.lembreteNotificado === "boolean"
      ? cliente.lembreteNotificado
      : (index === 0 ? Boolean(nota?.lembreteNotificado) : false)
  }));
}

async function processarLembretesNotas() {
  if (window.__PROCESSANDO_LEMBRETES_NOTAS__) return;
  if (typeof db === "undefined" || typeof waitForAuth !== "function") return;

  window.__PROCESSANDO_LEMBRETES_NOTAS__ = true;

  try {
    const user = await waitForAuth();
    const agora = new Date();
    const snap = await db.collection("notas")
      .where("userId", "==", user.uid)
      .get();

    for (const doc of snap.docs) {
      const nota = doc.data() || {};
      const clientes = normalizarClientesDaNota(nota);

      for (let index = 0; index < clientes.length; index += 1) {
        const cliente = clientes[index];
        if (!cliente.lembreteEm || cliente.lembreteNotificado === true) continue;
        if (String(cliente.status || "pendente") === "concluida") continue;

        const dataLembrete = new Date(cliente.lembreteEm);
        if (Number.isNaN(dataLembrete.getTime()) || dataLembrete > agora) continue;

        const resultado = await db.runTransaction(async (transacao) => {
          const notaAtualSnap = await transacao.get(doc.ref);
          if (!notaAtualSnap.exists) return null;

          const notaAtual = notaAtualSnap.data() || {};
          const clientesAtuais = normalizarClientesDaNota(notaAtual);
          const clienteAtual = clientesAtuais[index];
          if (!clienteAtual) return null;

          const lembreteAtual = new Date(clienteAtual.lembreteEm || "");
          if (
            !clienteAtual.lembreteEm ||
            clienteAtual.lembreteNotificado === true ||
            String(clienteAtual.status || "pendente") === "concluida" ||
            Number.isNaN(lembreteAtual.getTime()) ||
            lembreteAtual > new Date()
          ) {
            return null;
          }

          clientesAtuais[index] = {
            ...clienteAtual,
            lembreteNotificado: true
          };

          transacao.update(doc.ref, {
            clientes: clientesAtuais,
            lembreteEm: "",
            lembreteNotificado: false,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
          });

          return {
            titulo: notaAtual.titulo || "Anotação",
            cliente: clienteAtual.cliente || "Cliente",
            observacao: String(notaAtual.observacaoGeral || "").trim()
          };
        });

        if (!resultado) continue;

        await db.collection("notificacoes").add({
          userId: user.uid,
          notaId: doc.id,
          tipo: "lembrete_nota",
          texto: `⏰ Lembrete: ${resultado.titulo} - ${resultado.cliente}.${resultado.observacao ? ` Observação: ${resultado.observacao.slice(0, 180)}` : ""}`,
          lida: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  } catch (e) {
    console.error("Erro ao verificar lembretes das anotações:", e);
  } finally {
    window.__PROCESSANDO_LEMBRETES_NOTAS__ = false;
  }
}

function iniciarMonitorLembretesNotas() {
  if (window.__INTERVALO_LEMBRETES_NOTAS__) return;
  processarLembretesNotas();
  window.__INTERVALO_LEMBRETES_NOTAS__ = setInterval(processarLembretesNotas, 60000);
}

function imprimirNota(nota) {
  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) {
    alert("Permita a abertura de janelas para imprimir.");
    return;
  }

  const clientes = normalizarClientesDaNota(nota);
  const logoUrl = new URL("img/logo.png", window.location.href).href;

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtmlNota(nota.titulo || "Anotação")}</title>
        <style>
          @page { size:A4; margin:14mm; }
          * { box-sizing:border-box; }
          body { margin:0; font:12px Arial,sans-serif; color:#1f2937; }
          header { display:flex; align-items:center; gap:14px; padding-bottom:12px; border-bottom:3px solid #f28c28; }
          header img { width:52px; height:52px; object-fit:contain; }
          h1 { margin:0 0 4px; color:#1f3b64; font-size:21px; }
          .meta { color:#6b7280; }
          .cliente { margin-top:12px; border:1px solid #dfe6f1; border-radius:8px; overflow:hidden; break-inside:avoid; }
          .cliente-head { padding:8px 10px; color:#fff; background:#1f3b64; }
          .cliente-head strong { font-size:13px; }
          .cliente-head div { margin-top:3px; font-size:10px; opacity:.9; }
          .produto { padding:8px 10px; border-bottom:1px solid #edf0f5; }
          .produto:last-child { border-bottom:0; }
          .produto strong { display:block; }
          .produto p { margin:4px 0 0; color:#4b5563; }
          .observacao { margin-top:14px; padding:12px; background:#fff7ed; border-left:4px solid #f28c28; white-space:pre-wrap; }
          footer { margin-top:16px; padding-top:8px; border-top:1px solid #dfe6f1; color:#6b7280; text-align:right; font-size:10px; }
          @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
        </style>
      </head>
      <body>
        <header>
          <img src="${logoUrl}" alt="Logo">
          <div>
            <h1>${escapeHtmlNota(nota.titulo || "Anotação")}</h1>
            <div class="meta">Data: ${formatarDataNota(nota.data)}</div>
          </div>
        </header>

        ${clientes.map(cliente => `
          <section class="cliente">
            <div class="cliente-head">
              <strong>${escapeHtmlNota(cliente.cliente || "Cliente")}</strong>
              <div>
                Status: ${cliente.status === "concluida" ? "Concluído" : "Pendente"}
                ${cliente.lembreteEm ? ` | Lembrete: ${escapeHtmlNota(formatarLembreteNota(cliente.lembreteEm))}` : ""}
              </div>
            </div>
            ${(cliente.produtos || []).map(produto => `
              <div class="produto">
                <strong>${escapeHtmlNota(produto.nome || "Produto")}</strong>
                ${produto.obs ? `<p>${escapeHtmlNota(produto.obs)}</p>` : ""}
              </div>
            `).join("")}
          </section>
        `).join("")}

        ${nota.observacaoGeral ? `
          <section class="observacao">
            <strong>Observação geral</strong><br>
            ${escapeHtmlNota(nota.observacaoGeral)}
          </section>
        ` : ""}

        <footer>Documento gerado pelo sistema de agendamento</footer>
      </body>
    </html>
  `);

  janela.onload = () => setTimeout(() => janela.print(), 250);
  janela.document.close();
}

function renderNotas() {
  pageContent.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold">Bloco de Anotações</h2>
          <p class="text-sm text-gray-500">Acompanhamentos e lembretes individuais por cliente.</p>
        </div>
        <button id="btn-nova-nota" class="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto">+ Nova Anotação</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-white p-3 rounded shadow border-l-4 border-yellow-500">
          <div class="text-xs text-gray-500">Clientes pendentes</div>
          <div id="contador-notas-pendentes" class="text-2xl font-bold text-yellow-700">0</div>
        </div>
        <div class="bg-white p-3 rounded shadow border-l-4 border-blue-500">
          <div class="text-xs text-gray-500">Clientes com lembrete</div>
          <div id="contador-notas-lembretes" class="text-2xl font-bold text-blue-700">0</div>
        </div>
        <div class="bg-white p-3 rounded shadow border-l-4 border-green-500">
          <div class="text-xs text-gray-500">Clientes concluídos</div>
          <div id="contador-notas-concluidas" class="text-2xl font-bold text-green-700">0</div>
        </div>
      </div>

      <div class="bg-white p-3 rounded shadow grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="filtro-notas-busca" type="search" class="border p-2 rounded w-full" placeholder="Buscar título, cliente ou produto">
        <select id="filtro-notas-status" class="border p-2 rounded w-full">
          <option value="pendentes">Com clientes pendentes</option>
          <option value="todas">Todas</option>
          <option value="concluidas">Totalmente concluídas</option>
          <option value="com-lembrete">Com lembrete pendente</option>
        </select>
        <input id="filtro-notas-data" type="date" class="border p-2 rounded w-full">
      </div>

      <div id="notas-list" class="space-y-3"></div>

      <div id="modal-nota" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-2 sm:p-4 overflow-y-auto">
        <div class="bg-white w-full max-w-2xl mx-auto my-6 rounded-xl shadow-lg overflow-hidden">
          <div class="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h3 id="modal-nota-titulo" class="text-lg font-bold">Nova Anotação</h3>
              <p class="text-xs text-gray-500">Cada cliente pode ter seu próprio lembrete e status.</p>
            </div>
            <button id="fechar-modal-nota" type="button" class="text-gray-500 text-2xl" aria-label="Fechar">×</button>
          </div>

          <form id="nota-form" class="p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="md:col-span-2">
                <span class="block text-sm font-semibold mb-1">Título *</span>
                <input id="nota-titulo" class="border p-2 rounded w-full" required placeholder="Ex.: Retornos comerciais da semana">
              </label>
              <label>
                <span class="block text-sm font-semibold mb-1">Data da anotação *</span>
                <input id="nota-data" type="date" class="border p-2 rounded w-full" required>
              </label>
            </div>

            <div class="border rounded-lg p-3 bg-gray-50 space-y-3">
              <div class="text-sm font-bold text-blue-900">Vincular cliente e produto</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select id="nota-cliente" class="border p-2 rounded w-full">
                  <option value="">Selecione o cliente</option>
                </select>
                <select id="nota-produto" class="border p-2 rounded w-full">
                  <option value="">Selecione o produto</option>
                </select>
              </div>
              <label class="block">
                <span class="block text-xs font-semibold text-gray-600 mb-1">Lembrete deste cliente</span>
                <input id="nota-lembrete-cliente" type="datetime-local" class="border p-2 rounded w-full">
              </label>
              <textarea id="nota-obs-produto" class="border p-2 rounded w-full" rows="2" placeholder="Observação deste produto para o cliente"></textarea>
              <button id="btn-add-produto" type="button" class="border border-blue-600 text-blue-700 px-3 py-2 rounded w-full">+ Vincular produto</button>
              <div id="preview-nota" class="space-y-2"></div>
            </div>

            <label class="block">
              <span class="block text-sm font-semibold mb-1">Observação geral</span>
              <textarea id="nota-texto" class="border p-2 rounded w-full" rows="4" placeholder="Detalhes gerais desta anotação"></textarea>
            </label>

            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button id="cancelar-modal-nota" type="button" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
              <button id="salvar-nota" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar Anotação</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const modal = document.getElementById("modal-nota");
  const form = document.getElementById("nota-form");
  const campoCliente = document.getElementById("nota-cliente");
  const campoProduto = document.getElementById("nota-produto");
  const campoLembreteCliente = document.getElementById("nota-lembrete-cliente");
  const campoObsProduto = document.getElementById("nota-obs-produto");
  const preview = document.getElementById("preview-nota");
  const lista = document.getElementById("notas-list");
  const filtroBusca = document.getElementById("filtro-notas-busca");
  const filtroStatus = document.getElementById("filtro-notas-status");
  const filtroData = document.getElementById("filtro-notas-data");
  let clientesNota = [];
  let notasAtuais = [];
  let notaEditando = null;

  const hojeIso = () => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  };

  function renderPreview() {
    if (!clientesNota.length) {
      preview.innerHTML = `<p class="text-xs text-gray-500">Nenhum cliente vinculado.</p>`;
      return;
    }

    preview.innerHTML = clientesNota.map((cliente, clienteIndex) => `
      <div class="bg-white border rounded p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold text-sm">${escapeHtmlNota(cliente.cliente)}</div>
          <span class="text-xs px-2 py-1 rounded-full ${cliente.status === "concluida" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}">
            ${cliente.status === "concluida" ? "Concluído" : "Pendente"}
          </span>
        </div>
        <label class="block mt-2">
          <span class="block text-xs text-gray-500 mb-1">Lembrete do cliente</span>
          <input type="datetime-local" data-lembrete-cliente-index="${clienteIndex}" value="${escapeHtmlNota(cliente.lembreteEm || "")}" class="lembrete-cliente-preview border p-2 rounded w-full text-sm">
        </label>
        <div class="mt-2 space-y-1">
          ${(cliente.produtos || []).map((produto, produtoIndex) => `
            <div class="flex items-start justify-between gap-2 text-sm bg-gray-50 rounded p-2">
              <div>
                <strong>${escapeHtmlNota(produto.nome)}</strong>
                ${produto.obs ? `<div class="text-gray-600">${escapeHtmlNota(produto.obs)}</div>` : ""}
              </div>
              <button type="button" data-cliente-index="${clienteIndex}" data-produto-index="${produtoIndex}" class="remover-produto-nota text-red-600">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function fecharModal() {
    modal.classList.add("hidden");
    form.reset();
    clientesNota = [];
    notaEditando = null;
    delete form.dataset.editId;
    renderPreview();
  }

  function abrirModal(nota = null) {
    notaEditando = nota;
    form.dataset.editId = nota?.id || "";
    document.getElementById("modal-nota-titulo").textContent = nota ? "Editar Anotação" : "Nova Anotação";
    document.getElementById("nota-titulo").value = nota?.titulo || "";
    document.getElementById("nota-data").value = nota?.data || hojeIso();
    document.getElementById("nota-texto").value = nota?.observacaoGeral || "";
    clientesNota = JSON.parse(JSON.stringify(normalizarClientesDaNota(nota || {})));
    campoLembreteCliente.value = "";
    renderPreview();
    modal.classList.remove("hidden");
    setTimeout(() => document.getElementById("nota-titulo").focus(), 50);
  }

  function todosClientes() {
    return notasAtuais.flatMap(nota => normalizarClientesDaNota(nota));
  }

  function atualizarContadores() {
    const clientes = todosClientes();
    document.getElementById("contador-notas-pendentes").textContent =
      clientes.filter(cliente => cliente.status !== "concluida").length;
    document.getElementById("contador-notas-lembretes").textContent =
      clientes.filter(cliente => cliente.status !== "concluida" && cliente.lembreteEm).length;
    document.getElementById("contador-notas-concluidas").textContent =
      clientes.filter(cliente => cliente.status === "concluida").length;
  }

  function renderizarNotas() {
    atualizarContadores();

    const termo = String(filtroBusca.value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    const statusFiltro = filtroStatus.value;
    const dataFiltro = filtroData.value;

    const filtradas = notasAtuais.filter(nota => {
      const clientes = normalizarClientesDaNota(nota);
      const pendentes = clientes.filter(cliente => cliente.status !== "concluida");
      const concluidas = clientes.filter(cliente => cliente.status === "concluida");
      if (statusFiltro === "pendentes" && !pendentes.length) return false;
      if (statusFiltro === "concluidas" && concluidas.length !== clientes.length) return false;
      if (statusFiltro === "com-lembrete" && !pendentes.some(cliente => cliente.lembreteEm)) return false;
      if (dataFiltro && nota.data !== dataFiltro) return false;

      const clientesTexto = clientes.flatMap(cliente => [
        cliente.cliente,
        ...(cliente.produtos || []).map(produto => produto.nome)
      ]).join(" ");
      const texto = `${nota.titulo || ""} ${nota.observacaoGeral || ""} ${clientesTexto}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return !termo || texto.includes(termo);
    });

    if (!filtradas.length) {
      lista.innerHTML = `<div class="bg-white p-5 rounded shadow text-gray-500">Nenhuma anotação encontrada.</div>`;
      return;
    }

    lista.innerHTML = filtradas.map(nota => {
      const clientes = normalizarClientesDaNota(nota);
      const concluidos = clientes.filter(cliente => cliente.status === "concluida").length;
      const totalmenteConcluida = clientes.length > 0 && concluidos === clientes.length;

      return `
        <article class="bg-white rounded-xl shadow border overflow-hidden ${totalmenteConcluida ? "opacity-75" : ""}">
          <div class="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <button type="button" data-acao-nota="alternar-detalhes" data-id="${nota.id}" class="text-left min-w-0 flex-1">
              <div class="font-semibold text-gray-800 ${totalmenteConcluida ? "line-through" : ""}">
                ${escapeHtmlNota(nota.titulo || "Sem título")}
              </div>
              <div class="text-sm text-gray-500 mt-1">
                ${formatarDataNota(nota.data)} - ${concluidos} de ${clientes.length} cliente(s) concluído(s)
              </div>
            </button>
            <div class="flex flex-wrap gap-2 text-sm">
              <button type="button" data-acao-nota="editar" data-id="${nota.id}" class="bg-yellow-500 text-white px-3 py-1 rounded">Editar</button>
              <button type="button" data-acao-nota="imprimir" data-id="${nota.id}" class="bg-blue-600 text-white px-3 py-1 rounded">Imprimir</button>
              <button type="button" data-acao-nota="excluir" data-id="${nota.id}" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button>
            </div>
          </div>

          <div id="detalhes-nota-${nota.id}" class="hidden border-t bg-gray-50 p-3 sm:p-4 space-y-3">
            ${clientes.map((cliente, clienteIndex) => {
              const concluido = cliente.status === "concluida";
              const lembreteData = cliente.lembreteEm ? new Date(cliente.lembreteEm) : null;
              const atrasado = lembreteData && !Number.isNaN(lembreteData.getTime()) && lembreteData <= new Date() && !concluido;
              return `
                <div class="bg-white border rounded-lg p-3">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div class="font-semibold text-blue-900 ${concluido ? "line-through" : ""}">${escapeHtmlNota(cliente.cliente || "Cliente")}</div>
                      <div class="flex flex-wrap gap-2 mt-1">
                        <span class="text-xs px-2 py-1 rounded-full ${concluido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}">
                          ${concluido ? "Concluído" : "Pendente"}
                        </span>
                        ${cliente.lembreteEm ? `
                          <span class="text-xs px-2 py-1 rounded-full ${atrasado ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}">
                            🔔 ${escapeHtmlNota(formatarLembreteNota(cliente.lembreteEm))}
                          </span>
                        ` : ""}
                      </div>
                    </div>
                    <button type="button" data-acao-nota="${concluido ? "reabrir-cliente" : "concluir-cliente"}" data-id="${nota.id}" data-cliente-index="${clienteIndex}" class="${concluido ? "bg-gray-200 text-gray-700" : "bg-green-600 text-white"} px-3 py-1 rounded">
                      ${concluido ? "Reabrir" : "Concluir"}
                    </button>
                  </div>

                  <div class="mt-3 space-y-2">
                    ${(cliente.produtos || []).map(produto => `
                      <div class="text-sm border-t pt-2">
                        <strong>${escapeHtmlNota(produto.nome || "Produto")}</strong>
                        ${produto.obs ? `<div class="text-gray-600">${escapeHtmlNota(produto.obs)}</div>` : ""}
                      </div>
                    `).join("")}
                  </div>
                </div>
              `;
            }).join("")}

            ${nota.observacaoGeral ? `
              <div class="p-3 bg-orange-50 border-l-4 border-orange-400 rounded text-sm whitespace-pre-wrap">
                ${escapeHtmlNota(nota.observacaoGeral)}
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  document.getElementById("btn-nova-nota").addEventListener("click", () => abrirModal());
  document.getElementById("fechar-modal-nota").addEventListener("click", fecharModal);
  document.getElementById("cancelar-modal-nota").addEventListener("click", fecharModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharModal();
  });

  preview.addEventListener("change", (e) => {
    const input = e.target.closest(".lembrete-cliente-preview");
    if (!input) return;
    const index = Number(input.dataset.lembreteClienteIndex);
    if (!clientesNota[index]) return;

    const mudou = String(clientesNota[index].lembreteEm || "") !== String(input.value || "");
    clientesNota[index].lembreteEm = input.value;
    if (mudou) clientesNota[index].lembreteNotificado = false;
  });

  preview.addEventListener("click", (e) => {
    const botao = e.target.closest(".remover-produto-nota");
    if (!botao) return;
    const clienteIndex = Number(botao.dataset.clienteIndex);
    const produtoIndex = Number(botao.dataset.produtoIndex);
    clientesNota[clienteIndex]?.produtos.splice(produtoIndex, 1);
    if (!clientesNota[clienteIndex]?.produtos.length) clientesNota.splice(clienteIndex, 1);
    renderPreview();
  });

  document.getElementById("btn-add-produto").addEventListener("click", () => {
    const cliente = campoCliente.value;
    const produto = campoProduto.value;
    const lembreteEm = campoLembreteCliente.value;
    const obs = campoObsProduto.value.trim();

    if (!cliente || !produto) {
      alert("Selecione cliente e produto.");
      return;
    }

    let grupoCliente = clientesNota.find(item => item.cliente === cliente);
    if (!grupoCliente) {
      grupoCliente = {
        cliente,
        produtos: [],
        status: "pendente",
        lembreteEm,
        lembreteNotificado: false
      };
      clientesNota.push(grupoCliente);
    } else if (lembreteEm && String(grupoCliente.lembreteEm || "") !== lembreteEm) {
      grupoCliente.lembreteEm = lembreteEm;
      grupoCliente.lembreteNotificado = false;
    }

    const produtoExistente = grupoCliente.produtos.find(item => item.nome === produto);
    if (produtoExistente) produtoExistente.obs = obs;
    else grupoCliente.produtos.push({ nome: produto, obs });

    campoObsProduto.value = "";
    campoLembreteCliente.value = "";
    renderPreview();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = await waitForAuth();
    const titulo = document.getElementById("nota-titulo").value.trim();
    const data = document.getElementById("nota-data").value;
    const observacaoGeral = document.getElementById("nota-texto").value.trim();

    if (!titulo || !data) {
      alert("Informe o título e a data.");
      return;
    }
    if (!clientesNota.length) {
      alert("Vincule pelo menos um cliente e produto.");
      return;
    }

    const todosConcluidos = clientesNota.every(cliente => cliente.status === "concluida");
    const payload = {
      titulo,
      data,
      clientes: clientesNota,
      observacaoGeral,
      status: todosConcluidos ? "concluida" : "pendente",
      lembreteEm: "",
      lembreteNotificado: false,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    const botaoSalvar = document.getElementById("salvar-nota");
    botaoSalvar.disabled = true;

    try {
      if (form.dataset.editId) {
        await db.collection("notas").doc(form.dataset.editId).update(payload);
      } else {
        await db.collection("notas").add({
          userId: user.uid,
          ...payload,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      fecharModal();
      processarLembretesNotas();
    } catch (erro) {
      console.error("Erro ao salvar anotação:", erro);
      alert("Não foi possível salvar a anotação.");
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  [filtroBusca, filtroStatus, filtroData].forEach(campo => {
    campo.addEventListener(campo.type === "search" ? "input" : "change", renderizarNotas);
  });

  lista.addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-acao-nota]");
    if (!botao) return;

    const nota = notasAtuais.find(item => item.id === botao.dataset.id);
    if (!nota) return;

    const acao = botao.dataset.acaoNota;
    if (acao === "alternar-detalhes") {
      document.getElementById(`detalhes-nota-${nota.id}`)?.classList.toggle("hidden");
      return;
    }
    if (acao === "editar") {
      abrirModal(nota);
      return;
    }
    if (acao === "imprimir") {
      imprimirNota(nota);
      return;
    }
    if (acao === "excluir") {
      if (!confirm(`Excluir a anotação "${nota.titulo}"?`)) return;
      await db.collection("notas").doc(nota.id).delete();
      return;
    }
    if (acao === "concluir-cliente" || acao === "reabrir-cliente") {
      const clienteIndex = Number(botao.dataset.clienteIndex);
      const clientes = normalizarClientesDaNota(nota);
      if (!clientes[clienteIndex]) return;

      clientes[clienteIndex].status =
        acao === "concluir-cliente" ? "concluida" : "pendente";
      const todosConcluidos = clientes.every(cliente => cliente.status === "concluida");

      await db.collection("notas").doc(nota.id).update({
        clientes,
        status: todosConcluidos ? "concluida" : "pendente",
        concluidaEm: todosConcluidos
          ? firebase.firestore.FieldValue.serverTimestamp()
          : null,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });

  waitForAuth().then(async (user) => {
    const [clientesSnap, produtosSnap] = await Promise.all([
      getClientesFiltrados(),
      db.collection("produtos").get()
    ]);

    const clientes = new Set();
    clientesSnap.forEach(doc => {
      const nome = String(doc.data()?.nome || "").trim();
      if (nome) clientes.add(nome);
    });
    Array.from(clientes).sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach(nome => campoCliente.appendChild(new Option(nome, nome)));

    const produtos = new Set();
    produtosSnap.forEach(doc => {
      const nome = String(doc.data()?.nome || "").trim();
      if (nome) produtos.add(nome);
    });
    Array.from(produtos).sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach(nome => campoProduto.appendChild(new Option(nome, nome)));

    if (window.__UNSUB_NOTAS__) window.__UNSUB_NOTAS__();

    window.__UNSUB_NOTAS__ = db.collection("notas")
      .where("userId", "==", user.uid)
      .onSnapshot((snap) => {
        notasAtuais = snap.docs
          .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderizarNotas();
      }, (erro) => {
        console.error("Erro ao carregar anotações:", erro);
        lista.innerHTML = `<div class="bg-white p-5 rounded shadow text-red-600">Não foi possível carregar as anotações.</div>`;
      });
  });
}

window.addEventListener("load", () => {
  setTimeout(iniciarMonitorLembretesNotas, 1500);
});
