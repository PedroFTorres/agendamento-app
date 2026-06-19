async function obterRegistroNotificacoes() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    return await navigator.serviceWorker.register("notification-sw.js");
  } catch (e) {
    console.error("Não foi possível registrar as notificações do celular:", e);
    return null;
  }
}

async function mostrarNotificacaoCelular(id, notificacao) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!notificacao?.texto) return;

  const registro = await obterRegistroNotificacoes();
  const opcoes = {
    body: notificacao.texto,
    icon: new URL("img/logo.png", window.location.href).href,
    badge: new URL("img/logo.png", window.location.href).href,
    tag: `agendamento-notificacao-${id}`,
    renotify: false,
    data: { url: window.location.href }
  };

  if (registro?.showNotification) {
    await registro.showNotification("Agendamento App", opcoes);
    return;
  }

  try {
    new Notification("Agendamento App", opcoes);
  } catch (e) {
    console.warn("O navegador não conseguiu mostrar a notificação.", e);
  }
}

function iniciarEscutaNotificacoesCelular(userId) {
  if (window.__UNSUB_NOTIFICACOES_CELULAR__) {
    window.__UNSUB_NOTIFICACOES_CELULAR__();
  }

  let primeiraCarga = true;
  window.__UNSUB_NOTIFICACOES_CELULAR__ = db.collection("notificacoes")
    .where("userId", "==", userId)
    .onSnapshot((snap) => {
      if (primeiraCarga) {
        primeiraCarga = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const notificacao = change.doc.data() || {};
        if (notificacao.lida === true || !notificacao.texto) return;
        mostrarNotificacaoCelular(change.doc.id, notificacao);
      });
    }, (erro) => {
      console.error("Erro ao acompanhar notificações do celular:", erro);
    });
}

async function solicitarNotificacoesCelular() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    alert("Este navegador não oferece suporte a notificações.");
    return;
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    atualizarStatusNotificacoesCelular();
    alert("A permissão não foi concedida. Você pode liberá-la nas configurações do navegador.");
    return;
  }

  const registro = await obterRegistroNotificacoes();
  if (!registro) {
    alert("Não foi possível ativar as notificações neste aparelho.");
    return;
  }

  await registro.showNotification("Notificações ativadas", {
    body: "Você receberá avisos enquanto o aplicativo estiver aberto ou ativo em segundo plano.",
    icon: new URL("img/logo.png", window.location.href).href,
    tag: "agendamento-notificacoes-ativadas",
    data: { url: window.location.href }
  });

  atualizarStatusNotificacoesCelular();
}

function atualizarStatusNotificacoesCelular() {
  const status = document.getElementById("status-notificacoes-celular");
  const botao = document.getElementById("btn-ativar-notificacoes-celular");
  if (!status || !botao) return;

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    status.textContent = "Este navegador não oferece suporte a notificações.";
    botao.classList.add("hidden");
    return;
  }

  if (Notification.permission === "granted") {
    status.textContent = "Notificações ativadas neste aparelho.";
    status.className = "text-sm text-green-700";
    botao.textContent = "Ativadas";
    botao.disabled = true;
    botao.className = "bg-green-600 text-white px-3 py-2 rounded opacity-70 cursor-default";
    obterRegistroNotificacoes();
    return;
  }

  if (Notification.permission === "denied") {
    status.textContent = "Notificações bloqueadas. Libere-as nas configurações do navegador.";
    status.className = "text-sm text-red-700";
    botao.textContent = "Bloqueadas";
    botao.disabled = true;
    botao.className = "bg-gray-400 text-white px-3 py-2 rounded cursor-not-allowed";
    return;
  }

  status.textContent = "Ative para receber avisos neste celular.";
  status.className = "text-sm text-gray-600";
  botao.textContent = "Ativar notificações";
  botao.disabled = false;
}

async function iniciarNotificacoes() {
  const user = await waitForAuth();
  iniciarEscutaNotificacoesCelular(user.uid);

  if ("Notification" in window && Notification.permission === "granted") {
    obterRegistroNotificacoes();
  }

  let query = db.collection("pedidos")
  .where("userId", "==", user.uid);

  query.onSnapshot((snap) => {

    snap.docChanges().forEach(change => {

     if (change.type === "modified") {

  const p = change.doc.data();

  // 🚫 NÃO NOTIFICAR PEDIDO PENDENTE
  if (p.status === "pendente") return;

  if (p.userId !== user.uid) return;

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

      const naoLidas = snap.docs.filter(d => {
  const n = d.data();

  // 🚫 ignora notificações inválidas
  if (!n.texto) return false;

  return n.lida === false;
}).length;

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

    <div class="bg-white p-3 rounded shadow mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="font-semibold">Notificações no celular</div>
        <div id="status-notificacoes-celular" class="text-sm text-gray-600"></div>
      </div>
      <button id="btn-ativar-notificacoes-celular" class="bg-blue-600 text-white px-3 py-2 rounded">
        Ativar notificações
      </button>
    </div>

    <div id="lista-notificacoes" class="space-y-2"></div>
  `;

  const lista = document.getElementById("lista-notificacoes");
  atualizarStatusNotificacoesCelular();
  document.getElementById("btn-ativar-notificacoes-celular")?.addEventListener(
    "click",
    solicitarNotificacoesCelular
  );

  waitForAuth().then(user => {

 const userId = user.uid;

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
  }
