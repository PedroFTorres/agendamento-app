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
  return Number(num || 0).toLocaleString("pt-BR"); // 15.000
}
function formatMoeda(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2
  }); // R$ 788,00
}
function formatPrecoProduto(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4, maximumFractionDigits: 4
  }); // 4 casas decimais
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

// ================== RENDER FORM ==================
function renderForm(type) {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
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
      payload.nome = document.getElementById("clientes-nome").value.trim();
      payload.whatsapp = document.getElementById("clientes-whatsapp").value.trim();
      payload.representante = document.getElementById("clientes-rep").value.trim();
    } else if (type === "representantes") {
      payload.nome = document.getElementById("representantes-nome").value.trim();
    } else if (type === "produtos") {
      payload.nome = document.getElementById("produtos-nome").value.trim();
      payload.preco = parseFloat(document.getElementById("produtos-preco").value)||0;
      payload.categoria = document.getElementById("produtos-categoria").value.trim();
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

  // Importação de planilha (clientes)
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
              whatsapp,
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
        const resumo = {};
        snap.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("li");
          li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
          li.innerHTML = `
            <div>
              <div class="font-semibold">${d.data} • ${d.clienteNome}</div>
              <div class="text-sm text-gray-500">Rep: ${d.representanteNome} • Prod: ${d.produtoNome} • Qtd: ${formatQuantidade(d.quantidade)}</div>
            </div>
            <button data-id="${doc.id}" class="bg-red-600 text-white px-2 py-1 rounded">Excluir</button>
          `;
          $list.appendChild(li);
          li.querySelector("button").addEventListener("click", async () => {
            if (confirm("Excluir este agendamento?")) {
              await db.collection("agendamentos").doc(doc.id).delete();
            }
          });
          // resumo diário/produto
          const key = `${d.data} - ${d.produtoNome}`;
          resumo[key] = (resumo[key] || 0) + (d.quantidade || 0);
        });
        // renderizar resumo
        let htmlResumo = "<h4 class='font-semibold mb-2'>Totais por dia/produto</h4><ul>";
        for (const [k, v] of Object.entries(resumo)) {
          htmlResumo += `<li>${k}: ${formatQuantidade(v)}</li>`;
        }
        htmlResumo += "</ul>";
        document.getElementById("ag-resumo").innerHTML = htmlResumo;
      });
  });
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

async function carregarFiltrosRelatorio() {
  const user = await waitForAuth();
  const uid = user.uid;

  // Clientes
  const cliSnap = await db.collection("clientes").where("userId", "==", uid).get();
  const selCli = document.getElementById("rel-cliente");
  cliSnap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = d.nome;
    opt.textContent = d.nome;
    selCli.appendChild(opt);
  });

  // Representantes
  const repSnap = await db.collection("representantes").where("userId", "==", uid).get();
  const selRep = document.getElementById("rel-rep");
  repSnap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = d.nome;
    opt.textContent = d.nome;
    selRep.appendChild(opt);
  });
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

  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};
  const porCli = {};
  const linhasTabela = [];

  snap.forEach(doc => {
    const d = doc.data();
    const qtd = d.quantidade || 0;
    totalGeral += qtd;
    porProduto[d.produtoNome] = (porProduto[d.produtoNome]||0) + qtd;
    porRep[d.representanteNome] = (porRep[d.representanteNome]||0) + qtd;
    porCli[d.clienteNome] = (porCli[d.clienteNome]||0) + qtd;

    linhasTabela.push({ cliente: d.clienteNome || "-", produto: d.produtoNome || "-", qtd });
  });

  // Totais (HTML)
  let html = `<p><strong>Total Geral:</strong> ${formatQuantidade(totalGeral)}</p><ul>`;
  for (const [prod, qtd] of Object.entries(porProduto)) {
    html += `<li>${prod}: ${formatQuantidade(qtd)}</li>`;
  }
  html += "</ul>";
  document.getElementById("rel-totais").innerHTML = html;

  // 🔧 corrige rolagem infinita (destrói instâncias antigas)
  if (chartRepsInst) chartRepsInst.destroy();
  if (chartClisInst) chartClisInst.destroy();

  chartRepsInst = new Chart(document.getElementById("chart-reps"), {
    type: "bar",
    data: {
      labels: Object.keys(porRep),
      datasets: [{ label: "Qtd", data: Object.values(porRep), backgroundColor: "orange" }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }} }
  });

  chartClisInst = new Chart(document.getElementById("chart-clis"), {
    type: "bar",
    data: {
      labels: Object.keys(porCli),
      datasets: [{ label: "Qtd", data: Object.values(porCli), backgroundColor: "blue" }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }} }
  });

  // cache para PDF
  window.__REL_CACHE__ = { start, end, linhasTabela, totalGeral, porProduto };
}

// ================== EXPORTAR PDF ==================
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  // Cabeçalho (sem logo externa p/ evitar CORS)
  doc.setFontSize(14);
  doc.text("Cerâmica Fortes LTDA", 10, 15);
  doc.setFontSize(11);
  doc.text("Relatório de Agendamentos", 10, 22);

  const cache = window.__REL_CACHE__ || { start: "", end: "", linhasTabela: [], totalGeral: 0, porProduto: {} };

  // Período dd/MM/yyyy
  const fmt = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";
  const periodo = cache.start && cache.end ? `Período: ${fmt(cache.start)} a ${fmt(cache.end)}` : "Período não informado";
  doc.setFontSize(10);
  doc.text(periodo, 10, 35);

  // Tabela zebra: Cliente / Produto / Qtd
  let y = 45;
  doc.setFontSize(11);
  doc.text("Clientes e Produtos", 10, y);
  y += 5;

  // Cabeçalho da tabela
  const xCli = 10, wCli = 80;
  const xProd = xCli + wCli, wProd = 80;
  const xQtd = xProd + wProd, wQtd = 30;
  const rowH = 8;

  doc.setFontSize(9);
  doc.setFillColor(200, 200, 200); // cinza claro
  doc.rect(xCli, y - 4, wCli + wProd + wQtd, rowH, "F");
  doc.setTextColor(0, 0, 0);
  doc.text("Cliente", xCli + 2, y);
  doc.text("Produto", xProd + 2, y);
  doc.text("Qtd", xQtd + 2, y);
  y += rowH;

  // Linhas (zebra)
  let rowIndex = 0;
  cache.linhasTabela.forEach(({ cliente, produto, qtd }) => {
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(xCli, y - 4, wCli + wProd + wQtd, rowH, "F");
    }
    doc.setTextColor(0, 0, 0);
    doc.text(String(cliente || "-").substring(0, 40), xCli + 2, y);
    doc.text(String(produto || "-").substring(0, 40), xProd + 2, y);
    doc.text(formatQuantidade(qtd), xQtd + 2, y);

    y += rowH; rowIndex++;
    if (y > 250) { doc.addPage(); y = 20; }
  });

  // Totais
  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total Geral: ${formatQuantidade(cache.totalGeral)}`, xCli, y);

  const cores = [
    [255, 99, 132],
    [54, 162, 235],
    [255, 206, 86],
    [75, 192, 192],
    [153, 102, 255],
    [255, 159, 64]
  ];
  let i = 0;
  y += 8;
  for (const [prod, qtd] of Object.entries(cache.porProduto || {})) {
    const [r, g, b] = cores[i % cores.length];
    doc.setTextColor(r, g, b);
    doc.text(`Produto ${prod}: ${formatQuantidade(qtd)}`, xCli, y);
    y += 6; i++;
    if (y > 270) { doc.addPage(); y = 20; }
  }

  // Gráficos na mesma página (vertical, menores)
  try {
    const chartReps = document.getElementById("chart-reps");
    const chartClis = document.getElementById("chart-clis");
    if (chartReps && chartClis) {
      const img1 = chartReps.toDataURL("image/png", 1.0);
      const img2 = chartClis.toDataURL("image/png", 1.0);

      doc.addPage();
      doc.setTextColor(0, 0, 0);
      doc.text("Gráficos", 10, 15);

      doc.text("Ranking de Representantes", 10, 25);
      doc.addImage(img1, "PNG", 10, 30, 180, 55); // menor

      doc.text("Ranking de Clientes", 10, 90);
      doc.addImage(img2, "PNG", 10, 95, 180, 55); // menor
    }
  } catch (e) {
    console.log("Erro ao adicionar gráficos no PDF", e);
  }

  doc.save("relatorio.pdf");
}

// ================== MENU ==================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "agendamentos") renderAgendamentos();
    else if (page === "relatorios") renderRelatorios();
    else renderForm(page);
  });
});

