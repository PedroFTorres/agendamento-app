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
  `;

  const $selCliente = document.getElementById("ag-cliente");
  const $selRep     = document.getElementById("ag-representante");
  const $selProd    = document.getElementById("ag-produto");
  const $form       = document.getElementById("agendamento-form");
  const $list       = document.getElementById("ag-list");

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
    const repNome     = $selRep.selectedOptions[0]?.textContent || "";
    const prodNome    = $selProd.selectedOptions[0]?.textContent || "";
    const data        = document.getElementById("ag-data").value;
    const quantidade  = parseInt(document.getElementById("ag-qtd").value);
    const observacao  = document.getElementById("ag-obs").value;

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

  // Helpers
  function diaSemanaPT(dateStr) {
    const nomes = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
    const dt = new Date(dateStr + "T00:00:00");
    return nomes[dt.getDay()];
  }
  function dataCurtaBR(dateStr) {
    const [y,m,d] = dateStr.split("-");
    return `${d}/${m}`;
  }

  // Listagem agrupada
  waitForAuth().then(user => {
    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("data", "asc")
      .onSnapshot(snap => {
        $list.innerHTML = "";

        if (snap.empty) {
          $list.innerHTML = `<li class="text-gray-500">Nenhum agendamento.</li>`;
          return;
        }

        const agPorDia = {};
        snap.forEach(doc => {
          const d = doc.data();
          const dia = d.data || "";
          if (!agPorDia[dia]) agPorDia[dia] = [];
          agPorDia[dia].push({ id: doc.id, ...d });
        });

        Object.keys(agPorDia).sort().forEach(dia => {
          // Cabeçalho
          const header = document.createElement("li");
          header.className = "px-3 py-2 rounded border-l-4 border-blue-600 bg-blue-50 text-blue-700 font-bold";
          header.textContent = `${dataCurtaBR(dia)} - ${diaSemanaPT(dia)}`;
          $list.appendChild(header);

          // Resumo por produto
          const totaisPorProd = {};
          agPorDia[dia].forEach(item => {
            totaisPorProd[item.produtoNome] = (totaisPorProd[item.produtoNome] || 0) + (item.quantidade || 0);
          });

          const resumoDia = document.createElement("div");
          resumoDia.className = "ml-4 mb-2 flex flex-wrap gap-3";

          const coresBg = [
            "bg-yellow-300 text-black",
            "bg-green-300 text-black",
            "bg-pink-300 text-black",
            "bg-blue-300 text-black",
            "bg-orange-300 text-black"
          ];
          let corIndex = 0;

          Object.entries(totaisPorProd).forEach(([prod, qtd]) => {
            const span = document.createElement("span");
            span.className = `${coresBg[corIndex % coresBg.length]} px-2 py-1 rounded`;
            span.style.fontFamily = '"Courier New", monospace';
            span.textContent = `${prod}: ${formatQuantidade(qtd)}`;
            resumoDia.appendChild(span);
            corIndex++;
          });

          $list.appendChild(resumoDia);

          // Itens do dia
          agPorDia[dia].forEach(item => {
            const li = document.createElement("li");
            li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
            li.innerHTML = `
              <div>
                <div class="font-semibold">${item.clienteNome}</div>
                <div class="text-sm text-gray-500">
                  Rep: ${item.representanteNome || "-"} • Prod: ${item.produtoNome || "-"} • Qtd: ${formatQuantidade(item.quantidade)}
                </div>
                ${item.observacao ? `<div class="text-xs text-gray-400 mt-1">Obs: ${item.observacao}</div>` : ""}
              </div>
              <button data-id="${item.id}" class="bg-red-600 text-white px-2 py-1 rounded">Excluir</button>
            `;
            $list.appendChild(li);

            li.querySelector("button").addEventListener("click", async () => {
              if (confirm("Excluir este agendamento?")) {
                await db.collection("agendamentos").doc(item.id).delete();
              }
            });
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

    // Totais
    porProduto[d.produtoNome] = (porProduto[d.produtoNome] || 0) + qtd;
    porRep[d.representanteNome] = (porRep[d.representanteNome] || 0) + qtd;
    porCli[d.clienteNome] = (porCli[d.clienteNome] || 0) + qtd;

    // Linha detalhada (agora inclui a data do carregamento)
    linhasTabela.push({
      cliente: d.clienteNome || "-",
      produto: d.produtoNome || "-",
      representante: d.representanteNome || "-",
      qtd: qtd,
      data: d.data || "-"
    });
  });

  // Renderiza os totais na tela
  let html = `<p><strong>Total Geral:</strong> ${formatQuantidade(totalGeral)}</p><ul>`;
  for (const [prod, qtd] of Object.entries(porProduto)) {
    html += `<li>${prod}: ${formatQuantidade(qtd)}</li>`;
  }
  html += "</ul>";
  document.getElementById("rel-totais").innerHTML = html;

  // Gráficos
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

  // Cache para exportar PDF
  window.__REL_CACHE__ = { start, end, linhasTabela, totalGeral, porProduto, porRep };
}

// ================== EXPORTAR PDF ==================

async function exportarPDF() {
  if (!window.__REL_CACHE__) {
    alert("Nenhum relatório carregado para exportar.");
    return;
  }

  const { start, end, linhasTabela, totalGeral, porProduto, porRep } = window.__REL_CACHE__;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Auxiliar para formatar datas YYYY-MM-DD → DD/MM/YYYY
  function formatDateBR(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // Função para quebrar texto em várias linhas
  function wrapText(doc, text, x, y, maxWidth) {
    const words = (text || "").split(" ");
    let line = "";
    let currentY = y;

    words.forEach(word => {
      const testLine = line + word + " ";
      const testWidth = doc.getTextWidth(testLine);
      if (testWidth > maxWidth) {
        doc.text(line.trim(), x, currentY);
        currentY += 5; // espaço entre linhas
        line = word + " ";
      } else {
        line = testLine;
      }
    });

    if (line) {
      doc.text(line.trim(), x, currentY);
    }

    return currentY; // retorna a última linha usada
  }

  // ===== Cabeçalho =====
  try {
    const logo = await fetch("img/logo.png").then(r => r.blob()).then(b => {
      return new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(b);
      });
    });
    doc.addImage(logo, "PNG", 14, 10, 20, 20);
  } catch (err) {
    console.warn("Logo não encontrada em img/logo.png");
  }

  doc.setFontSize(16);
  doc.text("Cerâmica Fortes", 40, 18);
  doc.setFontSize(10);
  doc.text("Juntos Somos Mais Fortes", 40, 24);

  // Data de emissão
  const hoje = new Date().toLocaleDateString("pt-BR");
  doc.setFontSize(10);
  doc.text(`Data: ${hoje}`, 160, 18);

  // Observação do filtro
  let filtroTexto = "";
  if (start && end) {
    filtroTexto = `Agendamentos dos dias ${formatDateBR(start)} até ${formatDateBR(end)}`;
  } else if (start) {
    filtroTexto = `Agendamentos a partir de ${formatDateBR(start)}`;
  } else if (end) {
    filtroTexto = `Agendamentos até ${formatDateBR(end)}`;
  } else {
    filtroTexto = "Agendamentos (todos os dias)";
  }

  doc.setFontSize(11);
  doc.text(filtroTexto, 14, 34);

  let y = 50;

  // ================== Agendamentos ==================
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Agendamentos", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("courier", "normal");

  // Cabeçalho da tabela
  doc.setFillColor(200, 200, 200);
  doc.rect(14, y - 5, 180, 8, "F");
  doc.text("Cliente", 16, y);
  doc.text("Produto", 70, y);
  doc.text("Qtd", 120, y);
  doc.text("Data do Carregamento", 140, y);
  y += 6;

  let rowIndex = 0;
  linhasTabela.forEach(row => {
    if (y > 270) { doc.addPage(); y = 20; }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(255, 229, 204); // laranja claro
      doc.rect(14, y - 4, 180, 6, "F");
    }

    // Cliente com quebra automática
    let endY = wrapText(doc, row.cliente, 16, y, 50);

    // Produto (não precisa quebrar tanto)
    doc.text(row.produto, 70, y, { maxWidth: 40 });

    // Quantidade e Data (sempre na mesma linha inicial)
    doc.text(formatQuantidade(row.qtd), 120, y, { align: "right" });
    doc.text(formatDateBR(row.data), 140, y);

    // Ajusta Y para próxima linha (pega a última linha usada pelo cliente)
    y = Math.max(endY, y) + 6;
    rowIndex++;
  });

  y += 10;

  // ================== Totais por Produto ==================
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Totais por Produto", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("courier", "normal");

  doc.setFillColor(200, 200, 200);
  doc.rect(14, y - 5, 180, 8, "F");
  doc.text("Produto", 16, y);
  doc.text("Quantidade", 160, y);
  y += 6;

  rowIndex = 0;
  Object.entries(porProduto).forEach(([prod, qtd]) => {
    if (y > 270) { doc.addPage(); y = 20; }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(255, 229, 204);
      doc.rect(14, y - 4, 180, 6, "F");
    }

    doc.text(prod, 16, y, { maxWidth: 60 });
    doc.text(formatQuantidade(qtd), 160, y, { align: "right" });

    y += 6;
    rowIndex++;
  });

  y += 10;

  // ================== Totais por Representante ==================
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Totais por Representante", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("courier", "normal");

  doc.setFillColor(200, 200, 200);
  doc.rect(14, y - 5, 180, 8, "F");
  doc.text("Representante", 16, y);
  doc.text("Quantidade", 160, y);
  y += 6;

  rowIndex = 0;
  Object.entries(porRep).forEach(([rep, qtd]) => {
    if (y > 270) { doc.addPage(); y = 20; }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(255, 229, 204);
      doc.rect(14, y - 4, 180, 6, "F");
    }

    doc.text(rep, 16, y, { maxWidth: 80 });
    doc.text(formatQuantidade(qtd), 160, y, { align: "right" });

    y += 6;
    rowIndex++;
  });

  y += 12;

// ================== Total Geral ==================
doc.setFontSize(12);
doc.setFont("helvetica", "bold");
doc.text(`TOTAL GERAL: ${formatQuantidade(totalGeral)}`, 14, y);

y += 12; // espaço antes da observação

// ================== Observação final ==================
doc.setFontSize(11);
doc.setFont("helvetica", "bold");
doc.setTextColor(255, 0, 0); // vermelho
doc.text(
  "Seu agendamento está sujeito a alterações, pois a disponibilidade pode variar devido a",
  14, y
);
y += 6;
doc.text(
  "cronogramas de fabricação ou possíveis imprevistos na produção.",
  14, y
);

// Resetar cor para preto (caso use mais coisas depois)
doc.setTextColor(0, 0, 0);

// ===== Download =====
doc.save("relatorio-agendamentos.pdf");


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
