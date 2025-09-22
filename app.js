/*********************** Firebase (CDN v8) ************************/
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/*********************** Helpers ************************/
const $ = (id) => document.getElementById(id);
const esc = (s) => (s==null ? "" : String(s));
const todayISO = () => new Date().toISOString().slice(0,10);

/** Mostra uma seção do main e esconde as outras */
function showSection(id){
  document.querySelectorAll("main section").forEach(s => s.classList.add("hidden"));
  const sec = $(id);
  if (sec) sec.classList.remove("hidden");
}

/** Mensagens simples */
function toast(msg){
  try { alert(msg); } catch(_) {}
}

/*********************** Proteção de rota ************************/
auth.onAuthStateChanged((user) => {
  const onLogin = window.location.pathname.endsWith("login.html") || window.location.href.includes("login.html");
  if (user) {
    if (!onLogin) {
      const ue = $("user-email");
      if (ue) ue.textContent = user.email || "-";
      initApp(); // carrega dashboard e listas
    } else {
      // já logado e em login.html -> vai pro painel
      window.location.href = "index.html";
    }
  } else {
    // não logado
    if (!onLogin) window.location.href = "login.html";
  }
});

/*********************** Login / Signup / Logout ************************/
const loginForm  = $("login-form");
const signupForm = $("signup-form");
const logoutBtn  = $("logout-btn");

if (loginForm){
  loginForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = $("login-email").value.trim();
    const pass  = $("login-password").value;
    try{
      await auth.signInWithEmailAndPassword(email, pass);
      window.location.href = "index.html";
    }catch(err){ toast("Erro no login: " + err.message); console.error(err); }
  });
}

if (signupForm){
  signupForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = $("signup-email").value.trim();
    const pass  = $("signup-password").value;
    try{
      await auth.createUserWithEmailAndPassword(email, pass);
      window.location.href = "index.html";
    }catch(err){ toast("Erro no cadastro: " + err.message); console.error(err); }
  });
}

if (logoutBtn){
  logoutBtn.addEventListener("click", async ()=>{
    try{
      await auth.signOut();
      window.location.href = "login.html";
    }catch(err){ toast("Erro ao sair: " + err.message); }
  });
}

/*********************** Montagem de UI (injeta conteúdo nas seções vazias do index.html) ************************/
function buildDashboardSection(){
  const el = $("dashboard-section");
  if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Dashboard</h1>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-4 rounded shadow">
        <h3 class="font-bold mb-2">Resumo Rápido</h3>
        <p>Clientes: <span id="count-clientes">0</span></p>
        <p>Representantes: <span id="count-rep">0</span></p>
        <p>Produtos: <span id="count-produtos">0</span></p>
        <p>Agendamentos: <span id="count-agenda">0</span></p>
      </div>
      <div class="bg-white p-4 rounded shadow" style="height:300px;">
        <h3 class="font-bold mb-2">Ranking — Representantes</h3>
        <canvas id="chart-reps"></canvas>
      </div>
      <div class="bg-white p-4 rounded shadow" style="height:300px;">
        <h3 class="font-bold mb-2">Ranking — Clientes</h3>
        <canvas id="chart-clients"></canvas>
      </div>
    </div>

    <div class="bg-white p-4 rounded shadow">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold">Calendário de Agendamentos</h3>
        <div class="space-x-2">
          <button id="cal-prev" class="px-2 py-1 border rounded">◀</button>
          <span id="cal-title" class="font-semibold"></span>
          <button id="cal-next" class="px-2 py-1 border rounded">▶</button>
          <button id="cal-today" class="px-2 py-1 border rounded">Hoje</button>
        </div>
      </div>
      <div id="calendar-grid" class="grid grid-cols-7 gap-2"></div>
      <div class="text-xs text-gray-500 mt-2">* Clique num dia para ver os agendamentos.</div>
    </div>
  `;
}

function buildClientesSection(){
  const el = $("clientes-section"); if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Clientes</h1>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex gap-2">
        <input id="client-name" placeholder="Nome" class="border p-2 rounded flex-1" />
        <input id="client-whatsapp" placeholder="WhatsApp (ex: 98991234567)" class="border p-2 rounded w-56" />
        <button id="save-client" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
      <div class="mt-4">
        <label class="text-sm">Importar clientes (.xlsx) — cabeçalho: Nome, WhatsApp</label>
        <div class="mt-2 flex items-center gap-2">
          <input type="file" id="import-clients" accept=".xlsx" />
          <button id="import-clients-btn" class="bg-green-600 text-white px-3 py-1 rounded">Importar</button>
        </div>
      </div>
    </div>
    <div id="clients-list" class="space-y-2"></div>
  `;
}

function buildRepsSection(){
  const el = $("reps-section"); if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Representantes</h1>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex gap-2">
        <input id="rep-name" placeholder="Nome" class="border p-2 rounded flex-1" />
        <button id="save-rep" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
    </div>
    <div id="reps-list" class="space-y-2"></div>
  `;
}

function buildProdsSection(){
  const el = $("prods-section"); if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Produtos</h1>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex gap-2">
        <input id="prod-name" placeholder="Nome" class="border p-2 rounded flex-1" />
        <input id="prod-price" placeholder="Preço (ex: 12.5000)" class="border p-2 rounded w-56" />
        <button id="save-prod" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
    </div>
    <div id="prods-list" class="space-y-2"></div>
  `;
}

function buildAgendamentosSection(){
  const el = $("agendamentos-section"); if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Agendamentos</h1>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input id="appt-date" type="date" class="border p-2 rounded col-span-1" />
        <select id="appt-client-select" class="border p-2 rounded col-span-2"><option value="">Cliente</option></select>
        <select id="appt-rep-select" class="border p-2 rounded col-span-1"><option value="">Representante</option></select>
        <select id="appt-prod-select" class="border p-2 rounded col-span-1"><option value="">Produto</option></select>
        <input id="appt-qty" type="number" min="1" class="border p-2 rounded col-span-1" placeholder="Qtd" />
      </div>
      <div class="mt-3">
        <button id="save-appt" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar Agendamento</button>
      </div>
    </div>
    <div id="appts-list" class="space-y-2"></div>
  `;
}

function buildReportsSection(){
  const el = $("reports-section"); if (!el) return;
  el.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Relatórios</h1>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <input id="report-start" type="date" class="border p-2 rounded" />
        <input id="report-end" type="date" class="border p-2 rounded" />
        <select id="report-rep" class="border p-2 rounded"><option value="">Todos Representantes</option></select>
        <select id="report-product" class="border p-2 rounded"><option value="">Todos Produtos</option></select>
        <button id="apply-report" class="bg-blue-600 text-white px-4 py-2 rounded">Aplicar</button>
        <button id="export-pdf" class="bg-red-600 text-white px-4 py-2 rounded">Exportar PDF</button>
      </div>
    </div>
    <div id="report-output" class="bg-white p-4 rounded shadow"></div>
    <div class="bg-white p-4 rounded shadow mt-4" style="height:300px;">
      <canvas id="chart-report"></canvas>
    </div>
  `;
}

/*********************** Inicialização do painel ************************/
let chartReps = null, chartClients = null, chartReport = null;
let currentCalDate = new Date();

function initApp(){
  // monta seções se estiverem vazias
  buildDashboardSection();
  buildClientesSection();
  buildRepsSection();
  buildProdsSection();
  buildAgendamentosSection();
  buildReportsSection();

  // menu
  const map = {
    "menu-dashboard": "dashboard-section",
    "menu-agendamentos": "agendamentos-section",
    "menu-clientes": "clientes-section",
    "menu-representantes": "reps-section",
    "menu-produtos": "prods-section",
    "menu-relatorios": "reports-section"
  };
  Object.keys(map).forEach(id=>{
    const btn = $(id);
    if (btn) btn.onclick = ()=>{
      showSection(map[id]);
      if (map[id]==="dashboard-section") atualizarDashboard();
      if (map[id]==="clientes-section") carregarClientes();
      if (map[id]==="reps-section")     carregarReps();
      if (map[id]==="prods-section")    carregarProds();
      if (map[id]==="agendamentos-section"){ carregarAgendamentos(); populateSelectorsForAppt(); }
      if (map[id]==="reports-section"){ carregarFiltrosRelatorio(); }
    };
  });

  // ações iniciais
  showSection("dashboard-section");
  atualizarDashboard();
  carregarClientes();
  carregarReps();
  carregarProds();
  carregarAgendamentos();
  populateSelectorsForAppt();
  carregarFiltrosRelatorio();

  // eventos de relatório
  const applyBtn = $("apply-report");
  if (applyBtn) applyBtn.addEventListener("click", async ()=>{ await aplicarRelatorio(); });

  const exportBtn = $("export-pdf");
  if (exportBtn) exportBtn.addEventListener("click", ()=> exportarPDF());
}

/*********************** Dashboard + Gráficos + Calendário ************************/
async function atualizarDashboard(){
  const [cSnap, rSnap, pSnap, aSnap] = await Promise.all([
    db.collection("clientes").get(),
    db.collection("representantes").get(),
    db.collection("produtos").get(),
    db.collection("agendamentos").get()
  ]);
  if ($("count-clientes")) $("count-clientes").textContent = cSnap.size;
  if ($("count-rep")) $("count-rep").textContent = rSnap.size;
  if ($("count-produtos")) $("count-produtos").textContent = pSnap.size;
  if ($("count-agenda")) $("count-agenda").textContent = aSnap.size;

  // gráficos
  const totalsByRep = {};
  const totalsByClient = {};
  aSnap.forEach(doc=>{
    const d = doc.data();
    const q = parseInt(d.quantidade||0,10) || 0;
    totalsByRep[d.representante||"—"] = (totalsByRep[d.representante||"—"]||0)+q;
    totalsByClient[d.cliente||"—"]    = (totalsByClient[d.cliente||"—"]||0)+q;
  });
  drawBar("chart-reps", totalsByRep, (inst)=>{ chartReps = inst; });
  drawBar("chart-clients", totalsByClient, (inst)=>{ chartClients = inst; });

  // calendário
  renderCalendar(currentCalDate, aSnap.docs.map(d=>({ id:d.id, ...d.data() })));
}

function drawBar(canvasId, dataObj, setInst){
  const el = $(canvasId);
  if (!el) return;
  try { if (setInst === chartReps && chartReps) chartReps.destroy(); } catch(_) {}
  try { if (setInst === chartClients && chartClients) chartClients.destroy(); } catch(_) {}

  const labels = Object.keys(dataObj);
  const values = Object.values(dataObj);
  const inst = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Quantidade", data: values, backgroundColor: "rgba(59,130,246,0.6)" }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
  setInst(inst);
}

/** Calendário mensal simples */
function renderCalendar(refDate, appts){
  const grid = $("calendar-grid");
  const title = $("cal-title");
  if (!grid || !title) return;

  const y = refDate.getFullYear();
  const m = refDate.getMonth(); // 0-11
  title.textContent = refDate.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  // eventos dos botões
  const prev = $("cal-prev"), next = $("cal-next"), today = $("cal-today");
  if (prev) prev.onclick = ()=>{ currentCalDate = new Date(y, m-1, 1); atualizarDashboard(); };
  if (next) next.onclick = ()=>{ currentCalDate = new Date(y, m+1, 1); atualizarDashboard(); };
  if (today) today.onclick = ()=>{ currentCalDate = new Date(); atualizarDashboard(); };

  // calcular dias
  const first = new Date(y, m, 1);
  const startWeekDay = (first.getDay()+7)%7; // 0-dom
  const lastDay = new Date(y, m+1, 0).getDate();

  grid.innerHTML = `
    <div class="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2">
      <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
    </div>
  `;
  const body = document.createElement("div");
  body.className = "grid grid-cols-7 gap-2";

  // mapa de agendamentos por dia
  const map = {};
  appts.forEach(a=>{
    const d = a.data; // 'YYYY-MM-DD'
    if (d?.slice(0,7) === `${y}-${String(m+1).padStart(2,'0')}`){
      map[d] = map[d] || [];
      map[d].push(a);
    }
  });

  // preencher espaços em branco iniciais
  for (let i=0;i<startWeekDay;i++){
    const blank = document.createElement("div");
    blank.className = "p-2 border rounded bg-gray-50";
    body.appendChild(blank);
  }

  // dias do mês
  for (let day=1; day<=lastDay; day++){
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const box = document.createElement("div");
    box.className = "p-2 border rounded hover:shadow cursor-pointer bg-white";
    box.innerHTML = `<div class="text-sm font-semibold mb-1">${day}</div>${
      (map[dateStr] ? `<div class="text-xs text-gray-600">${map[dateStr].length} agendamento(s)</div>` : `<div class="text-xs text-gray-300">—</div>`)
    }`;
    box.onclick = ()=>{
      // quando clica num dia, mostra lista filtrada na seção de agendamentos
      showSection("agendamentos-section");
      renderApptsList(map[dateStr]||[]);
    };
    body.appendChild(box);
  }
  grid.appendChild(body);
}

/*********************** CLIENTES ************************/
async function carregarClientes(){
  const sec = $("clientes-section"); if (!sec) return;
  // garantir UI montada
  if (!$("clients-list")) buildClientesSection();

  const list = $("clients-list");
  list.innerHTML = `<div class="text-gray-500 text-sm">Carregando...</div>`;
  const snap = await db.collection("clientes").orderBy("nome").get();
  list.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data();
    const card = document.createElement("div");
    card.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    card.innerHTML = `
      <div>
        <div class="font-semibold">${esc(d.nome)}</div>
        <div class="text-sm text-gray-500">${esc(d.whatsapp||"")}</div>
      </div>
      <div class="space-x-2">
        <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-action="edit">Editar</button>
        <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-action="del">Excluir</button>
      </div>
    `;
    list.appendChild(card);
  });

  // bind botões
  list.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.getAttribute("data-action");
      if (action==="del"){
        if (!confirm("Excluir cliente?")) return;
        await db.collection("clientes").doc(id).delete();
        carregarClientes();
      } else if (action==="edit"){
        const snap = await db.collection("clientes").doc(id).get();
        const d = snap.data();
        $("client-name").value = d.nome||"";
        $("client-whatsapp").value = d.whatsapp||"";
        const saveBtn = $("save-client");
        saveBtn.textContent = "Atualizar";
        saveBtn.onclick = async ()=>{
          let phone = $("client-whatsapp").value.trim().replace(/^\+?55/,"");
          await db.collection("clientes").doc(id).update({
            nome: $("client-name").value.trim(),
            whatsapp: phone
          });
          saveBtn.textContent = "Salvar";
          saveBtn.onclick = null;
          $("client-name").value = ""; $("client-whatsapp").value = "";
          carregarClientes();
        };
      }
    });
  });

  // bind salvar & importar (uma vez)
  const saveBtn = $("save-client");
  if (saveBtn && !saveBtn._bound){
    saveBtn._bound = true;
    saveBtn.addEventListener("click", async ()=>{
      const name = $("client-name").value.trim();
      let phone = $("client-whatsapp").value.trim().replace(/^\+?55/,"");
      if (!name) return toast("Informe o nome.");
      await db.collection("clientes").add({ nome: name, whatsapp: phone, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      $("client-name").value=""; $("client-whatsapp").value="";
      carregarClientes();
    });
  }

  const importBtn = $("import-clients-btn");
  const importInput = $("import-clients");
  if (importBtn && !importBtn._bound){
    importBtn._bound = true;
    importBtn.addEventListener("click", ()=>{
      if (!importInput || !importInput.files || !importInput.files[0]) return toast("Selecione um arquivo .xlsx");
      const file = importInput.files[0];
      const reader = new FileReader();
      reader.onload = async (ev)=>{
        try{
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);
          let count=0;
          for (const r of rows){
            const nome = esc(r.Nome || r.nome || r.Name).trim();
            let whats = esc(r.WhatsApp || r.whatsapp || "").trim().replace(/^\+?55/,"");
            if (!nome) continue;
            await db.collection("clientes").add({ nome, whatsapp: whats });
            count++;
          }
          toast(`Importados ${count} clientes.`);
          importInput.value = "";
          carregarClientes();
        }catch(err){ console.error(err); toast("Erro ao importar planilha."); }
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

/*********************** REPRESENTANTES ************************/
async function carregarReps(){
  if (!$("reps-list")) buildRepsSection();
  const list = $("reps-list");
  list.innerHTML = `<div class="text-gray-500 text-sm">Carregando...</div>`;
  const snap = await db.collection("representantes").orderBy("nome").get();
  list.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `
      <div>${esc(d.nome)}</div>
      <div class="space-x-2">
        <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-action="edit">Editar</button>
        <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-action="del">Excluir</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.getAttribute("data-action");
      if (action==="del"){
        if (!confirm("Excluir representante?")) return;
        await db.collection("representantes").doc(id).delete();
        carregarReps();
      } else if (action==="edit"){
        const snap = await db.collection("representantes").doc(id).get();
        const d = snap.data();
        $("rep-name").value = d.nome||"";
        const saveBtn = $("save-rep");
        saveBtn.textContent = "Atualizar";
        saveBtn.onclick = async ()=>{
          await db.collection("representantes").doc(id).update({ nome: $("rep-name").value.trim() });
          saveBtn.textContent = "Salvar";
          saveBtn.onclick = null;
          $("rep-name").value = "";
          carregarReps();
        };
      }
    });
  });

  const saveBtn = $("save-rep");
  if (saveBtn && !saveBtn._bound){
    saveBtn._bound = true;
    saveBtn.addEventListener("click", async ()=>{
      const name = $("rep-name").value.trim();
      if (!name) return toast("Informe o nome.");
      await db.collection("representantes").add({ nome: name });
      $("rep-name").value = "";
      carregarReps();
    });
  }
}

/*********************** PRODUTOS ************************/
async function carregarProds(){
  if (!$("prods-list")) buildProdsSection();
  const list = $("prods-list");
  list.innerHTML = `<div class="text-gray-500 text-sm">Carregando...</div>`;
  const snap = await db.collection("produtos").orderBy("nome").get();
  list.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data();
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `
      <div>${esc(d.nome)} - R$ ${Number(d.preco||0).toFixed(4)}</div>
      <div class="space-x-2">
        <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-action="edit">Editar</button>
        <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-action="del">Excluir</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.getAttribute("data-action");
      if (action==="del"){
        if (!confirm("Excluir produto?")) return;
        await db.collection("produtos").doc(id).delete();
        carregarProds();
      } else if (action==="edit"){
        const snap = await db.collection("produtos").doc(id).get();
        const d = snap.data();
        $("prod-name").value = d.nome||"";
        $("prod-price").value = d.preco||"";
        const saveBtn = $("save-prod");
        saveBtn.textContent = "Atualizar";
        saveBtn.onclick = async ()=>{
          await db.collection("produtos").doc(id).update({ nome: $("prod-name").value.trim(), preco: parseFloat($("prod-price").value)||0 });
          saveBtn.textContent = "Salvar";
          saveBtn.onclick = null;
          $("prod-name").value=""; $("prod-price").value="";
          carregarProds();
        };
      }
    });
  });

  const saveBtn = $("save-prod");
  if (saveBtn && !saveBtn._bound){
    saveBtn._bound = true;
    saveBtn.addEventListener("click", async ()=>{
      const name = $("prod-name").value.trim();
      const price = parseFloat($("prod-price").value)||0;
      if (!name) return toast("Informe o nome.");
      await db.collection("produtos").add({ nome: name, preco: price });
      $("prod-name").value=""; $("prod-price").value="";
      carregarProds();
    });
  }
}

/*********************** AGENDAMENTOS ************************/
function populateSelectorsForAppt(){
  // clientes
  db.collection("clientes").orderBy("nome").get().then(snap=>{
    const sel = $("appt-client-select"); if (!sel) return;
    sel.innerHTML = `<option value="">Cliente</option>`;
    snap.forEach(d=>{
      const o = document.createElement("option");
      o.value = d.data().nome; o.textContent = d.data().nome;
      sel.appendChild(o);
    });
  });
  // reps
  db.collection("representantes").orderBy("nome").get().then(snap=>{
    const sel = $("appt-rep-select"); if (!sel) return;
    sel.innerHTML = `<option value="">Representante</option>`;
    snap.forEach(d=>{
      const o = document.createElement("option");
      o.value = d.data().nome; o.textContent = d.data().nome;
      sel.appendChild(o);
    });
  });
  // produtos
  db.collection("produtos").orderBy("nome").get().then(snap=>{
    const sel = $("appt-prod-select"); if (!sel) return;
    sel.innerHTML = `<option value="">Produto</option>`;
    snap.forEach(d=>{
      const o = document.createElement("option");
      o.value = d.data().nome; o.textContent = d.data().nome;
      sel.appendChild(o);
    });
  });
}

async function carregarAgendamentos(){
  if (!$("appts-list")) buildAgendamentosSection();
  const list = $("appts-list");
  list.innerHTML = `<div class="text-gray-500 text-sm">Carregando...</div>`;
  const snap = await db.collection("agendamentos").orderBy("data").get();
  renderApptsList(snap.docs.map(d=>({ id:d.id, ...d.data() })));

  // bind salvar
  const saveBtn = $("save-appt");
  if (saveBtn && !saveBtn._bound){
    saveBtn._bound = true;
    saveBtn.addEventListener("click", async ()=>{
      const date = $("appt-date").value;
      const client = $("appt-client-select").value;
      const rep    = $("appt-rep-select").value;
      const prod   = $("appt-prod-select").value;
      const qty    = parseInt($("appt-qty").value,10)||0;
      if (!date || !client || !rep || !prod || !qty) return toast("Preencha todos os campos.");
      await db.collection("agendamentos").add({
        data: date, cliente: client, representante: rep, produto: prod, quantidade: qty,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      $("appt-date").value=""; $("appt-qty").value="";
      carregarAgendamentos();
      atualizarDashboard();
    });
  }
}

function renderApptsList(items){
  const list = $("appts-list");
  list.innerHTML = "";
  if (!items.length){ list.innerHTML = `<div class="text-gray-500">Nenhum agendamento.</div>`; return; }
  items.forEach(a=>{
    const div = document.createElement("div");
    div.className = "p-2 bg-white rounded shadow flex justify-between items-center";
    div.innerHTML = `
      <div>
        <div class="font-semibold">${esc(a.data)} — ${esc(a.cliente)}</div>
        <div class="text-sm text-gray-500">Produto: ${esc(a.produto)} • Qtd: ${esc(a.quantidade)} • Rep: ${esc(a.representante)}</div>
      </div>
      <div class="space-x-2">
        <button class="px-2 py-1 rounded bg-yellow-400" data-id="${a.id}" data-action="edit">Editar</button>
        <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${a.id}" data-action="del">Excluir</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.getAttribute("data-action");
      if (action==="del"){
        if (!confirm("Excluir agendamento?")) return;
        await db.collection("agendamentos").doc(id).delete();
        carregarAgendamentos();
        atualizarDashboard();
      } else if (action==="edit"){
        const snap = await db.collection("agendamentos").doc(id).get();
        const d = snap.data();
        $("appt-date").value = d.data || "";
        $("appt-client-select").value = d.cliente || "";
        $("appt-rep-select").value = d.representante || "";
        $("appt-prod-select").value = d.produto || "";
        $("appt-qty").value = d.quantidade || "";
        const saveBtn = $("save-appt");
        saveBtn.textContent = "Atualizar";
        saveBtn.onclick = async ()=>{
          const date = $("appt-date").value;
          const client = $("appt-client-select").value;
          const rep    = $("appt-rep-select").value;
          const prod   = $("appt-prod-select").value;
          const qty    = parseInt($("appt-qty").value,10)||0;
          await db.collection("agendamentos").doc(id).update({ data: date, cliente: client, representante: rep, produto: prod, quantidade: qty });
          saveBtn.textContent = "Salvar Agendamento";
          saveBtn.onclick = null;
          $("appt-date").value=""; $("appt-qty").value="";
          carregarAgendamentos();
          atualizarDashboard();
        };
      }
    });
  });
}

/*********************** RELATÓRIOS ************************/
async function carregarFiltrosRelatorio(){
  // rep
  const repSel = $("report-rep");
  if (repSel){
    repSel.innerHTML = `<option value="">Todos Representantes</option>`;
    const snap = await db.collection("representantes").orderBy("nome").get();
    snap.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d.data().nome; opt.textContent = d.data().nome;
      repSel.appendChild(opt);
    });
  }
  // produto
  const prodSel = $("report-product");
  if (prodSel){
    prodSel.innerHTML = `<option value="">Todos Produtos</option>`;
    const snap = await db.collection("produtos").orderBy("nome").get();
    snap.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d.data().nome; opt.textContent = d.data().nome;
      prodSel.appendChild(opt);
    });
  }
}

async function aplicarRelatorio(){
  const start = $("report-start").value;
  const end   = $("report-end").value;
  const rep   = $("report-rep").value;
  const prod  = $("report-product").value;

  let snap = await db.collection("agendamentos").orderBy("data").get();
  let items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  if (start) items = items.filter(i => i.data >= start);
  if (end)   items = items.filter(i => i.data <= end);
  if (rep)   items = items.filter(i => i.representante === rep);
  if (prod)  items = items.filter(i => i.produto === prod);

  renderReport(items);
}

function renderReport(items){
  const out = $("report-output");
  out.innerHTML = "";
  if (!items.length){
    out.innerHTML = `<div class="text-gray-500">Nenhum registro para o filtro.</div>`;
    if (chartReport) try{ chartReport.destroy(); }catch(_){}
    return;
  }
  // tabela
  const table = document.createElement("table");
  table.className = "w-full text-sm";
  table.innerHTML = `
    <thead>
      <tr class="text-left">
        <th class="p-2">Data</th><th class="p-2">Cliente</th><th class="p-2">Rep</th>
        <th class="p-2">Produto</th><th class="p-2">Qtd</th>
      </tr>
    </thead>`;
  const tb = document.createElement("tbody");
  let totalsByProd = {}, totalGeral=0;
  items.forEach(it=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2">${esc(it.data)}</td>
      <td class="p-2">${esc(it.cliente)}</td>
      <td class="p-2">${esc(it.representante)}</td>
      <td class="p-2">${esc(it.produto)}</td>
      <td class="p-2">${esc(it.quantidade)}</td>`;
    tb.appendChild(tr);
    const q = parseInt(it.quantidade||0,10)||0;
    totalsByProd[it.produto] = (totalsByProd[it.produto]||0)+q;
    totalGeral += q;
  });
  table.appendChild(tb);
  out.appendChild(table);

  // gráfico por produto
  const ctx = $("chart-report");
  if (chartReport) try{ chartReport.destroy(); }catch(_){}
  chartReport = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(totalsByProd),
      datasets: [{ label: "Quantidade", data: Object.values(totalsByProd), backgroundColor: "rgba(34,197,94,0.6)" }]
    },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  // resumo
  const sum = document.createElement("div");
  sum.className = "mt-3 font-semibold";
  sum.textContent = `Total geral: ${totalGeral}`;
  out.appendChild(sum);

  // guarda p/ PDF
  window._lastReportItems = items;
}

function exportarPDF(){
  try{
    const items = window._lastReportItems || [];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:"a4" });
    let y = 40;
    doc.setFontSize(14); doc.text("Relatório de Agendamentos", 40, y); y+=20;
    doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleString()}`, 40, y); y+=20;
    doc.text("Data", 40, y); doc.text("Cliente", 120, y); doc.text("Rep", 260, y); doc.text("Produto", 380, y); doc.text("Qtd", 500, y); y+=12;
    doc.line(40,y,560,y); y+=12;
    items.forEach(it=>{
      if (y>740){ doc.addPage(); y=40; }
      doc.text(String(it.data||""), 40, y);
      doc.text(String(it.cliente||""), 120, y);
      doc.text(String(it.representante||""), 260, y);
      doc.text(String(it.produto||""), 380, y);
      doc.text(String(it.quantidade||0), 500, y);
      y+=14;
    });
    doc.save(`relatorio_${Date.now()}.pdf`);
  }catch(err){ console.error(err); toast("Erro ao gerar PDF"); }
}
