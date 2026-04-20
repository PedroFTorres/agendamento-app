// ================== APROVAR PEDIDO ==================
async function aprovarPedido(id, btn) {

  if (btn) btn.disabled = true;

  try {
    const doc = await db.collection("pedidos").doc(id).get();
    const p = doc.data();
    const user = await waitForAuth();

if (PERFIL !== "admin" || user.uid !== p.userId) {
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
              agendamentoId: agRef.id
            });

            // 🔔 NOVO: MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
            const notifSnap = await db.collection("notificacoes")
              .where("pedidoId", "==", p.codigo)
              .get();

            notifSnap.forEach(doc => {
              doc.ref.update({ lida: true });
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

if (PERFIL !== "admin" || user.uid !== p.userId) {
  alert("Sem permissão para cancelar");
  if (btn) btn.disabled = false;
  return;
}

    await db.collection("pedidos").doc(id).update({
      status: "cancelado",
      motivoCancelamento: motivo
    });

    // 🔔 NOVO: MARCAR NOTIFICAÇÃO DO ADMIN COMO LIDA
    const notifSnap = await db.collection("notificacoes")
      .where("pedidoId", "==", p.codigo)
      .get();

    notifSnap.forEach(doc => {
      doc.ref.update({ lida: true });
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

  if (PERFIL !== "admin" || user.uid !== p.userId) {
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

      location.reload();

    } catch (e) {
      console.error(e);
      alert("Erro ao editar pedido");
    }
  };
}
