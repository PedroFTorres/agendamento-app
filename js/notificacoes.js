async function iniciarNotificacoes() {
  const user = await waitForAuth();

  let query = db.collection("pedidos");

  // representante só vê os dele
  if (PERFIL === "representante") {
    query = query.where("userId", "==", user.uid);
  }

  query.onSnapshot((snap) => {

    snap.docChanges().forEach(change => {

// 🔒 GARANTE QUE SÓ O DONO RECEBE

      if (change.type === "modified") {
        const p = change.doc.data();

         if (p.userId !== user.uid) return;

        // 🔥 APROVADO
        if (p.status === "aprovado" && !p.notificadoAprovado) {
          criarNotificacao({
            userId: p.userId,
            texto: `✅ Pedido ${p.codigo} foi aprovado para o dia ${p.data || "-"}. Verifique seu calendário.`,
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoAprovado: true
          });
        }

        // 🔥 CANCELADO
        if (p.status === "cancelado" && !p.notificadoCancelado) {
          criarNotificacao({
            userId: p.userId,
            texto: `❌ Pedido ${p.codigo} foi cancelado. Motivo: ${p.motivoCancelamento || "não informado"}`,
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoCancelado: true
          });
        }

        // 🔥 ALTERAÇÃO DE DATA
        if (p.dataAnterior && p.data !== p.dataAnterior) {
          criarNotificacao({
            userId: p.userId,
            texto: `📅 Pedido ${p.codigo} alterado para ${p.data}. Verifique o calendário.`,
          });
        }

        // 🔥 ALTERAÇÃO DE QUANTIDADE
        if (p.qtdAnterior && p.quantidade !== p.qtdAnterior) {
          criarNotificacao({
            userId: p.userId,
            texto: `📦 Pedido ${p.codigo} alterado de ${p.qtdAnterior} para ${p.quantidade}`,
          });
        }

      }

    });

  });
}
async function criarNotificacao(n) {
  await db.collection("notificacoes").add({
    userId: n.userId,
    texto: n.texto,
    lida: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
function renderNotificacoes() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Notificações</h2>
    <div id="lista-notificacoes" class="space-y-2"></div>
  `;

  const lista = document.getElementById("lista-notificacoes");

  waitForAuth().then(user => {

    db.collection("notificacoes")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {

        lista.innerHTML = "";

        snap.forEach(doc => {
          const n = doc.data();

          const item = document.createElement("div");
          item.className = "bg-white p-3 rounded shadow";

          item.innerHTML = `
            <div>${n.texto}</div>
            <div style="font-size:12px; color:#666;">
              ${n.createdAt?.toDate?.().toLocaleString("pt-BR") || ""}
            </div>
          `;

          lista.appendChild(item);
        });

      });

  });
}
