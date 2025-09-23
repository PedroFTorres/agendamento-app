// ======================= UTIL =========================
const pageContent = document.getElementById("page-content");

function toast(msg) {
  try { alert(msg); } catch (_) { console.log(msg); }
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

// ================== FORMULÁRIOS ==================
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
  return `
    <input id="${type}-name" class="border p-2 rounded w-full" placeholder="Nome" required>
    <button class="bg-blue-600 text-white p-2 rounded mt-3">Salvar</button>
  `;
}

// ================== LISTAGEM BÁSICA ==================
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
        await db.collection(type).doc(id).delete();
      } else if (a === "e") {
        const snap = await db.collection(type).doc(id).get();
        const d = snap.data() || {};
        let resp;
        if (type === "clientes") {
          resp = prompt(`Edite: nome, whatsapp, representante\nAtual: ${d.nome||""}, ${d.whatsapp||""}, ${d.representante||""}`);
          if (resp == null) return;
          const [nome, whatsappRaw, rep] = resp.split(",").map(s => (s||"").trim());
          const whatsapp = (whatsappRaw || "").replace(/^\+?55/, "");
          await db.collection(type).doc(id).update({ nome, whatsapp, representante: rep || null });
        } else if (type === "representantes") {
          resp = prompt(`Edite: nome\nAtual: ${d.nome||""}`);
          if (resp == null) return;
          await db.collection(type).doc(id).update({ nome: resp.trim() });
        } else if (type === "produtos") {
          resp = prompt(`Edite: nome, preco, categoria\nAtual: ${d.nome||""}, ${d.preco||0}, ${d.categoria||""}`);
          if (resp == null) return;
          const [nome, precoStr, cat] = resp.split(",").map(s => (s||"").trim());
          const preco = parseFloat(precoStr)||0;
          await db.collection(type).doc(id).update({ nome, preco, categoria: cat || null });
        }
      }
    });
  });
}

// ================== RENDER FORM ==================
function renderForm(type) {
  pageContent.innerHTML = `
    ${header(type.charAt(0).toUpperCase() + type.slice(1))}
    <form id="${type}-form" class="bg-white p-4 rounded shadow mb-4">
      ${formHTML(type)}
    </form>
    <ul id="${type}-list" class="space-y-2"></ul>
  `;

  const form = document.getElementById(`${type}-form`);
  const list = document.getElementById(`${type}-list`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();
    const uid = user.uid;

    let payload = { userId: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

    if (type === "clientes") {
      const nome = document.getElementById("clientes-nome").value.trim();
      let whatsapp = document.getElementById("clientes-whatsapp").value.trim();
      const representante = document.getElementById("clientes-rep").value.trim();
      if (!nome) return toast("Informe o nome do cliente.");
      whatsapp = whatsapp.replace(/^\+?55/, "");
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
    }

    await db.collection(type).add(payload);
    form.reset();
    toast("Salvo com sucesso!");
  });

  waitForAuth().then(user => {
    db.collection(type)
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        list.innerHTML = "";
        if (snap.empty) {
          list.innerHTML = `<li class="text-gray-500">Nenhum registro.</li>`;
          return;
        }
        snap.forEach(doc => list.appendChild(listItem(type, doc.id, doc.data())));
        bindBasicActions(list);
      });
  });

  // Importação de planilha para clientes
  if (type === "clientes") {
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
  }
}

// ================== AGENDAMENTOS ==================
function renderAgendamentos() {
  pageContent.innerHTML = `
    ${header("Agendamentos")}
    <form id="agendamento-form" class="bg-white p-4 rounded shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select id="ag-cliente" class="border p-2 rounded w-full"></select>
        <select id="ag-representante" class="border p-2 rounded w-full"></select>
        <select id="ag-produto" class="border p-2 rounded w-full"></select>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="date" id="ag-data" class="border p-2 rounded w-full" required>
        <input type="number" id="ag-qtd" class="border p-2 rounded w-full" placeholder="Quantidade" required>
        <input type="text" id="ag-obs" class="border p-2 rounded w-full" placeholder="Observação (opcional)">
      </div>
      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">Salvar</button>
    </form>
    <ul id="ag-list" class="space-y-2"></ul>
  `;

  const $selCliente = document.getElementById("ag-cliente");
  const $selRep = document.getElementById("ag-representante");
  const $selProd = document.getElementById("ag-produto");
  const $form = document.getElementById("agendamento-form");
  const $list = document.getElementById("ag-list");

  async function loadOptions(coll, select, labelField = "nome") {
    const user = await waitForAuth();
    select.innerHTML = `<option value="">Selecione ${coll}</option>`;
    const snap = await db.collection(coll)
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();
    snap.forEach(doc => {
      const d = doc.data();
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = d[labelField] || "(sem nome)";
      select.appendChild(opt);
    });
  }

  loadOptions("clientes", $selCliente);
  loadOptions("representantes", $selRep);
  loadOptions("produtos", $selProd);

  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();
    const clienteNome = $selCliente.selectedOptions[0]?.textContent || "";
    const repNome = $selRep.selectedOptions[0]?.textContent || "";
    const prodNome = $selProd.selectedOptions[0]?.textContent || "";
    const data = document.getElementById("ag-data").value;
    const quantidade = parseInt(document.getElementById("ag-qtd").value);
    const observacao = document.getElementById("ag-obs").value;
    await db.collection("agendamentos").add({
      userId: user.uid,
      clienteNome,
      representanteNome: repNome,
      produtoNome: prodNome,
      data,
      quantidade,
      observacao,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    $form.reset();
  });

  waitForAuth().then(user => {
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
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
              <div class="font-semibold">${d.data} • ${d.clienteNome}</div>
              <div class="text-sm text-gray-500">Rep: ${d.representanteNome} • Prod: ${d.produtoNome} • Qtd: ${d.quantidade}</div>
            </div>
            <button data-id="${doc.id}" class="bg-red-600 text-white px-2 py-1 rounded">Excluir</button>
          `;
          $list.appendChild(li);
          li.querySelector("button").addEventListener("click", async () => {
            if (confirm("Excluir este agendamento?")) {
              await db.collection("agendamentos").doc(doc.id).delete();
            }
          });
        });
      });
  });
}

// ================== RELATÓRIOS ==================
function renderRelatorios() {
  pageContent.innerHTML = `
    ${header("Relatórios")}
    <div class="bg-white p-4 rounded shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="text-sm text-gray-600">Data Início</label>
          <input type="date" id="rel-start" class="border p-2 rounded w-full">
        </div>
        <div>
          <label class="text-sm text-gray-600">Data Fim</label>
          <input type="date" id="rel-end" class="border p-2 rounded w-full">
        </div>
      </div>
      <button id="rel-filtrar" class="bg-blue-600 text-white p-2 rounded w-full">Filtrar</button>
      <button id="rel-pdf" class="bg-green-600 text-white p-2 rounded w-full">Exportar PDF</button>
    </div>
    <div class="bg-white p-4 rounded shadow mb-4">
      <h3 class="text-lg font-semibold mb-2">Totais</h3>
      <div id="rel-totais">Selecione um período.</div>
    </div>
    <div class="bg-white p-4 rounded shadow mb-4">
      <h3 class="text-lg font-semibold mb-2">Ranking Representantes</h3>
      <canvas id="chart-reps" height="100"></canvas>
    </div>
    <div class="bg-white p-4 rounded shadow">
      <h3 class="text-lg font-semibold mb-2">Ranking Clientes</h3>
      <canvas id="chart-clis" height="100"></canvas>
    </div>
  `;

  document.getElementById("rel-filtrar").addEventListener("click", gerarRelatorio);
  document.getElementById("rel-pdf").addEventListener("click", exportarPDF);
}

async function gerarRelatorio() {
  const user = await waitForAuth();
  const uid = user.uid;

  const start = document.getElementById("rel-start").value;
  const end   = document.getElementById("rel-end").value;

  let query = db.collection("agendamentos").where("userId", "==", uid);
  if (start) query = query.where("data", ">=", start);
  if (end)   query = query.where("data", "<=", end);

  const snap = await query.get();

  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};
  const porCli = {};

  snap.forEach(doc => {
    const d = doc.data();
    const qtd = d.quantidade || 0;
    totalGeral += qtd;
    porProduto[d.produtoNome] = (porProduto[d.produtoNome]||0
