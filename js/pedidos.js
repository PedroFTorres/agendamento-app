unction escapeHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarDataPedido(valor) {
  if (!valor) return "-";
  if (typeof valor?.toDate === "function") {
    return valor.toDate().toLocaleDateString("pt-BR");
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
}

function imprimirPedidoPdf(pedido) {
  const { jsPDF } = window.jspdf || {};

  if (!jsPDF) {
    alert("Biblioteca de PDF não encontrada.");
    return;
  }

  const doc = new jsPDF();
  const emissao = formatarDataPedido(pedido.createdAt);
  const prazo = formatarDataPedido(pedido.data);
  const quantidade = typeof formatQuantidade === "function"
    ? formatQuantidade(pedido.quantidade)
    : (pedido.quantidade ?? "-");

  const linhas = [
    `Pedido: ${pedido.codigo || "-"}`,
    `Cliente: ${pedido.clienteNome || "-"}`,
    `Representante: ${pedido.representanteNome || "-"}`,
    `Produto: ${pedido.produtoNome || "-"}`,
    `Quantidade: ${quantidade}`,
    `Prazo: ${prazo}`,
    `Status: ${pedido.status || "-"}`,
    `Data de emissão: ${emissao}`,
    `Observação: ${pedido.observacao || "-"}`
  ];

  doc.setFontSize(16);
  doc.text("Detalhes do Pedido", 14, 18);
  doc.setFontSize(11);
  doc.text(linhas, 14, 30);

  doc.save(`pedido-${pedido.codigo || pedido.id || "sem-codigo"}.pdf`);
}

function abrirModalDetalhesPedido(pedido) {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  const emissao = formatarDataPedido(pedido.createdAt);
  const prazo = formatarDataPedido(pedido.data);
  const quantidade = typeof formatQuantidade === "function"
    ? formatQuantidade(pedido.quantidade)
    : (pedido.quantidade ?? "-");

  modal.innerHTML = `
    <div class="bg-white rounded shadow w-full max-w-2xl p-4">
      <h3 class="text-xl font-bold mb-4">Detalhes do Pedido</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div><span class="font-semibold">Número:</span> ${escapeHtml(pedido.codigo || "-")}</div>
        <div><span class="font-semibold">Status:</span> ${escapeHtml(pedido.status || "-")}</div>
        <div><span class="font-semibold">Cliente:</span> ${escapeHtml(pedido.clienteNome || "-")}</div>
        <div><span class="font-semibold">Representante:</span> ${escapeHtml(pedido.representanteNome || "-")}</div>
        <div><span class="font-semibold">Produto:</span> ${escapeHtml(pedido.produtoNome || "-")}</div>
        <div><span class="font-semibold">Quantidade:</span> ${escapeHtml(quantidade)}</div>
        <div><span class="font-semibold">Prazo:</span> ${escapeHtml(prazo)}</div>
        <div><span class="font-semibold">Data de emissão:</span> ${escapeHtml(emissao)}</div>
        <div class="md:col-span-2"><span class="font-semibold">Observação:</span> ${escapeHtml(pedido.observacao || "-")}</div>
      </div>

      <div class="flex justify-end mt-5 gap-2">
        <button id="btn-imprimir-pedido" class="bg-blue-600 text-white px-3 py-1 rounded">
          Imprimir PDF
        </button>
        <button id="btn-fechar-pedido" class="bg-gray-500 text-white px-3 py-1 rounded">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btn-fechar-pedido").onclick = () => modal.remove();
  document.getElementById("btn-imprimir-pedido").onclick = () => imprimirPedidoPdf(pedido);
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
