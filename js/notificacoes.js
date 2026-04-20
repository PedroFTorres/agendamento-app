async function iniciarNotificacoes() {
  const user = await waitForAuth();

  let query = db.collection("pedidos");

  if (PERFIL === "representante") {
    query = query.where("userId", "==", user.uid);
  }

  query.onSnapshot((snap) => {

    snap.docChanges().forEach(change => {

      if (change.type === "modified") {

        const p = change.doc.data();

        if (p.userId !== user.uid) return;

        // ✅ APROVADO
        if (p.status === "aprovado" && !p.notificadoAprovado) {
          criarNotificacao({
            userId: p.userId,
            texto: `✅ Pedido ${p.codigo} foi aprovado para o dia ${p.data || "-"}.`
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoAprovado: true
          });
        }

        // ❌ CANCELADO
        if (p.status === "cancelado" && !p.notificadoCancelado) {
          criarNotificacao({
            userId: p.userId,
            texto: `❌ Pedido ${p.codigo} foi cancelado. Motivo: ${p.motivoCancelamento || "-"}`
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoCancelado: true
          });
        }

        // 📅 DATA
        if (p.dataAnterior && p.data !== p.dataAnterior && !p.notificadoData) {
          criarNotificacao({
            userId: p.userId,
            texto: `📅 Pedido ${p.codigo} alterado para ${p.data}`
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoData: true
          });
        }

        // 📦 QUANTIDADE
        if (p.qtdAnterior && p.quantidade !== p.qtdAnterior && !p.notificadoQtd) {
          criarNotificacao({
            userId: p.userId,
            texto: `📦 Pedido ${p.codigo} alterado de ${p.qtdAnterior} para ${p.quantidade}`
          });

          db.collection("pedidos").doc(change.doc.id).update({
            notificadoQtd: true
          });
        }

      }

    });

  });
}


// 🔔 SALVAR NOTIFICAÇÃO
async function criarNotificacao(n) {
  await db.collection("notificacoes").add({
    userId: n.userId,
    texto: n.texto,
    lida: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}


// 🔴 BADGE
function atualizarBadge(userId) {

  const badge = document.getElementById("badge-notificacoes");

  if (!badge) {
    console.log("❌ badge não encontrado");
    return;
  }

  console.log("👤 buscando notificações para:", userId);

  db.collection("notificacoes")
    .where("userId", "==", userId)
    .onSnapshot(snap => {

      const naoLidas = snap.docs.filter(d => !d.data().lida).length;

      console.log("🔴 total não lidas:", naoLidas);

      if (naoLidas > 0) {
        badge.classList.remove("hidden");
        badge.innerText = naoLidas;
      } else {
        badge.classList.add("hidden");
      }

    });
}

// 📲 TELA
function renderNotificacoes() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Notificações</h2>
    <div id="lista-notificacoes" class="space-y-2"></div>
  `;

  const lista = document.getElementById("lista-notificacoes");

  waitForAuth().then(user => {

  const userId = (PERFIL === "admin") ? "admin" : user.uid;

  db.collection("notificacoes")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {

      lista.innerHTML = "";

      snap.forEach(doc => {

        const n = doc.data();

        const item = document.createElement("div");

        // 🔥 cor diferente
        item.className = n.lida
          ? "bg-green-50 p-3 rounded shadow"
          : "bg-white p-3 rounded shadow";

        item.innerHTML = `
          <div class="flex justify-between items-center">

            <div>
              <div>${n.texto}</div>
              <div style="font-size:12px; color:#666;">
                ${n.createdAt?.toDate?.().toLocaleString("pt-BR") || ""}
              </div>
            </div>

            ${n.lida === true ? `
              <span class="text-green-600 text-xl font-bold">✔️</span>
            ` : `
              <button data-id="${doc.id}" class="btn-lida text-gray-400 text-xl hover:text-green-600">
                ✔️
              </button>
            `}

          </div>
        `;

        lista.appendChild(item);

        const btn = item.querySelector(".btn-lida");

        if (btn) {
          btn.onclick = () => {
            db.collection("notificacoes").doc(btn.dataset.id).update({
              lida: true
            });
          };
        }

      });

    });

});
