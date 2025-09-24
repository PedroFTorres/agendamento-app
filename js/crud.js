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

// ================== FORMATAR DATA BR COM DIA DA SEMANA ==================
function formatarDataBR(dateStr) {
  // dateStr vem como "YYYY-MM-DD"
  const [ano, mes, dia] = dateStr.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;

  // criar Date só para pegar o dia da semana
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`); // força meia-noite local
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });

  return `${dataFormatada} - ${diaSemana}`;
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

// ================== CARREGAR SELECTS ==================
async function carregarSelect(collection, selectId, uid) {
  try {
    const snap = await db.collection(collection).where("userId", "==", uid).get();
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = `<option value="">Selecione ${collection}</option>`;
    snap.forEach(doc => {
      const d = doc.data() || {};
      const opt = document.createElement("option");
      opt.value = d.nome || "";
      opt.textContent = d.nome || "(sem nome)";
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Erro ao carregar select:", collection, e);
  }
}

// Função auxiliar para formatar a data no formato BR com dia da semana
function formatarDataBR(dateStr) {
  const data = new Date(dateStr);
  return data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// ================== AGENDAMENTOS ==================
// Função auxiliar para formatar a data no formato BR com dia da semana
function formatarDataBR(dateStr) {
  const data = new Date(dateStr);
  return data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// ================== AGENDAMENTOS ==================
function renderAgendamentos() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Agendamentos</h2>
    <form id="form-agendamento" class="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
      <select id="ag-cliente" class="border p-2 rounded col-span-2"></select>
      <select id="ag-rep" class="border p-2 rounded col-span-2"></select>
      <select id="ag-prod" class="border p-2 rounded col-span-2"></select>
      <input id="ag-data" type="date" class="border p-2 rounded">
      <input id="ag-qtd" type="number" placeholder="Quantidade" class="border p-2 rounded">
      <input id="ag-obs" placeholder="Observação (opcional)" class="border p-2 rounded col-span-2">
      <button id="ag-salvar" type="submit" class="bg-blue-600 text-white p-2 rounded col-span-6">Salvar</button>
    </form>
    <div id="lista-agendamentos" class="space-y-4"></div>
  `;

  let editId = null;
  const btnSalvar = document.getElementById("ag-salvar");

  waitForAuth().then(user => {
    carregarSelect("clientes", "ag-cliente", user.uid);
    carregarSelect("representantes", "ag-rep", user.uid);
    carregarSelect("produtos", "ag-prod", user.uid);

    // salvar ou atualizar
    document.getElementById("form-agendamento").addEventListener("submit", async e => {
      e.preventDefault();
      const data = {
        userId: user.uid,
        clienteNome: document.getElementById("ag-cliente").value,
        representanteNome: document.getElementById("ag-rep").value,
        produtoNome: document.getElementById("ag-prod").value,
        data: document.getElementById("ag-data").value,
        quantidade: parseFloat(document.getElementById("ag-qtd").value) || 0,
        observacao: document.getElementById("ag-obs").value,
        createdAt: new Date().toISOString()
      };

      if (editId) {
        await db.collection("agendamentos").doc(editId).update(data);
        editId = null;
        btnSalvar.textContent = "Salvar";
        toast("Agendamento atualizado!");
      } else {
        await db.collection("agendamentos").add(data);
        toast("Agendamento salvo!");
      }
      e.target.reset();
    });

    // listar agrupado por dia
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("data", "desc")
      .onSnapshot(snap => {
        const lista = document.getElementById("lista-agendamentos");
        if (!lista) return; // segurança
        lista.innerHTML = "";

        // agrupar por data
        const grupos = {};
        snap.forEach(doc => {
          const d = doc.data();
          if (!grupos[d.data]) grupos[d.data] = [];
          grupos[d.data].push({ id: doc.id, ...d });
        });

        // renderizar grupos
        Object.keys(grupos).sort((a, b) => b.localeCompare(a)).forEach(dataStr => {
          const bloco = document.createElement("div");
          bloco.className = "bg-white rounded shadow p-3";

          // cabeçalho com data formatada
          const header = document.createElement("h3");
          header.className = "text-blue-700 font-bold text-xl mb-2";
          header.textContent = formatarDataBR(dataStr);
          bloco.appendChild(header);

          // calcular totais do dia por produto
          const produtosDia = {};
          grupos[dataStr].forEach(item => {
  produtosDia[item.produtoNome] = (produtosDia[item.produtoNome] || 0) + (item.quantidade || 0);
});

         // mapa de cores por produto
const coresProdutos = {
  "Telha Canal": "bg-blue-100 text-blue-800",
  "Telha Colonial": "bg-green-100 text-green-800",
  "Tijolo 6 furos": "bg-purple-100 text-purple-800",
  "Tijolo 8 furos": "bg-pink-100 text-pink-800"
};

// exibir totais do dia com cores diferentes
const totais = document.createElement("div");
totais.className = "flex flex-wrap gap-2 mb-3";

Object.entries(produtosDia).forEach(([prod, qtd]) => {
  const span = document.createElement("span");
  const cor = coresProdutos[prod] || "bg-gray-100 text-gray-800"; // cor padrão se não tiver mapeado
  span.className = `${cor} font-semibold px-2 py-1 rounded`;
  span.textContent = `${prod}: ${formatQuantidade(qtd)}`;
  totais.appendChild(span);
});

bloco.appendChild(totais);
          
          const ul = document.createElement("ul");
          ul.className = "space-y-2";

          grupos[dataStr].forEach(item => {
            const li = document.createElement("li");
            li.className = "p-2 bg-gray-50 rounded flex justify-between items-center";

            li.innerHTML = `
              <div>
                <div class="font-bold">${item.clienteNome}</div>
                <div class="text-sm text-gray-500">
                  Rep: ${item.representanteNome} • Prod: ${item.produtoNome} • Qtd: ${formatQuantidade(item.quantidade)}
                </div>
              </div>
              <div class="space-x-2">
                <button class="btn-editar bg-yellow-500 text-white px-2 py-1 rounded" data-id="${item.id}">Editar</button>
                <button class="btn-excluir bg-red-600 text-white px-2 py-1 rounded" data-id="${item.id}">Excluir</button>
              </div>
            `;

            ul.appendChild(li);
          });

          bloco.appendChild(ul);
          lista.appendChild(bloco);
        });

        // excluir
        document.querySelectorAll(".btn-excluir").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (confirm("Excluir este agendamento?")) {
              await db.collection("agendamentos").doc(btn.dataset.id).delete();
            }
          });
        });

        // editar
        document.querySelectorAll(".btn-editar").forEach(btn => {
          btn.addEventListener("click", async () => {
            const docSnap = await db.collection("agendamentos").doc(btn.dataset.id).get();
            const d = docSnap.data();
            document.getElementById("ag-cliente").value = d.clienteNome;
            document.getElementById("ag-rep").value = d.representanteNome;
            document.getElementById("ag-prod").value = d.produtoNome;
            document.getElementById("ag-data").value = d.data;
            document.getElementById("ag-qtd").value = d.quantidade;
            document.getElementById("ag-obs").value = d.observacao || "";
            editId = btn.dataset.id;
            btnSalvar.textContent = "Atualizar";
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        });
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

<div class="grid grid-cols-2 gap-2 mt-2">
  <button id="rel-pdf-portrait" class="bg-green-600 text-white p-2 rounded w-full">
    Exportar PDF (Retrato)
  </button>
  <button id="rel-pdf-landscape" class="bg-green-600 text-white p-2 rounded w-full">
    Exportar PDF (Paisagem)
  </button>
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
 document.getElementById("rel-pdf-portrait")
  .addEventListener("click", () => exportarPDF("portrait"));

document.getElementById("rel-pdf-landscape")
  .addEventListener("click", () => exportarPDF("landscape"));
}

async function carregarFiltrosRelatorio() {
  const user = await waitForAuth();
  const uid = user.uid;

  const cliSnap = await db.collection("clientes").where("userId", "==", uid).get();
  const selCli = document.getElementById("rel-cliente");
  cliSnap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = d.nome;
    opt.textContent = d.nome;
    selCli.appendChild(opt);
  });

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

  let html = `<p><strong>Total Geral:</strong> ${formatQuantidade(totalGeral)}</p><ul>`;
  for (const [prod, qtd] of Object.entries(porProduto)) {
    html += `<li>${prod}: ${formatQuantidade(qtd)}</li>`;
  }
  html += "</ul>";
  document.getElementById("rel-totais").innerHTML = html;

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

  window.__REL_CACHE__ = { start, end, linhasTabela, totalGeral, porProduto, porRep, porCli };
}

// ================== EXPORTAR PDF ==================
function exportarPDF(orientacao = "portrait") {
  if (!window.__REL_CACHE__) {
    alert("Gere o relatório antes de exportar.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const orient = orientacao === "landscape" ? "l" : "p";
  const doc = new jsPDF(orient, "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString("pt-BR");

  const logoImg = new Image();
  logoImg.src = "img/logo.png"; // caminho relativo à raiz do projeto

  logoImg.onload = function () {
    // ===== Cabeçalho =====
    doc.addImage(logoImg, "PNG", 10, 5, 25, 25);
    doc.setFontSize(14);
    doc.text("Cerâmica Fortes LTDA", 40, 15);
    doc.setFontSize(12);
    doc.text("Juntos somos mais Fortes", 40, 22);
    doc.setFontSize(10);
    doc.text(`Relatório gerado em: ${dataFormatada}`, pageWidth - 60, 15);

    let y = 40;

    // ===== Agendamentos Detalhados =====
    doc.setFontSize(12);
    doc.text("Agendamentos Detalhados", 10, y);
    y += 6;

    const linhas = window.__REL_CACHE__.linhasTabela.map(l => ([
      l.cliente,
      l.produto,
      formatQuantidade(l.qtd)
    ]));

    doc.autoTable({
      head: [["Cliente", "Produto", "Quantidade"]],
      body: linhas,
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 165, 0], halign: "center" },
      alternateRowStyles: { fillColor: [255, 235, 205] }
    });

    y = doc.lastAutoTable.finalY + 10;

    // ===== Totais por Produto =====
    doc.text("Totais por Produto", 10, y);
    y += 6;

    const linhasProd = Object.entries(window.__REL_CACHE__.porProduto).map(([prod, qtd]) => ([
      prod, formatQuantidade(qtd)
    ]));

    doc.autoTable({
      head: [["Produto", "Quantidade"]],
      body: linhasProd,
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 165, 0], halign: "center" },
      alternateRowStyles: { fillColor: [255, 235, 205] }
    });

    y = doc.lastAutoTable.finalY + 10;

    // ===== Totais por Representante =====
    doc.text("Totais por Representante", 10, y);
    y += 6;

    const linhasRep = Object.entries(window.__REL_CACHE__.porRep || {}).map(([rep, qtd]) => ([
      rep, formatQuantidade(qtd)
    ]));

    doc.autoTable({
      head: [["Representante", "Quantidade"]],
      body: linhasRep,
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 165, 0], halign: "center" },
      alternateRowStyles: { fillColor: [255, 235, 205] }
    });

    y = doc.lastAutoTable.finalY + 10;

    // ===== Total Geral =====
    doc.setFontSize(12);
    doc.text(`TOTAL GERAL: ${formatQuantidade(window.__REL_CACHE__.totalGeral)}`, 10, y);

    // ===== Gráficos =====
    const chartReps = document.getElementById("chart-reps");
    const chartClis = document.getElementById("chart-clis");

    if (chartReps && chartClis) {
      const imgReps = chartReps.toDataURL("image/png", 1.0);
      const imgClis = chartClis.toDataURL("image/png", 1.0);

      doc.addPage(orient, "mm", "a4");
      doc.setFontSize(12);
      doc.text("Gráficos", 10, 15);

      doc.addImage(imgReps, "PNG", 10, 25, pageWidth - 20, 80);
      doc.addImage(imgClis, "PNG", 10, 120, pageWidth - 20, 80);
    }

    // ===== Rodapé =====
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, pageHeight - 10);
    }

    // Salvar PDF
    const fileName = orientacao === "landscape" ? "relatorio-landscape.pdf" : "relatorio-portrait.pdf";
    doc.save(fileName);
  };
}

// ================== DASHBOARD COM FULLCALENDAR ==================
function renderDashboard() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Calendário de Agendamentos</h2>
    <div id="calendar" class="bg-white p-4 rounded shadow"></div>
  `;

  waitForAuth().then(user => {
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .onSnapshot(snap => {
        const eventos = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            title: `${d.clienteNome} • ${d.produtoNome} (${d.quantidade})`,
            start: d.data,
            extendedProps: {
              representante: d.representanteNome,
              observacao: d.observacao
            }
          };
        });

        const calendarEl = document.getElementById("calendar");
        calendarEl.innerHTML = "";

        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: "dayGridMonth",
          locale: "pt-br",
          height: "auto",
          headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
          },
          events: eventos,
          eventClick: function(info) {
            const ev = info.event;
            alert(
              `Cliente: ${ev.title}\n` +
              `Representante: ${ev.extendedProps.representante}\n` +
              `Observação: ${ev.extendedProps.observacao || "—"}`
            );
          }
        });

        calendar.render();
      });
  });
}

// ================== MENU ==================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "agendamentos") renderAgendamentos();
    else if (page === "relatorios") renderRelatorios();
    else if (page === "dashboard") renderDashboard();
    else renderForm(page);
  });
});
