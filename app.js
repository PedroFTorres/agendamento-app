// =================== app.js ===================
// Configuração Firebase (substitua pelos dados do seu projeto se quiser)
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15"
};

// Inicializa Firebase (SDK v8 - CDN)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- variáveis globais de charts ----------
let chartReps = null;
let chartClients = null;
let chartReport = null;

// ---------- helpers ----------
function $id(id){ return document.getElementById(id); }
function showSection(id){
  // esconde todas as sections dentro do main e mostra a pedida
  document.querySelectorAll("main section").forEach(s => s.classList.add("hidden"));
  const el = $id(id);
  if(el) el.classList.remove("hidden");
}

// escape simples para textos
function esc(s){ return s==null?"":String(s); }

// ---------- proteção de rota / info do usuário ----------
auth.onAuthStateChanged(user => {
  if (user) {
    const el = $id("user-email");
    if (el) el.textContent = user.email || "-";
    // ao logar, inicializa dados e mostra dashboard
    initApp();
    showSection("dashboard-section");
  } else {
    // se estiver em painel, redireciona para login.html
    if (!window.location.href.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  }
});

// ---------- login / signup (login.html) ----------
const loginForm = $id("login-form");
if (loginForm){
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $id("login-email").value.trim();
    const password = $id("login-password").value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "index.html";
    } catch(err){
      alert("Erro no login: " + (err.message||err));
      console.error(err);
    }
  });
}
const signupForm = $id("signup-form");
if (signupForm){
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $id("signup-email").value.trim();
    const password = $id("signup-password").value;
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      window.location.href = "index.html";
    } catch(err) {
      alert("Erro ao criar conta: " + (err.message||err));
      console.error(err);
    }
  });
}

// ---------- logout (index.html) ----------
const logoutBtn = $id("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      window.location.href = "login.html";
    } catch(err) {
      alert("Erro ao sair: " + (err.message||err));
    }
  });
}

// ---------- menu ----------
const mapMenu = {
  "menu-dashboard": "dashboard-section",
  "menu-agendamentos": "agendamentos-section",
  "menu-clientes": "clientes-section",
  "menu-representantes": "reps-section",
  "menu-produtos": "prods-section",
  "menu-relatorios": "reports-section"
};
Object.keys(mapMenu).forEach(btnId => {
  const el = $id(btnId);
  if (el) el.addEventListener("click", () => {
    showSection(mapMenu[btnId]);
    // carrega dados da seção ativa
    if (mapMenu[btnId] === "clientes-section") carregarClientes();
    if (mapMenu[btnId] === "reps-section") carregarReps();
    if (mapMenu[btnId] === "prods-section") carregarProds();
    if (mapMenu[btnId] === "agendamentos-section") carregarAgendamentos();
    if (mapMenu[btnId] === "reports-section") carregarFiltrosRelatorio();
    if (mapMenu[btnId] === "dashboard-section") atualizarDashboard();
  });
});

// ---------- inicialização única ----------
function initApp(){
  atualizarDashboard();
  carregarClientes();
  carregarReps();
  carregarProds();
  carregarAgendamentos();
  carregarFiltrosRelatorio();
}

// ----------------- DASHBOARD / CHARTS -----------------
async function atualizarDashboard(){
  try {
    const [clientsSnap, repsSnap, prodsSnap, apptsSnap] = await Promise.all([
      db.collection("clientes").get(),
      db.collection("representantes").get(),
      db.collection("produtos").get(),
      db.collection("agendamentos").get()
    ]);
    $id("count-clientes").textContent = clientsSnap.size;
    $id("count-rep").textContent = repsSnap.size;
    $id("count-produtos").textContent = prodsSnap.size;
    $id("count-agenda").textContent = apptsSnap.size;

    // montar dados para gráficos (quantidade por rep e por cliente)
    const totalsByRep = {};
    const totalsByClient = {};
    apptsSnap.forEach(doc => {
      const d = doc.data();
      const rep = d.representante || "—";
      const cli = d.cliente || "—";
      const q = parseInt(d.quantidade||0,10) || 0;
      totalsByRep[rep] = (totalsByRep[rep]||0) + q;
      totalsByClient[cli] = (totalsByClient[cli]||0) + q;
    });

    drawBarChart("chart-reps", totalsByRep, chartReps, (c)=>chartReps=c);
    drawBarChart("chart-clients", totalsByClient, chartClients, (c)=>chartClients=c);
  } catch(err){
    console.error("Erro atualizarDashboard:", err);
  }
}

function drawBarChart(canvasId, dataObj, instance, setInstance){
  try {
    const labels = Object.keys(dataObj);
    const values = Object.values(dataObj);
    const ctx = $id(canvasId);
    if (!ctx) return;
    // destroy previous
    if (instance) try{ instance.destroy(); }catch(e){}
    // create new
    const chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: "Quantidade", data: values, backgroundColor: "rgba(59,130,246,0.6)" }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
    setInstance(chart);
  } catch(err){ console.error("drawBarChart error", err); }
}

// ----------------- CLIENTES -----------------
const saveClientBtn = $id("save-client");
if (saveClientBtn) saveClientBtn.addEventListener("click", async () => {
  const name = $id("client-name").value.trim();
  let phone = $id("client-whatsapp").value.trim();
  if (!name) return alert("Nome é obrigatório");
  // remover +55 se tiver
  phone = phone.replace(/^\+?55/, "");
  try {
    await db.collection("clientes").add({ nome: name, whatsapp: phone, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    $id("client-name").value = "";
    $id("client-whatsapp").value = "";
    carregarClientes();
  } catch(err){ console.error(err); alert("Erro ao salvar cliente."); }
});

async function carregarClientes(){
  const list = $id("clients-list");
  if (!list) return;
  list.innerHTML = "";
  const snap = await db.collection("clientes").orderBy("nome").get();
  snap.forEach(doc => {
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `<div><div class="font-semibold">${esc(d.nome)}</div><div class="text-sm text-gray-500">${esc(d.whatsapp||"")}</div></div>
      <div class="space-x-2">
        <button data-id="${doc.id}" class="edit-client bg-yellow-400 px-2 py-1 rounded">Editar</button>
        <button data-id="${doc.id}" class="del-client bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
      </div>`;
    list.appendChild(div);
  });

  // attach handlers
  document.querySelectorAll(".edit-client").forEach(b => b.addEventListener("click", async (e) => {
    const id = e.currentTarget.dataset.id;
    const snap = await db.collection("clientes").doc(id).get();
    const d = snap.data();
    $id("client-name").value = d.nome||"";
    $id("client-whatsapp").value = d.whatsapp||"";
    // replace save handler to update
    saveClientBtn.textContent = "Atualizar";
    saveClientBtn.onclick = async () => {
      const name = $id("client-name").value.trim();
      const phone = $id("client-whatsapp").value.trim().replace(/^\+?55/,"");
      await db.collection("clientes").doc(id).update({ nome: name, whatsapp: phone });
      saveClientBtn.textContent = "Salvar";
      // restore handler
      saveClientBtn.onclick = null;
      saveClientBtn.addEventListener("click", async () => { /* no-op placeholder; but we leave default above */});
      $id("client-name").value = ""; $id("client-whatsapp").value = "";
      carregarClientes();
    };
  }));

  document.querySelectorAll(".del-client").forEach(b => b.addEventListener("click", async (e) => {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Excluir cliente?")) return;
    await db.collection("clientes").doc(id).delete();
    carregarClientes();
  }));

  // Update selects used in other forms
  populateClientSelects();
}

// import .xlsx
const importClientsInput = $id("import-clients");
const importClientsBtn = $id("import-clients-btn");
if (importClientsBtn){
  importClientsBtn.addEventListener("click", () => {
    if (!importClientsInput || !importClientsInput.files || !importClientsInput.files[0]) return alert("Selecione um arquivo .xlsx");
    const file = importClientsInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:"array"});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        let count = 0;
        for (const r of rows){
          const nome = r.Nome || r.nome || r.Name;
          const whats = String(r.WhatsApp || r.whatsapp || "").replace(/^\+?55/,"");
          if (!nome) continue;
          await db.collection("clientes").add({ nome: String(nome), whatsapp: whats });
          count++;
        }
        alert(`Importados ${count} clientes.`);
        importClientsInput.value = "";
        carregarClientes();
      } catch(err){ console.error(err); alert("Erro importar planilha: "+err.message); }
    };
    reader.readAsArrayBuffer(file);
  });
}

// populate client selects used in appointments
async function populateClientSelects(){
  const sel = $id("appt-client-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">Cliente</option>';
  const snap = await db.collection("clientes").orderBy("nome").get();
  snap.forEach(d => {
    const data = d.data();
    const opt = document.createElement("option");
    opt.value = data.nome||"";
    opt.textContent = data.nome||"";
    sel.appendChild(opt);
  });

  const repFilter = $id("report-rep");
  if (repFilter) {
    repFilter.innerHTML = '<option value="">Todos Representantes</option>';
  }
  const prodFilter = $id("report-product");
  if (prodFilter) {
    prodFilter.innerHTML = '<option value="">Todos Produtos</option>';
  }
}

// ----------------- REPRESENTANTES -----------------
const saveRepBtn = $id("save-rep");
if (saveRepBtn) saveRepBtn.addEventListener("click", async () => {
  const name = $id("rep-name").value.trim();
  if (!name) return alert("Nome obrigatório");
  await db.collection("representantes").add({ nome: name });
  $id("rep-name").value = "";
  carregarReps();
});

async function carregarReps(){
  const list = $id("reps-list"); if (!list) return;
  list.innerHTML = "";
  const snap = await db.collection("representantes").orderBy("nome").get();
  snap.forEach(doc => {
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `<div>${esc(d.nome)}</div>
      <div><button data-id="${doc.id}" class="del-rep bg-red-500 text-white px-2 py-1 rounded">Excluir</button></div>`;
    list.appendChild(div);
  });
  document.querySelectorAll(".del-rep").forEach(b => b.addEventListener("click", async (e) => {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Excluir representante?")) return;
    await db.collection("representantes").doc(id).delete();
    carregarReps();
  }));

  // update selects
  const sel = $id("appt-rep-select");
  if (sel) {
    sel.innerHTML = '<option value="">Representante</option>';
    snap.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.data().nome||"";
      opt.textContent = d.data().nome||"";
      sel.appendChild(opt);
    });
  }

  // report rep filter
  const repFilter = $id("report-rep");
  if (repFilter) {
    repFilter.innerHTML = '<option value="">Todos Representantes</option>';
    snap.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.data().nome || "";
      opt.textContent = d.data().nome || "";
      repFilter.appendChild(opt);
    });
  }
}

// ----------------- PRODUTOS -----------------
const saveProdBtn = $id("save-prod");
if (saveProdBtn) saveProdBtn.addEventListener("click", async () => {
  const name = $id("prod-name").value.trim();
  const price = parseFloat($id("prod-price").value) || 0;
  if (!name) return alert("Nome obrigatório");
  await db.collection("produtos").add({ nome: name, preco: price });
  $id("prod-name").value = "";
  $id("prod-price").value = "";
  carregarProds();
});

async function carregarProds(){
  const list = $id("prods-list"); if (!list) return;
  list.innerHTML = "";
  const snap = await db.collection("produtos").orderBy("nome").get();
  snap.forEach(doc => {
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `<div>${esc(d.nome)} - R$ ${Number(d.preco||0).toFixed(4)}</div>
      <div><button data-id="${doc.id}" class="del-prod bg-red-500 text-white px-2 py-1 rounded">Excluir</button></div>`;
    list.appendChild(div);
  });
  document.querySelectorAll(".del-prod").forEach(b => b.addEventListener("click", async (e) => {
    if (!confirm("Excluir produto?")) return;
    await db.collection("produtos").doc(e.currentTarget.dataset.id).delete();
    carregarProds();
  }));

  // update appt product select & report product filter
  const sel = $id("appt-prod-select");
  if (sel) {
    sel.innerHTML = '<option value="">Produto</option>';
    snap.forEach(d => {
      const opt = document.createElement("option"); opt.value = d.data().nome||""; opt.textContent = d.data().nome||"";
      sel.appendChild(opt);
    });
  }
  const prodFilter = $id("report-product");
  if (prodFilter) {
    prodFilter.innerHTML = '<option value="">Todos Produtos</option>';
    snap.forEach(d => {
      const opt = document.createElement("option"); opt.value = d.data().nome||""; opt.textContent = d.data().nome||"";
      prodFilter.appendChild(opt);
    });
  }
}

// ----------------- AGENDAMENTOS -----------------
const saveApptBtn = $id("save-appt");
if (saveApptBtn) saveApptBtn.addEventListener("click", async () => {
  const date = $id("appt-date").value;
  const client = $id("appt-client-select").value;
  const rep = $id("appt-rep-select").value;
  const prod = $id("appt-prod-select").value;
  const qty = parseInt($id("appt-qty").value,10) || 0;
  if (!date || !client || !rep || !prod || !qty) return alert("Preencha todos os campos do agendamento.");
  await db.collection("agendamentos").add({ data: date, cliente: client, representante: rep, produto: prod, quantidade: qty, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  // limpar
  $id("appt-date").value = ""; $id("appt-qty").value = "";
  carregarAgendamentos();
  atualizarDashboard();
});

async function carregarAgendamentos(){
  const list = $id("appts-list"); if (!list) return;
  list.innerHTML = "";
  const snap = await db.collection("agendamentos").orderBy("data").get();
  snap.forEach(doc => {
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `<div>
        <div class="font-semibold">${esc(d.data)} — ${esc(d.cliente)}</div>
        <div class="text-sm text-gray-500">Produto: ${esc(d.produto)} • Qtd: ${esc(d.quantidade)} • Rep: ${esc(d.representante)}</div>
      </div>
      <div class="space-x-2">
        <button data-id="${doc.id}" class="edit-appt bg-yellow-400 px-2 py-1 rounded">Editar</button>
        <button data-id="${doc.id}" class="del-appt bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
      </div>`;
    list.appendChild(div);
  });

  // attach handlers
  document.querySelectorAll(".del-appt").forEach(b => b.addEventListener("click", async (e) => {
    const id = e.currentTarget.dataset.id;
    if (!confirm("Excluir agendamento?")) return;
    await db.collection("agendamentos").doc(id).delete();
    carregarAgendamentos();
    atualizarDashboard();
  }));

  document.querySelectorAll(".edit-appt").forEach(b => b.addEventListener("click", async (e) => {
    const id = e.currentTarget.dataset.id;
    const snap = await db.collection("agendamentos").doc(id).get();
    const d = snap.data();
    $id("appt-date").value = d.data || "";
    $id("appt-client-select").value = d.cliente || "";
    $id("appt-rep-select").value = d.representante || "";
    $id("appt-prod-select").value = d.produto || "";
    $id("appt-qty").value = d.quantidade || "";
    // change save to update
    saveApptBtn.textContent = "Atualizar";
    saveApptBtn.onclick = async () => {
      const date = $id("appt-date").value;
      const client = $id("appt-client-select").value;
      const rep = $id("appt-rep-select").value;
      const prod = $id("appt-prod-select").value;
      const qty = parseInt($id("appt-qty").value,10) || 0;
      await db.collection("agendamentos").doc(id).update({ data: date, cliente: client, representante: rep, produto: prod, quantidade: qty });
      saveApptBtn.textContent = "Salvar Agendamento";
      saveApptBtn.onclick = null;
      carregarAgendamentos();
      atualizarDashboard();
      // clear
      $id("appt-date").value = ""; $id("appt-qty").value = "";
    };
  }));
}

// ----------------- RELATÓRIOS -----------------
function carregarFiltrosRelatorio(){
  // populates already done in carregarReps / carregarProds / populateClientSelects
  // ensure charts get updated
  atualizarDashboard();
}

$id("apply-report") && $id("apply-report").addEventListener("click", async () => {
  try {
    const start = $id("report-start").value;
    const end = $id("report-end").value;
    const rep = $id("report-rep").value;
    const prod = $id("report-product").value;

    let snap = await db.collection("agendamentos").orderBy("data").get();
    let items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (start) items = items.filter(it => it.data >= start);
    if (end) items = items.filter(it => it.data <= end);
    if (rep) items = items.filter(it => it.representante === rep);
    if (prod) items = items.filter(it => it.produto === prod);

    renderReport(items);
  } catch(err){ console.error("Erro aplicar relatório", err); alert("Erro ao aplicar filtro"); }
});

function renderReport(items){
  const out = $id("report-output");
  out.innerHTML = "";
  if (!items || !items.length) { out.innerHTML = "<div>Nenhum registro encontrado para o filtro.</div>"; if (chartReport) try{chartReport.destroy();}catch(e){} return; }

  const table = document.createElement("table");
  table.className = "w-full text-sm";
  table.innerHTML = `<thead><tr class="text-left"><th class="p-2">Data</th><th class="p-2">Cliente</th><th class="p-2">Rep</th><th class="p-2">Produto</th><th class="p-2">Qtd</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  let totalsByProduct = {};
  let totalGeral = 0;
  items.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="p-2">${esc(it.data)}</td><td class="p-2">${esc(it.cliente)}</td><td class="p-2">${esc(it.representante)}</td><td class="p-2">${esc(it.produto)}</td><td class="p-2">${esc(it.quantidade)}</td>`;
    tbody.appendChild(tr);
    totalsByProduct[it.produto] = (totalsByProduct[it.produto]||0) + (parseInt(it.quantidade||0,10)||0);
    totalGeral += (parseInt(it.quantidade||0,10)||0);
  });
  table.appendChild(tbody);
  out.appendChild(table);

  // chart by product
  const ctx = $id("chart-report");
  if (chartReport) try{ chartReport.destroy(); }catch(e){}
  chartReport = new Chart(ctx, {
    type: "bar",
    data: { labels: Object.keys(totalsByProduct), datasets: [{ label: "Quantidade", data: Object.values(totalsByProduct), backgroundColor: "rgba(34,197,94,0.6)" }] },
    options: { responsive:true, maintainAspectRatio:false }
  });

  // totals summary
  const sumDiv = document.createElement("div");
  sumDiv.className = "mt-4";
  sumDiv.innerHTML = `<div class="font-semibold">Total geral: ${totalGeral}</div>`;
  out.appendChild(sumDiv);

  // store last rendered items for PDF export
  window._lastReportItems = items;
});

// export PDF
$id("export-pdf") && $id("export-pdf").addEventListener("click", async () => {
  try {
    const items = window._lastReportItems || [];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt',format:'a4'});
    doc.setFontSize(14);
    doc.text("Relatório de Agendamentos", 40, 40);
    doc.setFontSize(10);
    let y = 70;
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 40, y); y += 20;
    doc.setFontSize(10);
    // header
    doc.text("Data", 40, y); doc.text("Cliente", 120, y); doc.text("Rep", 260, y); doc.text("Produto", 380, y); doc.text("Qtd", 500, y);
    y += 12; doc.line(40,y,560,y); y += 12;
    for (const it of items) {
      if (y > 740) { doc.addPage(); y = 40; }
      doc.text(String(it.data||''), 40, y);
      doc.text(String(it.cliente||''), 120, y);
      doc.text(String(it.representante||''), 260, y);
      doc.text(String(it.produto||''), 380, y);
      doc.text(String(it.quantidade||0), 500, y);
      y += 14;
    }
    doc.save(`relatorio_agendamentos_${Date.now()}.pdf`);
  } catch(err){ console.error("Erro gerar PDF", err); alert("Erro ao gerar PDF"); }
});

// ----------------- util: carregar filtros (called on init) -----------------
async function carregarFiltrosRelatorio(){
  // ensures selects are up-to-date
  await Promise.all([carregarReps(), carregarProds(), populateClientSelects()]);
}

// call initial loading if on panel
if (!window.location.href.endsWith("login.html")) {
  // a file might execute before auth ready; safe to call init if logged
  auth.onAuthStateChanged(user => { if (user) initApp(); });
}
