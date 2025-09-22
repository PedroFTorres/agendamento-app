// ======================= UTIL =========================
const pageContent = document.getElementById("page-content");

function toast(msg) {
  try { alert(msg); } catch(_) { console.log(msg); }
}

async function waitForAuth() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => {
      if (u) { unsub(); resolve(u); }
    });
  });
}

function btn(label, classes = "", attrs = "") {
  return `<button class="px-2 py-1 rounded ${classes}" ${attrs}>${label}</button>`;
}

// ================== FORMULÁRIOS POR TIPO ==================
function getFormHTML(type) {
  if (type === "clientes") {
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="clientes-nome" class="border p-2 rounded" placeholder="Nome do cliente" required>
        <input id="clientes-whatsapp" class="border p-2 rounded" placeholder="WhatsApp (ex: 98991234567)">
        <input id="clientes-rep" class="border p-2 rounded" placeholder="Representante (opcional)">
      </div>
      <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>
    `;
  }
  if (type === "representantes") {
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input id="representantes-nome" class="border p-2 rounded" placeholder="Nome do representante" required>
      </div>
      <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>
    `;
  }
  if (type === "produtos") {
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="produtos-nome" class="border p-2 rounded" placeholder="Nome do produto" required>
        <input id="produtos-preco" type="number" step="0.0001" class="border p-2 rounded" placeholder="Preço (ex: 12.5000)">
        <input id="produtos-categoria" class="border p-2 rounded" placeholder="Categoria (opcional)">
      </div>
      <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>
    `;
  }
  return `<input id="${type}-name" class="border p-2 rounded w-full" placeholder="Nome" required><button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>`;
}

function renderHeader(type) {
  const titles = {
    clientes: "Gerenciar Clientes",
    representantes: "Gerenciar Representantes",
    produtos: "Gerenciar Produtos",
  };
  return `<h2 class="text-xl font-bold mb-4">${titles[type] || type}</h2>`;
}

// ================ RENDERIZAÇÃO E BIND ======================
function renderForm(type) {
  pageContent.innerHTML = `
    ${renderHeader(type)}
    <form id="${type}-form" class="bg-white p-4 rounded shadow mb-4">
      ${getFormHTML(type)}
    </form>
    <ul id="${type}-list" class="space-y-2"></ul>
  `;

  const form = document.getElementById(`${type}-form`);
  const list = document.getElementById(`${type}-list`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const user = await waitForAuth();
      const uid = user.uid;

      let payload = { userId: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

      if (type === "clientes") {
        const nome = document.getElementById("clientes-nome").value.trim();
        let whatsapp = document.getElementById("clientes-whatsapp").value.trim();
        const representante = document.getElementById("clientes-rep").value.trim();
        if (!nome) return toast("Informe o nome do cliente.");
        whatsapp = whatsapp.replace(/^\+?55/, ""); // remove +55 ou 55
        payload = { ...payload, nome, whatsapp, representante: representante || null };
      } else if (type === "representantes") {
        const nome = document.getElementById("representantes-nome").value.trim();
        if (!nome) return toast("Informe o nome do representante.");
        payload = { ...payload, nome };
      } else if (type === "produtos") {
        const nome = document.getElementById("produtos-nome").value.trim();
        const preco = parseFloat(document.getElementById("produtos-preco").value) || 0;
        const categoria = document.getElementById("produtos-categoria").value.trim();
        if (!nome) return toast("Informe o nome do produto.");
        payload = { ...payload, nome, preco, categoria: categoria || null };
      } else {
        // fallback genérico
        const name = document.getElementById(`${type}-name`).value.trim();
        if (!name) return toast("Informe o nome.");
        payload = { ...payload, name };
      }

      await db.collection(type).add(payload);
      form.reset();
      toast("Salvo com sucesso!");
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) ? err.message : String(err);
      toast("Falha ao salvar: " + msg);
    }
  });

  // lista em tempo real
  waitForAuth().then(user => {
    db.collection(type)
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snap) => {
          list.innerHTML = "";
          if (snap.empty) {
            list.innerHTML = `<li class="text-gray-500">Nenhum registro.</li>`;
            return;
          }
          snap.forEach(doc => {
            const data = doc.data();
            list.appendChild(renderItem(type, doc.id, data));
          });
          bindItemActions(type, list);
        },
        (err) => {
          console.error(err);
          toast("Erro ao listar: " + (err.message || err));
        }
      );
  });
}

function renderItem(type, id, data) {
  let main = "";
  if (type === "clientes") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>
            <div class="text-sm text-gray-500">WhatsApp: ${data.whatsapp || "—"} • Rep: ${data.representante || "—"}</div>`;
  } else if (type === "representantes") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>`;
  } else if (type === "produtos") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>
            <div class="text-sm text-gray-500">Preço: R$ ${(Number(data.preco || 0)).toFixed(4)} • Cat: ${data.categoria || "—"}</div>`;
  } else {
    main = `<div class="font-semibold">${data.name || "—"}</div>`;
  }

  const li = document.createElement("li");
  li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
  li.innerHTML = `
    <div>${main}</div>
    <div class="space-x-2">
      ${btn("Editar", "bg-yellow-500 text-white", `data-a="e" data-id="${id}"`)}
      ${btn("Excluir", "bg-red-600 text-white", `data-a="d" data-id="${id}"`)}
    </div>
  `;
  return li;
}

function bindItemActions(type, container) {
  container.querySelectorAll("button[data-a]").forEach(b => {
    b.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const a  = e.currentTarget.getAttribute("data-a");
      if (a === "d") {
        if (!confirm("Excluir este registro?")) return;
        try {
          await db.collection(type).doc(id).delete();
        } catch (err) {
          console.error(err);
          toast("Falha ao excluir: " + (err.message || err));
        }
      } else if (a === "e") {
        try {
          const snap = await db.collection(type).doc(id).get();
          const d = snap.data() || {};
          let promptStr = "";
          if (type === "clientes") {
            promptStr = `Edite: nome, whatsapp, representante\nAtual: ${d.nome||""}, ${d.whatsapp||""}, ${d.representante||""}`;
            const resp = prompt(promptStr);
            if (resp == null) return;
            const [nome, whatsappRaw, rep] = resp.split(",").map(s => (s||"").trim());
            const whatsapp = (whatsappRaw || "").replace(/^\+?55/, "");
            await db.collection(type).doc(id).update({ nome, whatsapp, representante: rep || null });
          } else if (type === "representantes") {
            promptStr = `Edite: nome\nAtual: ${d.nome||""}`;
            const resp = prompt(promptStr);
            if (resp == null) return;
            await db.collection(type).doc(id).update({ nome: resp.trim() });
          } else if (type === "produtos") {
            promptStr = `Edite: nome, preco, categoria\nAtual: ${d.nome||""}, ${d.preco||0}, ${d.categoria||""}`;
            const resp = prompt(promptStr);
            if (resp == null) return;
            const [nome, precoStr, cat] = resp.split(",").map(s => (s||"").trim());
            const preco = parseFloat(precoStr)||0;
            await db.collection(type).doc(id).update({ nome, preco, categoria: cat || null });
          } else {
            promptStr = `Edite: name\nAtual: ${d.name||""}`;
            const resp = prompt(promptStr);
            if (resp == null) return;
            await db.collection(type).doc(id).update({ name: resp.trim() });
          }
        } catch (err) {
          console.error(err);
          toast("Falha ao editar: " + (err.message || err));
        }
      }
    });
  });
}

// ================== MENU LATERAL ======================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => renderForm(btn.dataset.page));
});

// ========== FORMULÁRIO DE AGENDAMENTOS ==========
function renderAgendamentos() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Gerenciar Agendamentos</h2>
    <form id="agendamento-form" class="bg-white p-4 rounded shadow mb-4 space-y-2">
      <input type="date" id="agendamento-data" class="border p-2 rounded w-full" required>
      <input type="number" id="agendamento-quantidade" class="border p-2 rounded w-full" placeholder="Quantidade" required>
      <input type="text" id="agendamento-observacao" class="border p-2 rounded w-full" placeholder="Observação (opcional)">
      <button class="bg-blue-600 text-white p-2 rounded w-full">Salvar</button>
    </form>
    <ul id="agendamento-list" class="space-y-2"></ul>
  `;

  const form = document.getElementById("agendamento-form");
  const list = document.getElementById("agendamento-list");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();
    const data = document.getElementById("agendamento-data").value;
    const quantidade = parseInt(document.getElementById("agendamento-quantidade").value);
    const observacao = document.getElementById("agendamento-observacao").value;

    try {
      await db.collection("agendamentos").add({
        userId: user.uid,
        data,
        quantidade,
        observacao,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      form.reset();
      toast("Agendamento salvo!");
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar: " + err.message);
    }
  });

  waitForAuth().then(user => {
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        list.innerHTML = "";
        if (snap.empty) {
          list.innerHTML = `<li class="text-gray-500">Nenhum agendamento.</li>`;
          return;
        }
        snap.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("li");
          li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
          li.innerHTML = `
            <div>
              <div class="font-semibold">Data: ${d.data}</div>
              <div class="text-sm text-gray-500">Qtd: ${d.quantidade} • Obs: ${d.observacao || "—"}</div>
            </div>
            <div>
              <button data-id="${doc.id}" class="bg-red-600 text-white px-2 py-1 rounded delete-agendamento">Excluir</button>
            </div>
          `;
          list.appendChild(li);
        });

        document.querySelectorAll(".delete-agendamento").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const id = e.target.getAttribute("data-id");
            if (confirm("Excluir este agendamento?")) {
              await db.collection("agendamentos").doc(id).delete();
            }
          });
        });
      });
  });
}

// Hook no menu
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.page === "agendamentos") {
      renderAgendamentos();
    } else {
      renderForm(btn.dataset.page);
    }
  });
});
