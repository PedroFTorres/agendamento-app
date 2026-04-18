// ================== APROVAR PEDIDO ==================
async function aprovarPedido(id, btn) {

  if (btn) btn.disabled = true;

  try {
    const doc = await db.collection("pedidos").doc(id).get();
    const p = doc.data();

    // 🔥 cria modal
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

    // 🔄 reativa botão se fechar
    document.getElementById("fechar-modal").onclick = () => {
      modal.remove();
      if (btn) btn.disabled = false;
    };

    // 🔥 buscar agendamentos existentes
    const snap = await db.collection("agendamentos").get();

    const eventos = snap.docs.map(doc => {
      const d = doc.data();
      return {
        title: `${d.produtoNome || ""} (${d.quantidade || 0})`,
        start: d.data
      };
    });

    // 🔒 trava duplo clique
    let clicado = false;

    // 🔥 criar calendário
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
            // 🔥 cria agendamento
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

// 🔥 salva vínculo no pedido
await db.collection("pedidos").doc(id).update({
  status: "aprovado",
  agendamentoId: agRef.id
});
            // 🔥 atualiza pedido
            await db.collection("pedidos").doc(id).update({
              status: "aprovado"
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
    await db.collection("pedidos").doc(id).update({
      status: "cancelado",
      motivoCancelamento: motivo
    });

    alert("Pedido cancelado!");

  } catch (e) {
    if (btn) btn.disabled = false;
    alert("Erro ao cancelar pedido");
  }
}
async function editarPedidoAprovado(id) {

  const user = await waitForAuth();

  // 🔒 só admin
  if (PERFIL !== "admin") {
    alert("Apenas admin pode editar pedidos aprovados");
    return;
  }

  const doc = await db.collection("pedidos").doc(id).get();
  const p = doc.data();

  // 🔒 só se aprovado
  if (p.status !== "aprovado") {
    alert("Só pode editar pedidos aprovados");
    return;
  }

  // 🔧 funções de data (formato BR)
  function isoParaBR(data) {
    if (!data) return "";
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  }

  function brParaISO(data) {
    if (!data) return "";
    const [d, m, y] = data.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 🔥 nova quantidade
  const novaQtd = prompt("Nova quantidade:", p.quantidade);
  if (!novaQtd) return;

  // 🔥 pegar data atual do agendamento
  let dataAtual = "";

  if (p.agendamentoId) {
    const agSnap = await db.collection("agendamentos").doc(p.agendamentoId).get();
    dataAtual = agSnap.data()?.data || "";
  }

  // 🔥 mostrar data em formato BR
  const novaDataBR = prompt(
    "Nova data (DD/MM/AAAA):",
    isoParaBR(dataAtual)
  );

  if (!novaDataBR) return;

  // 🔥 converter para salvar
  const novaData = brParaISO(novaDataBR);

  try {

    // 🔥 1. atualiza pedido
    await db.collection("pedidos").doc(id).update({
      quantidade: Number(novaQtd),
      editadoPor: user.uid,
      editadoEm: new Date()
    });

    // 🔥 2. atualiza agendamento
    if (p.agendamentoId) {
      await db.collection("agendamentos").doc(p.agendamentoId).update({
        quantidade: Number(novaQtd),
        data: novaData
      });
    }

    alert("Pedido atualizado!");

  } catch (e) {
    console.error(e);
    alert("Erro ao editar pedido");
  }
}
async function excluirPedidoCompleto(id) {

  const user = await waitForAuth();

  // 🔒 só admin
  if (PERFIL !== "admin") {
    alert("Apenas admin pode excluir pedidos");
    return;
  }

  const ref = db.collection("pedidos").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    alert("Pedido não encontrado");
    return;
  }

  const p = snap.data();

  if (p.status !== "aprovado") {
    alert("Só é permitido excluir pedidos aprovados");
    return;
  }

  if (!confirm("Tem certeza que deseja excluir este pedido e o agendamento?")) return;

  try {

    // 🔥 1. EXCLUI PEDIDO
    await ref.delete();

    // 🔥 2. EXCLUI AGENDAMENTO (se existir)
    if (p.agendamentoId) {
      await db.collection("agendamentos").doc(p.agendamentoId).delete();
    }

    // 🔥 3. ENVIA NOTIFICAÇÃO
    await db.collection("notificacoes").add({
      userId: p.userId, // representante
      mensagem: `Seu pedido foi excluído pelo administrador.`,
      tipo: "pedido_excluido",
      pedidoId: id,
      criadoEm: new Date(),
      lido: false
    });

    alert("Pedido excluído com sucesso!");

  } catch (e) {
    console.error(e);
    alert("Erro ao excluir pedido");
  }
}
