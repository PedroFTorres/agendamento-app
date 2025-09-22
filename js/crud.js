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

function header(title) {
  return `<h2 class="text-xl font-bold mb-4">${title}</h2>`;
}

// ================== FORMULÁRIOS BÁSICOS ==================
function formHTML(type) {
  if (type === "clientes") {
  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
      <input id="clientes-nome" class="border p-2 rounded" placeholder="Nome do cliente" required>
      <input id="clientes-whatsapp" class="border p-2 rounded" placeholder="WhatsApp (ex: 98991234567)">
      <input id="clientes-rep" class="border p-2 rounded" placeholder="Representante (opcional)">
    </div>
    <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>

    <div class="mt-4">
      <label class="block text-sm font-medium mb-1">Importar Clientes de Planilha (.xlsx)</label>
      <input type="file" id="import-clientes" accept=".xlsx" class="border p-2 rounded w-full">
    </div>
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
  // fallback
  return `
    <input id="${type}-name" class="border p-2 rounded w-full" placeholder="Nome" required>
    <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>
  `;
}

function listItem(type, id, data) {
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
      ${btn("Editar", "bg-yellow-500 text-white", `data-a="e" data-type="${type}" data-id="${id}"`)}
      ${btn("Excluir", "bg-red-600 text-white", `data-a="d" data-type="${type}" data-id="${id}"`)}
    </div>
  `;
  return li;
}

function bindBasicActions(container) {
  container.querySelectorAll("button[data-a]").forEach(b => {
    b.addEventListener("click", async (e) => {
      const id   = e.currentTarget.getAttribute("data-id");
      const type = e.currentTarget.getAttribute("data-type");
      const a    = e.currentTarget.getAttribute("data-a");

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
          let resp, promptStr;
          if (type === "clientes") {
            promptStr = `Edite: nome, whatsapp, representante\nAtual: ${d.nome||""}, ${d.whatsapp||""}, ${d.representante||""}`;
            resp = prompt(promptStr);
            if (resp == null) return;
            const [nome, whatsappRaw, rep] = resp.split(",").map(s => (s||"").trim());
            const whatsapp = (whatsappRaw || "").replace(/^\+?55/, "");
            await db.collection(type).doc(id).update({ nome, whatsapp, representante: rep || null });
          } else if (type === "representantes") {
            promptStr = `Edite: nome\nAtual: ${d.nome||""}`;
            resp = prompt(promptStr);
            if (resp == null) return;
            await db.collection(type).doc(id).update({ nome: resp.trim() });
          } else if (type === "produtos") {
            promptStr = `Edite: nome, preco, categoria\nAtual: ${d.nome||""}, ${d.preco||0}, ${d.categoria||""}`;
            resp = prompt(promptStr);
            if (resp == null) return;
            const [nome, precoStr, cat] = resp.split(",").map(s => (s||"").trim());
            const preco = parseFloat(precoStr)||0;
            await db.collection(type).doc(id).update({ nome, preco, categoria: cat || null });
          } else {
            promptStr = `Edite: name\nAtual: ${d.name||""}`;
            resp = prompt(promptStr);
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

function renderForm(type) {
  pageContent.innerHTML = `
    ${header(
      type === "clientes" ? "Gerenciar Clientes" :
      type === "representantes" ? "Gerenciar Representantes" :
      type === "produtos" ? "Gerenciar Produtos" : type
    )}
    <form id="${type}-form" class="bg-white p-4 rounded shadow mb-4">
      ${formHTML(type)}
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
        whatsapp = whatsapp.replace(/^\+?55/, ""); // remove +55/55 se vier
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
        const name = document.getElementById(`${type}-name`).value.trim();
        if (!name) return toast("Informe o nome.");
        payload = { ...payload, name };
      }

      await db.collection(type).add(payload);
      form.reset();
      toast("Salvo com sucesso!");
    } catch (err) {
      console.error(err);
      toast("Falha ao salvar: " + (err.message || err));
    }
  });

  waitForAuth().then(user => {
    db.collection(type)
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc") // exige índice
      .onSnapshot(
        (snap) => {
          list.innerHTML = "";
          if (snap.empty) {
            list.innerHTML = `<li class="text-gray-500">Nenhum registro.</li>`;
            return;
          }
          snap.forEach(doc => list.appendChild(listItem(type, doc.id, doc.data())));
          bindBasicActions(list);
        },
        (err) => {
          console.error(err);
          toast("Erro ao listar: " + (err.message || err));
        }
      );
  });
}

// ================== AGENDAMENTOS ======================
function renderAgendamentos() {
  pageContent.innerHTML = `
    ${header("Gerenciar Agendamentos")}
    <form id="agendamento-form" class="bg-white p-4 rounded shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label class="text-sm text-gray-600">Cliente</label>
          <select id="ag-cliente" class="border p-2 rounded w-full"></select>
        </div>
        <div>
          <label class="text-sm text-gray-600">Representante</label>
          <select id="ag-representante" class="border p-2 rounded w-full"></select>
        </div>
        <div>
          <label class="text-sm text-gray-600">Produto</label>
          <select id="ag-produto" class="border p-2 rounded w-full"></select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label class="text-sm text-gray-600">Data</label>
          <input type="date" id="ag-data" class="border p-2 rounded w-full" required>
        </div>
        <div>
          <label class="text-sm text-gray-600">Quantidade</label>
          <input type="number" id="ag-qtd" class="border p-2 rounded w-full" placeholder="Quantidade" required>
        </div>
        <div>
          <label class="text-sm text-gray-600">Observação</label>
          <input type="text" id="ag-obs" class="border p-2 rounded w-full" placeholder="Observação (opcional)">
        </div>
      </div>

      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">Salvar</button>
      <p id="ag-alert" class="text-sm text-red-600 mt-2 hidden"></p>
    </form>

    <ul id="ag-list" class="space-y-2"></ul>
  `;

  const $selCliente = document.getElementById("ag-cliente");
  const $selRep     = document.getElementById("ag-representante");
  const $selProd    = document.getElementById("ag-produto");
  const $form       = document.getElementById("agendamento-form");
  const $list       = document.getElementById("ag-list");
  const $alert      = document.getElementById("ag-alert");

  const setAlert = (msg) => {
    if (!msg) { $alert.classList.add("hidden"); $alert.textContent = ""; }
    else { $alert.classList.remove("hidden"); $alert.textContent = msg; }
  };

  // Carregar selects
  (async () => {
    const user = await waitForAuth();
    const uid = user.uid;

    async function loadOptions(coll, select, labelField = "nome") {
      select.innerHTML = `<option value="">Selecione...</option>`;
      try {
        const snap = await db.collection(coll)
          .where("userId", "==", uid)
          .orderBy("createdAt", "desc") // exige índice
          .get();
        if (snap.empty) {
          const label = coll.charAt(0).toUpperCase() + coll.slice(1);
          select.innerHTML = `<option value="">Cadastre ${label} primeiro</option>`;
          return;
        }
        snap.forEach(doc => {
          const d = doc.data();
          const opt = document.createElement("option");
          opt.value = doc.id;
          opt.textContent = d[labelField] || "(sem nome)";
          opt.setAttribute("data-nome", d[labelField] || "");
          if (coll === "produtos") {
            opt.setAttribute("data-preco", Number(d.preco || 0));
          }
          select.appendChild(opt);
        });
      } catch (err) {
        console.error(err);
        setAlert("Erro ao carregar " + coll + ": " + (err.message || err));
      }
    }

    await loadOptions("clientes", $selCliente, "nome");
    await loadOptions("representantes", $selRep, "nome");
    await loadOptions("produtos", $selProd, "nome");
  })();

  // Salvar agendamento
  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("");

    const user = await waitForAuth();
    const uid = user.uid;

    const clienteId = $selCliente.value;
    const repId     = $selRep.value;
    const prodId    = $selProd.value;

    const clienteNome = $selCliente.selectedOptions[0]?.getAttribute("data-nome") || "";
    const repNome     = $selRep.selectedOptions[0]?.getAttribute("data-nome") || "";
    const prodNome    = $selProd.selectedOptions[0]?.getAttribute("data-nome") || "";
    const prodPreco   = parseFloat($selProd.selectedOptions[0]?.getAttribute("data-preco") || "0") || 0;

    const data        = document.getElementById("ag-data").value;
    const quantidade  = parseFloat(document.getElementById("ag-qtd").value);
    const observacao  = document.getElementById("ag-obs").value.trim();

    if (!clienteId)  return setAlert("Selecione um cliente.");
    if (!repId)      return setAlert("Selecione um representante.");
    if (!prodId)     return setAlert("Selecione um produto.");
    if (!data)       return setAlert("Informe a data.");
    if (!quantidade || quantidade <= 0) return setAlert("Informe uma quantidade válida.");

    try {
      await db.collection("agendamentos").add({
        userId: uid,
        clienteId, clienteNome,
        representanteId: repId, representanteNome: repNome,
        produtoId: prodId, produtoNome: prodNome, produtoPreco: prodPreco,
        data,
        quantidade,
        observacao: observacao || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $form.reset();
      toast("Agendamento salvo!");
    } catch (err) {
      console.error(err);
      setAlert("Erro ao salvar: " + (err.message || err));
    }
  });

  // Listar agendamentos em tempo real
  waitForAuth().then(user => {
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc") // exige índice
      .onSnapshot(
        (snap) => {
          $list.innerHTML = "";
          if (snap.empty) {
            $list.innerHTML = `<li class="text-gray-500">Nenhum agendamento.</li>`;
            return;
          }
          snap.forEach(doc => {
            const d = doc.data();
            const li = document.createElement("li");
            li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
            li.innerHTML = `
              <div>
                <div class="font-semibold">${d.data || "—"} • ${d.clienteNome || "—"}</div>
                <div class="text-sm text-gray-500">
                  Rep: ${d.representanteNome || "—"} • Prod: ${d.produtoNome || "—"} • Qtd: ${d.quantidade || 0}
                </div>
                <div class="text-xs text-gray-400">Obs: ${d.observacao || "—"}</div>
              </div>
              <div class="space-x-2">
                ${btn("Editar", "bg-yellow-500 text-white", `data-a="edit-ag" data-id="${doc.id}"`)}
                ${btn("Excluir", "bg-red-600 text-white", `data-a="del-ag" data-id="${doc.id}"`)}
              </div>
            `;
            $list.appendChild(li);
          });

          // ações
          $list.querySelectorAll('button[data-a="del-ag"]').forEach(b => {
            b.addEventListener("click", async (e) => {
              const id = e.currentTarget.getAttribute("data-id");
              if (!confirm("Excluir este agendamento?")) return;
              try {
                await db.collection("agendamentos").doc(id).delete();
              } catch (err) {
                console.error(err);
                toast("Falha ao excluir: " + (err.message || err));
              }
            });
          });

          $list.querySelectorAll('button[data-a="edit-ag"]').forEach(b => {
            b.addEventListener("click", async (e) => {
              const id = e.currentTarget.getAttribute("data-id");
              try {
                const snap = await db.collection("agendamentos").doc(id).get();
                const d = snap.data() || {};
                const resp = prompt(
                  `Edite: data, quantidade, observacao\nAtual: ${d.data||""}, ${d.quantidade||0}, ${d.observacao||""}`
                );
                if (resp == null) return;
                const [dataStr, qtdStr, obsStr] = resp.split(",").map(s => (s||"").trim());
                const qtd = parseFloat(qtdStr)||0;
                if (!dataStr) return toast("Data inválida.");
                if (!qtd || qtd <= 0) return toast("Quantidade inválida.");
                await db.collection("agendamentos").doc(id).update({
                  data: dataStr,
                  quantidade: qtd,
                  observacao: obsStr || null
                });
              } catch (err) {
                console.error(err);
                toast("Falha ao editar: " + (err.message || err));
              }
            });
          });
        },
        (err) => {
          console.error(err);
          toast("Erro ao listar: " + (err.message || err));
        }
      );
  });
}

// ================== MENU LATERAL ======================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "agendamentos") {
      renderAgendamentos();
    } else {
      renderForm(page);
    }
// ================== IMPORTAÇÃO DE CLIENTES (PLANILHA) ==================
document.getElementById("import-clientes")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const user = await waitForAuth();
    for (let row of rows) {
      const nome = row["Nome"] || row["nome"];
      const whatsapp = row["WhatsApp"] || row["whatsapp"];
      if (nome) {
        await db.collection("clientes").add({
          userId: user.uid,
          nome,
          whatsapp: whatsapp || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    alert("Importação concluída!");
  };
  reader.readAsArrayBuffer(file);
});

  });
});
