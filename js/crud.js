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

// ================== FORMATAÇÕES ==================
function formatQuantidade(num) {
  return Number(num || 0).toLocaleString("pt-BR");
}
function formatMoeda(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2
  });
}
function formatPrecoProduto(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4, maximumFractionDigits: 4
  });
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

// ================== LISTAGEM ==================
function listItem(type, id, data) {
  let main = "";
  if (type === "clientes") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>
            <div class="text-sm text-gray-500">WhatsApp: ${data.whatsapp || "—"} • Rep: ${data.representante || "—"}</div>`;
  } else if (type === "representantes") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>`;
  } else if (type === "produtos") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>
            <div class="text-sm text-gray-500">Preço: ${formatPrecoProduto(data.preco)} • Cat: ${data.categoria || "—"}</div>`;
  }

  const li = document.createElement("li");
  li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
  li.innerHTML = `
    <div>${main}</div>
    <div class="space-x-2">
      <button data-a="e" data-type="${type}" data-id="${id}" class="bg-yellow-500 text-white px-2 py-1 rounded">Editar</button>
      <button data-a="d" data-type="${type}" data-id="${id}" class="bg-red-600 text-white px-2 py-1 rounded">Excluir</button>
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
      }
      if (a === "e") {
        const snap = await db.collection(type).doc(id).get();
        const d = snap.data() || {};
        let resp;
        if (type === "clientes") {
          resp = prompt(`Edite: nome, whatsapp, representante\nAtual: ${d.nome||""}, ${d.whatsapp||""}, ${d.representante||""}`);
          if (!resp) return;
          const [nome, whatsappRaw, rep] = resp.split(",").map(s => (s||"").trim());
          await db.collection(type).doc(id).update({ nome, whatsapp: whatsappRaw, representante: rep });
        } else if (type === "representantes") {
          resp = prompt(`Edite: nome\nAtual: ${d.nome||""}`);
          if (!resp) return;
          await db.collection(type).doc(id).update({ nome: resp.trim() });
        } else if (type === "produtos") {
          resp = prompt(`Edite: nome, preco, categoria\nAtual: ${d.nome||""}, ${d.preco||0}, ${d.categoria||""}`);
          if (!resp) return;
          const [nome, precoStr, cat] = resp.split(",").map(s => (s||"").trim());
          const preco = parseFloat(precoStr)||0;
          await db.collection(type).doc(id).update({ nome, preco, categoria: cat });
        }
      }
    });
  });
}

// ================== AGENDAMENTOS ==================
function renderAgendamentos() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Agendamentos</h2>
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
    <div id="ag-resumo" class="mt-4 p-3 bg-gray-50 rounded"></div>
  `;

  // ... (restante igual ao que já estava no seu projeto)
}

// ================== RELATÓRIOS ==================
let chartRepsInst = null;
let chartClisInst = null;

function renderRelatorios() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Relatórios</h2>
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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="text-sm text-gray-600">Cliente</label>
          <select id="rel-cliente" class="border p-2 rounded w-full">
            <option value="">Todos</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-gray-600">Representante</label>
          <select id="rel-rep" class="border p-2 rounded w-full">
            <option value="">Todos</option>
          </select>
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
      <canvas id="chart-reps" style="height:300px"></canvas>
    </div>
    <div class="bg-white p-4 rounded shadow">
      <h3 class="text-lg font-semibold mb-2">Ranking Clientes</h3>
      <canvas id="chart-clis" style="height:300px"></canvas>
    </div>
  `;

  carregarFiltrosRelatorio();
  document.getElementById("rel-filtrar").addEventListener("click", gerarRelatorio);
  document.getElementById("rel-pdf").addEventListener("click", exportarPDF);
}

async function gerarRelatorio() {
  const user = await waitForAuth();
  const uid = user.uid;

  const start = document.getElementById("rel-start").value;
  const end   = document.getElementById("rel-end").value;
  const clienteSel = document.getElementById("rel-cliente").value;
  const repSel     = document.getElementById("rel-rep").value;

  let query = db.collection("agendamentos").where("userId", "==", uid);
  if (start) query = query.where("data", ">=", start);
  if (end)   query = query.where("data", "<=", end);
  if (clienteSel) query = query.where("clienteNome", "==", clienteSel);
  if (repSel)     query = query.where("representanteNome", "==", repSel);

  const snap = await query.get();

  const porRep = {};
  const porCli = {};

  snap.forEach(doc => {
    const d = doc.data();
    const qtd = d.quantidade || 0;
    porRep[d.representanteNome] = (porRep[d.representanteNome]||0) + qtd;
    porCli[d.clienteNome] = (porCli[d.clienteNome]||0) + qtd;
  });

  // Corrigido: destruir gráficos antigos
  if (chartRepsInst) chartRepsInst.destroy();
  if (chartClisInst) chartClisInst.destroy();

  chartRepsInst = new Chart(document.getElementById("chart-reps"), {
    type: "bar",
    data: { labels: Object.keys(porRep), datasets: [{ label: "Qtd", data: Object.values(porRep), backgroundColor: "orange" }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }} }
  });

  chartClisInst = new Chart(document.getElementById("chart-clis"), {
    type: "bar",
    data: { labels: Object.keys(porCli), datasets: [{ label: "Qtd", data: Object.values(porCli), backgroundColor: "blue" }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }} }
  });
}

// ================== EXPORTAR PDF ==================
// (sua versão já ajustada com zebra table, totais coloridos e gráficos na vertical)

// ================== MENU ==================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "agendamentos") renderAgendamentos();
    else if (page === "relatorios") renderRelatorios();
    else renderForm(page);
  });
});
