function escapeHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarDataPedido(valor) {
  if (!valor) return "-";
  if (valor && typeof valor.toDate === "function") {
    return valor.toDate().toLocaleDateString("pt-BR");
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
}

function formatarCampoCliente(valor) {
  const campo = String(valor || "").trim();
  return campo || "-";
}

function formatarEnderecoCliente(cliente = {}) {
  const partes = [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade, cliente.uf]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!partes.length) return "-";
  return partes.join(" • ");
}

function obterPrazoPedido(pedido) {
  const prazoPagamento = String(pedido.prazoPagamento || "").trim();
  const prazoAgendamento = formatarDataPedido(pedido.data);

  if (prazoPagamento && prazoAgendamento !== "-") {
    return `${prazoPagamento} • Entrega ${prazoAgendamento}`;
  }

  return prazoPagamento || prazoAgendamento;
}

async function carregarLogoDataUrl() {
  try {
    const blob = await fetch("img/logo.png").then((r) => r.blob());
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

const cacheClientePedido = new Map();

async function buscarDadosClientePedido(pedido) {
  const chave = `${pedido.userId || ""}::${pedido.clienteNome || ""}`;
  if (cacheClientePedido.has(chave)) {
    return cacheClientePedido.get(chave);
  }

  const snapshotPedido = {
    nome: pedido.clienteNome || "",
    cnpj: pedido.clienteCnpj || "",
    whatsapp: pedido.clienteWhatsapp || "",
    ie: pedido.clienteIe || "",
    endereco: pedido.clienteEndereco || "",
    numero: pedido.clienteNumero || "",
    bairro: pedido.clienteBairro || "",
    cidade: pedido.clienteCidade || "",
    uf: pedido.clienteUf || ""
  };

  if (snapshotPedido.cnpj || snapshotPedido.whatsapp || snapshotPedido.endereco) {
    cacheClientePedido.set(chave, snapshotPedido);
    return snapshotPedido;
  }

  try {
    let query = db.collection("clientes").where("nome", "==", pedido.clienteNome || "").limit(5);
    if (pedido.userId) {
      query = query.where("userId", "==", pedido.userId).limit(5);
    }

    const snap = await query.get();
    const cliente = snap.empty ? snapshotPedido : (snap.docs[0].data() || snapshotPedido);
    cacheClientePedido.set(chave, cliente);
    return cliente;
  } catch (e) {
    cacheClientePedido.set(chave, snapshotPedido);
    return snapshotPedido;
  }
}

async function imprimirPedidoPdf(pedido, cliente = {}) {
  const jsPdfLib = window.jspdf || {};
  const jsPDF = jsPdfLib.jsPDF;

  if (!jsPDF) {
    alert("Biblioteca de PDF não encontrada.");
    return;
  }

  const doc = new jsPDF();
  const emissao = formatarDataPedido(pedido.createdAt);
  const prazo = obterPrazoPedido(pedido);

  const quantidade = typeof formatQuantidade === "function"
    ? formatQuantidade(pedido.quantidade)
    : (pedido.quantidade == null ? "-" : pedido.quantidade);

const logo = await carregarLogoDataUrl();

  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 22, 22);
  }

  doc.setTextColor(31, 59, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Detalhes do Pedido", 40, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Emissão: ${emissao}`, 40, 24);

  doc.setDrawColor(31, 59, 100);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);

  const secoes = [
    ["Pedido", pedido.codigo || "-"],
    ["Status", pedido.status || "-"],
    ["Representante", pedido.representanteNome || "-"],
    ["Produto", pedido.produtoNome || "-"],
    ["Quantidade", quantidade],
    ["Prazo", prazo],
    ["Observação", pedido.observacao || "-"]
  ];

  const dadosCliente = [
    ["Cliente", formatarCampoCliente(cliente.nome || pedido.clienteNome)],
    ["CNPJ/CPF", formatarCampoCliente(cliente.cnpj)],
    ["WhatsApp", formatarCampoCliente(cliente.whatsapp)],
    ["Inscrição Estadual", formatarCampoCliente(cliente.ie)],
    ["Endereço", formatarEnderecoCliente(cliente)]
  ];

  let y = 46;
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informações do Pedido", 14, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  secoes.forEach(([rotulo, valor]) => {
    const linhas = doc.splitTextToSize(String(valor || "-"), 130);
    doc.setFont("helvetica", "bold");
    doc.text(`${rotulo}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(linhas, 50, y);
    y += Math.max(6, linhas.length * 5);
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Dados do Cliente", 14, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  dadosCliente.forEach(([rotulo, valor]) => {
    const linhas = doc.splitTextToSize(String(valor || "-"), 130);
    doc.setFont("helvetica", "bold");
    doc.text(`${rotulo}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(linhas, 50, y);
    y += Math.max(6, linhas.length * 5);
  });

  doc.save(`pedido-${pedido.codigo || pedido.id || "sem-codigo"}.pdf`);
}

async function abrirModalDetalhesPedido(pedido) {
  const cliente = await buscarDadosClientePedido(pedido);
  const modal = document.createElement("div");
 modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3";

  const emissao = formatarDataPedido(pedido.createdAt);
   const prazo = obterPrazoPedido(pedido);
  const quantidade = typeof formatQuantidade === "function"
    ? formatQuantidade(pedido.quantidade)
    : (pedido.quantidade == null ? "-" : pedido.quantidade);

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200">
      <div class="px-5 py-4 text-white" style="background: linear-gradient(90deg, #1f3b64 0%, #2b4f86 100%);">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="img/logo.png" alt="Logo" class="h-10 w-10 rounded-full bg-white p-1 object-contain" onerror="this.style.display='none'" />
            <div>
              <h3 class="text-xl font-bold leading-tight">Detalhes do Pedido</h3>
              <p class="text-xs text-blue-100">Visualização administrativa e impressão profissional</p>
            </div>
          </div>
          <span class="text-xs px-3 py-1 rounded-full font-semibold" style="background: #f28c28; color: #1f3b64;">${escapeHtml(pedido.status || "-")}</span>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Número:</span> ${escapeHtml(pedido.codigo || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Data de emissão:</span> ${escapeHtml(emissao)}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Representante:</span> ${escapeHtml(pedido.representanteNome || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Produto:</span> ${escapeHtml(pedido.produtoNome || "-")}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Quantidade:</span> ${escapeHtml(quantidade)}</div>
          <div class="bg-slate-50 rounded-lg p-3"><span class="font-semibold text-slate-700">Prazo:</span> ${escapeHtml(prazo || "-")}</div>
          <div class="md:col-span-2 bg-orange-50 rounded-lg p-3 border border-orange-100"><span class="font-semibold text-slate-700">Observação:</span> ${escapeHtml(pedido.observacao || "-")}</div>
        </div>

        <div class="border border-slate-200 rounded-lg p-4">
          <h4 class="font-bold text-slate-800 mb-3">Dados do Cliente</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span class="font-semibold">Nome:</span> ${escapeHtml(formatarCampoCliente(cliente.nome || pedido.clienteNome))}</div>
            <div><span class="font-semibold">CNPJ/CPF:</span> ${escapeHtml(formatarCampoCliente(cliente.cnpj))}</div>
            <div><span class="font-semibold">WhatsApp:</span> ${escapeHtml(formatarCampoCliente(cliente.whatsapp))}</div>
            <div><span class="font-semibold">Inscrição Estadual:</span> ${escapeHtml(formatarCampoCliente(cliente.ie))}</div>
            <div class="md:col-span-2"><span class="font-semibold">Endereço:</span> ${escapeHtml(formatarEnderecoCliente(cliente))}</div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
        <button id="btn-imprimir-pedido" class="text-white px-4 py-2 rounded font-semibold" style="background-color:#1f3b64;">
          Imprimir PDF
        </button>
       <button id="btn-fechar-pedido" class="text-white px-4 py-2 rounded font-semibold" style="background-color:#6b7280;">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btn-fechar-pedido").onclick = () => modal.remove();
   document.getElementById("btn-imprimir-pedido").onclick = () => imprimirPedidoPdf(pedido, cliente);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}
// ================== APROVAR PEDIDO ==================
async function aprovarPedido(id, btn) {

  if (btn) btn.disabled = true;

  try {
    const doc = await db.collection("pedidos").doc(id).get();
    const p = doc.data();
    const user = await waitForAuth();

      if (PERFIL !== "admin") {
      alert("Sem permissão para aprovar");
      if (btn) btn.disabled = false;
      return;
    }

    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

    modal.innerHTML = `
      <div class="bg-white p-4 rounded shadow w-full max-w-3xl">
        <h3 class="text-lg font-bold mb-2">Escolher data do agendamento</h3>
        <div id="calendar-aprovacao"></div>

        <div class="text-right mt-3">
          <button id="fechar-modal" class="bg-gray-400 text-white px-3 py-1 rounded">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("fechar-modal").onclick = () => {
      modal.remove();
      if (btn) btn.disabled = false;
    };

    const snap = await db.collection("agendamentos").get();

    const eventos = snap.docs.map(doc => {
      const d = doc.data();
      return {
        title: `${d.produtoNome || ""} (${d.quantidade || 0})`,
        start: d.data
      };
    });

    let clicado = false;

    const calendar = new FullCalendar.Calendar(
      document.getElementById("calendar-aprovacao"),
      {
        initialView: "dayGridMonth",
        locale: "pt-br",
        height: "auto",
        events: eventos,

        dateClick: async function(info) {

          if (clicado) return;
          clicado = true;

          const dataEscolhida = info.dateStr;

          try {

            const agRef = await db.collection("agendamentos").add({
              userId: p.userId,
              clienteNome: p.clienteNome,
              produtoNome: p.produtoNome,
              quantidade: p.quantidade,
              representanteNome: p.representanteNome,
              criadoPor: p.userId,
              data: dataEscolhida,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection("pedidos").doc(id).update({
              status: "aprovado",
              agendamentoId: agRef.id,
              data: dataEscolhida,
              notificadoAprovado: true
            });

            // 🔔 MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
            const notifSnap = await db.collection("notificacoes")
              .where("pedidoId", "==", p.codigo)
              .where("userId", "==", user.uid)
              .get();

            notifSnap.forEach(doc => {
              doc.ref.update({ lida: true });
            });
            
            // 🔔 Notificar representante
            await db.collection("notificacoes").add({
              userId: p.userId,
              pedidoId: p.codigo,
              texto: `✅ Pedido ${p.codigo} foi aprovado para o dia ${dataEscolhida}.`,
              lida: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Pedido aprovado e agendado!");
            modal.remove();

          } catch (e) {
            clicado = false;
            alert("Erro ao salvar agendamento");
          }
        }
      }
    );

    calendar.render();

  } catch (e) {
    if (btn) btn.disabled = false;
    alert("Erro ao abrir aprovação");
  }
}


// ================== CANCELAR PEDIDO ==================
async function cancelarPedido(id, btn) {

  if (btn) btn.disabled = true;

  const motivo = prompt("Motivo do cancelamento:");

  if (!motivo) {
    if (btn) btn.disabled = false;
    return;
  }

  try {

    const docPedido = await db.collection("pedidos").doc(id).get();
    const p = docPedido.data();
   const user = await waitForAuth();

      if (PERFIL !== "admin") {
      alert("Sem permissão para cancelar");
      if (btn) btn.disabled = false;
      return;
    }

    await db.collection("pedidos").doc(id).update({
      status: "cancelado",
      motivoCancelamento: motivo,
      notificadoCancelado: true
    });

    // 🔔 MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
    const notifSnap = await db.collection("notificacoes")
      .where("pedidoId", "==", p.codigo)
      .where("userId", "==", user.uid)
      .get();

    notifSnap.forEach(doc => {
      doc.ref.update({ lida: true });
    });

    // 🔔 Notificar representante
    await db.collection("notificacoes").add({
      userId: p.userId,
      pedidoId: p.codigo,
      texto: `❌ Pedido ${p.codigo} foi cancelado. Motivo: ${motivo}`,
      lida: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });


    alert("Pedido cancelado!");

  } catch (e) {
    if (btn) btn.disabled = false;
    alert("Erro ao cancelar pedido");
  }
}

async function editarPedidoAprovado(id) {

  const doc = await db.collection("pedidos").doc(id).get();
  const p = doc.data();

  const user = await waitForAuth();

  if (PERFIL !== "admin") {
    alert("Sem permissão");
    return;
  }

  if (p.status !== "aprovado") {
    alert("Só pode editar pedidos aprovados");
    return;
  }

  // 🔥 pega data atual do agendamento
  let dataAtual = "";

  if (p.agendamentoId) {
    const agSnap = await db.collection("agendamentos").doc(p.agendamentoId).get();
    dataAtual = agSnap.data()?.data || "";
  }

  // 🔥 cria modal
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  modal.innerHTML = `
    <div class="bg-white p-4 rounded shadow w-80">
      <h3 class="text-lg font-bold mb-3">Editar Pedido</h3>

      <label class="block mb-1">Quantidade</label>
      <input id="edit-qtd" type="number" value="${p.quantidade}" class="w-full border p-2 mb-3"/>

      <label class="block mb-1">Data</label>
      <input id="edit-data" type="date" value="${dataAtual}" class="w-full border p-2 mb-3"/>

      <div class="flex justify-end space-x-2">
        <button id="cancelar-edit" class="bg-gray-400 text-white px-3 py-1 rounded">
          Cancelar
        </button>
        <button id="salvar-edit" class="bg-blue-600 text-white px-3 py-1 rounded">
          Salvar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // cancelar
  document.getElementById("cancelar-edit").onclick = () => modal.remove();

  // salvar
  document.getElementById("salvar-edit").onclick = async () => {

    const novaQtd = document.getElementById("edit-qtd").value;
    const novaData = document.getElementById("edit-data").value;

    if (!novaQtd || !novaData) {
      alert("Preencha todos os campos");
      return;
    }

    try {

      // 🔥 atualiza pedido
      await db.collection("pedidos").doc(id).update({
        quantidade: Number(novaQtd),
        qtdAnterior: p.quantidade,
        dataAnterior: dataAtual,
        data: novaData,
        notificadoQtd: true,
        notificadoData: true,
        editadoPor: user.uid,
        editadoEm: new Date()
      });

      // 🔥 atualiza agendamento
      if (p.agendamentoId) {
        await db.collection("agendamentos").doc(p.agendamentoId).update({
          quantidade: Number(novaQtd),
          data: novaData
        });
      }

      modal.remove();
      alert("Pedido atualizado!");

      // 🔔 Notificar representante sobre edição
      await db.collection("notificacoes").add({
        userId: p.userId,
        pedidoId: p.codigo,
        texto: `📝 Pedido ${p.codigo} atualizado: quantidade ${p.quantidade} → ${Number(novaQtd)}, data ${dataAtual || "-"} → ${novaData}.`,
        lida: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      location.reload();

    } catch (e) {
      console.error(e);
      alert("Erro ao editar pedido");
    }
  };
}

async function excluirPedidoCompleto(id) {
  const confirmar = confirm("Deseja excluir este pedido e o agendamento vinculado?");
  if (!confirmar) return;

  try {
    await waitForAuth();

    if (PERFIL !== "admin") {
      alert("Sem permissão para excluir");
      return;
    }

    const pedidoRef = db.collection("pedidos").doc(id);
    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists) {
      alert("Pedido não encontrado");
      return;
    }

    const pedido = pedidoSnap.data();

    if (pedido.agendamentoId) {
      await db.collection("agendamentos").doc(pedido.agendamentoId).delete();
    }

    await pedidoRef.delete();

    if (pedido.userId) {
      await db.collection("notificacoes").add({
        userId: pedido.userId,
        pedidoId: pedido.codigo,
        texto: `🗑️ Pedido ${pedido.codigo} foi excluído pelo administrador.`,
        lida: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    alert("Pedido excluído com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao excluir pedido");
  }
}
// Garante disponibilidade global para chamadas vindas de outros scripts.
window.imprimirPedidoPdf = imprimirPedidoPdf;
window.abrirModalDetalhesPedido = abrirModalDetalhesPedido;
