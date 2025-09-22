/*********************** Firebase ************************/
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

/*********************** Utils ************************/
const $ = (id) => document.getElementById(id);
const esc = (v) => (v==null ? "" : String(v));
const toast = (m)=>{ try{ alert(m); }catch(_){ console.log(m);} };
const isLoginPage = () => location.pathname.endsWith("login.html") || location.href.includes("login.html");

/*********************** Roteamento por auth ************************/
auth.onAuthStateChanged((user)=>{
  if (user) {
    if (!isLoginPage()) {
      const ue = $("user-email"); if (ue) ue.textContent = user.email||"-";
      initApp(); // monta UI e carrega dados
    } else {
      location.href = "index.html";
    }
  } else {
    if (!isLoginPage()) location.href = "login.html";
  }
});

/*********************** Logout ************************/
const logoutBtn = $("logout-btn");
if (logoutBtn) logoutBtn.onclick = async ()=>{ try{ await auth.signOut(); }catch(e){ toast("Erro ao sair: "+e.message);} };

/*********************** Seções / navegação ************************/
function showSection(id){
  document.querySelectorAll("main section").forEach(s=>s.classList.add("hidden"));
  const sec = $(id); if (sec) sec.classList.remove("hidden");
}

/*********************** Montagem de UI ************************/
function buildDashboardSection(){
  $("dashboard-section").innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Dashboard</h1>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white p-4 rounded shadow"><div class="text-sm text-gray-500">Clientes</div><div class="text-3xl font-bold" id="count-clientes">0</div></div>
      <div class="bg-white p-4 rounded shadow"><div class="text-sm text-gray-500">Representantes</div><div class="text-3xl font-bold" id="count-reps">0</div></div>
      <div class="bg-white p-4 rounded shadow"><div class="text-sm text-gray-500">Produtos</div><div class="text-3xl font-bold" id="count-produtos">0</div></div>
      <div class="bg-white p-4 rounded shadow"><div class="text-sm text-gray-500">Agendamentos</div><div class="text-3xl font-bold" id="count-agenda">0</div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded shadow col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Calendário de Agendamentos</h3>
          <div class="space-x-2">
            <button id="cal-prev" class="px-2 py-1 border rounded">◀</button>
            <span id="cal-title" class="font-semibold"></span>
            <button id="cal-next" class="px-2 py-1 border rounded">▶</button>
            <button id="cal-today" class="px-2 py-1 border rounded">Hoje</button>
          </div>
        </div>
        <div id="calendar-grid"></div>
      </div>

      <div class="space-y-4">
        <div class="bg-white p-4 rounded shadow" style="height:220px;">
          <h4 class="font-semibold mb-2">Ranking Representantes</h4>
          <canvas id="chart-reps"></canvas>
        </div>
        <div class="bg-white p-4 rounded shadow" style="height:220px;">
          <h4 class="font-semibold mb-2">Ranking Clientes</h4>
          <canvas id="chart-clients"></canvas>
        </div>
      </div>
    </div>
  `;
}

function buildClientesSection(){
  $("clientes-section").innerHTML = `
    <h2 class="text-xl font-bold mb-4">Clientes</h2>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="client-name" class="border p-2 rounded" placeholder="Nome">
        <input id="client-whatsapp" class="border p-2 rounded" placeholder="WhatsApp (ex: 98991234567)">
        <input id="client-rep" class="border p-2 rounded" placeholder="Representante (opcional)">
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button id="save-client" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
        <label class="text-sm text-gray-600">Importar .xlsx (colunas: Nome, WhatsApp)</label>
        <input type="file" id="import-clients" accept=".xlsx">
        <button id="import-clients-btn" class="bg-green-600 text-white px-3 py-1 rounded">Importar</button>
      </div>
    </div>
    <ul id="client-list" class="space-y-2"></ul>
  `;
}

function buildRepsSection(){
  $("reps-section").innerHTML = `
    <h2 class="text-xl font-bold mb-4">Representantes</h2>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex gap-2">
        <input id="rep-name" class="border p-2 rounded flex-1" placeholder="Nome">
        <button id="save-rep" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
    </div>
    <ul id="reps-list" class="space-y-2"></ul>
  `;
}

function buildProdsSection(){
  $("prods-section").innerHTML = `
    <h2 class="text-xl font-bold mb-4">Produtos</h2>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="prod-name" class="border p-2 rounded" placeholder="Nome">
        <input id="prod-price" class="border p-2 rounded" placeholder="Preço (ex: 12.5000)">
        <button id="save-prod" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
    </div>
    <ul id="prods-list" class="space-y-2"></ul>
  `;
}

function buildAgendamentosSection(){
  $("agendamentos-section").innerHTML = `
    <h2 class="text-xl font-bold mb-4">Agendamentos</h2>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input id="appt-date" type="date" class="border p-2 rounded">
        <select id="appt-client-select" class="border p-2 rounded"><option value="">Cliente</option></select>
        <select id="appt-rep-select" class="border p-2 rounded"><option value="">Representante</option></select>
        <select id="appt-prod-select" class="border p-2 rounded"><option value="">Produto</option></select>
        <input id="appt-qty" type="number" min="1" class="border p-2 rounded" placeholder="Qtd">
        <button id="save-appt" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button>
      </div>
    </div>
    <ul id="appts-list" class="space-y-2"></ul>
  `;
}

function buildReportsSection(){
  $("reports-section").innerHTML = `
    <h2 class="text-2xl font-bold mb-4">Relatórios</h2>
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input id="report-start" type="date" class="border p-2 rounded">
        <input id="report-end"   type="date" class="border p-2 rounded">
        <select id="report-rep"  class="border p-2 rounded"><option value="">Todos Representantes</option></select>
        <select id="report-prod" class="border p-2 rounded"><option value="">Todos Produtos</option></select>
        <button id="apply-report" class="bg-blue-600 text-white px-4 py-2 rounded">Aplicar</button>
      </div>
    </div>
    <div id="report-output" class="bg-white p-4 rounded shadow"></div>
    <div class="bg-white p-4 rounded shadow mt-4" style="height:300px;">
      <canvas id="chart-report"></canvas>
    </div>
    <div class="mt-4">
      <button id="export-pdf" class="bg-red-600 text-white px-4 py-2 rounded">Exportar PDF</button>
    </div>
  `;
}

/*********************** Estado e gráficos ************************/
let chartReps=null, chartClients=null, chartReport=null, currentCalDate=new Date();

function destroyChart(inst){ try{ if (inst) inst.destroy(); }catch(_){} }

/*********************** Inicialização principal ************************/
function initApp(){
  // montar UI (idempotente)
  buildDashboardSection();
  buildClientesSection();
  buildRepsSection();
  buildProdsSection();
  buildAgendamentosSection();
  buildReportsSection();

  // menu
  const map = {
    "menu-dashboard":"dashboard-section",
    "menu-agendamentos":"agendamentos-section",
    "menu-clientes":"clientes-section",
    "menu-representantes":"reps-section",
    "menu-produtos":"prods-section",
    "menu-relatorios":"reports-section"
  };
  Object.keys(map).forEach(id=>{
    const b=$(id); if(!b) return;
    b.onclick=()=>{
      showSection(map[id]);
      if(map[id]==="dashboard-section") carregarDashboard();
      if(map[id]==="clientes-section")  carregarClientes();
      if(map[id]==="reps-section")      carregarReps();
      if(map[id]==="prods-section")     carregarProds();
      if(map[id]==="agendamentos-section"){ carregarAgendamentos(); popularSelectsAppt(); }
      if(map[id]==="reports-section"){   popularFiltrosRelatorio(); }
    };
  });

  // default
  showSection("dashboard-section");
  carregarDashboard();
  carregarClientes();
  carregarReps();
  carregarProds();
  carregarAgendamentos();
  popularSelectsAppt();
  popularFiltrosRelatorio();

  // relatório eventos
  $("apply-report").onclick = aplicarRelatorio;
  $("export-pdf").onclick   = exportarPDF;
}

/*********************** Dashboard ************************/
async function carregarDashboard(){
  const uid = auth.currentUser?.uid;
  if(!uid) return;

  // Contagens (sem orderBy para evitar índice composto)
  const [c, r, p, a] = await Promise.all([
    db.collection("clientes").where("userId","==",uid).get(),
    db.collection("representantes").where("userId","==",uid).get(),
    db.collection("produtos").where("userId","==",uid).get(),
    db.collection("agendamentos").where("userId","==",uid).get()
  ]);
  $("count-clientes").textContent = c.size;
  $("count-reps").textContent     = r.size;
  $("count-produtos").textContent = p.size;
  $("count-agenda").textContent   = a.size;

  // rankings
  const byRep={}, byClient={};
  a.forEach(d=>{
    const x=d.data(); const q=parseInt(x.quantidade)||0;
    byRep[x.representante||"—"]  = (byRep[x.representante||"—"]||0)+q;
    byClient[x.cliente||"—"]     = (byClient[x.cliente||"—"]||0)+q;
  });

  destroyChart(chartReps);
  chartReps = new Chart($("chart-reps"), {
    type:"bar",
    data:{ labels:Object.keys(byRep), datasets:[{label:"Qtd", data:Object.values(byRep), backgroundColor:"rgba(59,130,246,0.6)"}] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true} } }
  });

  destroyChart(chartClients);
  chartClients = new Chart($("chart-clients"), {
    type:"bar",
    data:{ labels:Object.keys(byClient), datasets:[{label:"Qtd", data:Object.values(byClient), backgroundColor:"rgba(34,197,94,0.6)"}] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true} } }
  });

  // calendário
  renderCalendar(currentCalDate, a.docs.map(d=>({id:d.id, ...d.data()})));
}

/*********************** Calendário ************************/
function renderCalendar(refDate, appts){
  const grid = $("calendar-grid"), title=$("cal-title");
  if(!grid||!title) return;

  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  title.textContent = refDate.toLocaleString("pt-BR", { month:"long", year:"numeric" });

  const first = new Date(y, m, 1);
  const startWeekDay = (first.getDay()+7)%7;
  const lastDay = new Date(y, m+1, 0).getDate();

  // botões
  $("cal-prev").onclick = ()=>{ currentCalDate=new Date(y,m-1,1); carregarDashboard(); };
  $("cal-next").onclick = ()=>{ currentCalDate=new Date(y,m+1,1); carregarDashboard(); };
  $("cal-today").onclick= ()=>{ currentCalDate=new Date(); carregarDashboard(); };

  // map dia -> itens
  const map={};
  appts.forEach(a=>{
    const d=a.data; // 'YYYY-MM-DD'
    if(!d) return;
    const mm = `${y}-${String(m+1).padStart(2,'0')}`;
    if(d.startsWith(mm)) (map[d] = map[d]||[]).push(a);
  });

  // desenhar
  grid.innerHTML = `
    <div class="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2">
      <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
    </div>`;
  const body = document.createElement("div");
  body.className="grid grid-cols-7 gap-2";

  for(let i=0;i<startWeekDay;i++){ body.appendChild(blankCell()); }

  for(let day=1; day<=lastDay; day++){
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cell = document.createElement("div");
    cell.className = "p-2 border rounded hover:shadow cursor-pointer bg-white";
    const count = (map[dateStr]||[]).length;
    cell.innerHTML = `<div class="text-sm font-semibold mb-1">${day}</div>
                      <div class="text-xs ${count? 'text-gray-700':'text-gray-300'}">${count||'—'} agendamento(s)</div>`;
    cell.onclick = ()=>{
      showSection("agendamentos-section");
      renderApptsList(map[dateStr]||[]);
    };
    body.appendChild(cell);
  }
  grid.appendChild(body);

  function blankCell(){
    const d = document.createElement("div");
    d.className="p-2 border rounded bg-gray-50"; return d;
  }
}

/*********************** Clientes ************************/
async function carregarClientes(){
  const uid = auth.currentUser?.uid; if(!uid) return;
  const list = $("client-list");
  // bind botões
  const save = $("save-client"); if (save && !save._bound){
    save._bound = true;
    save.onclick = async ()=>{
      const nome=$("client-name").value.trim();
      let whats=$("client-whatsapp").value.trim().replace(/^\+?55/,"");
      const rep=$("client-rep").value.trim();
      if(!nome) return toast("Informe o nome.");
      await db.collection("clientes").add({ nome, whatsapp:whats, representante:rep||null, userId:uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      $("client-name").value=""; $("client-whatsapp").value=""; $("client-rep").value="";
    };
    const impBtn=$("import-clients-btn"), impInp=$("import-clients");
    if(impBtn && impInp && !impBtn._bound){
      impBtn._bound=true;
      impBtn.onclick=()=>{
        if(!impInp.files?.[0]) return toast("Selecione um .xlsx");
        const reader=new FileReader();
        reader.onload=async(ev)=>{
          try{
            const wb=XLSX.read(new Uint8Array(ev.target.result),{type:"array"});
            const sheet=wb.Sheets[wb.SheetNames[0]];
            const rows=XLSX.utils.sheet_to_json(sheet);
            let n=0;
            for(const r of rows){
              const nome=esc(r.Nome||r.nome||r.Name).trim();
              let whatsapp=esc(r.WhatsApp||r.whatsapp||"").trim().replace(/^\+?55/,"");
              if(!nome) continue;
              await db.collection("clientes").add({ nome, whatsapp, userId:uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
              n++;
            }
            toast(`Importados ${n} cliente(s).`);
            impInp.value="";
          }catch(e){ console.error(e); toast("Erro ao importar."); }
        };
        reader.readAsArrayBuffer(impInp.files[0]);
      };
    }
  }
  // live list
  db.collection("clientes").where("userId","==",uid).onSnapshot(snap=>{
    list.innerHTML="";
    snap.forEach(doc=>{
      const d=doc.data();
      const li=document.createElement("li");
      li.className="p-2 bg-white rounded shadow flex justify-between items-center";
      li.innerHTML=`
        <div><div class="font-semibold">${esc(d.nome)}</div><div class="text-sm text-gray-500">${esc(d.whatsapp||"")}</div></div>
        <div class="space-x-2">
          <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-a="e">Editar</button>
          <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-a="d">Excluir</button>
        </div>`;
      list.appendChild(li);
    });
    bindActions(list,"clientes",["nome","whatsapp","representante"]);
  });
}

/*********************** Representantes ************************/
async function carregarReps(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  const list=$("reps-list");
  const save=$("save-rep");
  if(save && !save._bound){
    save._bound=true;
    save.onclick=async ()=>{
      const nome=$("rep-name").value.trim();
      if(!nome) return toast("Informe o nome.");
      await db.collection("representantes").add({ nome, userId:uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      $("rep-name").value="";
    };
  }
  db.collection("representantes").where("userId","==",uid).onSnapshot(snap=>{
    list.innerHTML="";
    snap.forEach(doc=>{
      const d=doc.data();
      const li=document.createElement("li");
      li.className="p-2 bg-white rounded shadow flex justify-between items-center";
      li.innerHTML=`
        <div class="font-semibold">${esc(d.nome)}</div>
        <div class="space-x-2">
          <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-a="e">Editar</button>
          <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-a="d">Excluir</button>
        </div>`;
      list.appendChild(li);
    });
    bindActions(list,"representantes",["nome"]);
  });
}

/*********************** Produtos ************************/
async function carregarProds(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  const list=$("prods-list");
  const save=$("save-prod");
  if(save && !save._bound){
    save._bound=true;
    save.onclick=async ()=>{
      const nome=$("prod-name").value.trim();
      const preco=parseFloat($("prod-price").value)||0;
      if(!nome) return toast("Informe o nome.");
      await db.collection("produtos").add({ nome, preco, userId:uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      $("prod-name").value=""; $("prod-price").value="";
    };
  }
  db.collection("produtos").where("userId","==",uid).onSnapshot(snap=>{
    list.innerHTML="";
    snap.forEach(doc=>{
      const d=doc.data();
      const li=document.createElement("li");
      li.className="p-2 bg-white rounded shadow flex justify-between items-center";
      li.innerHTML=`
        <div>${esc(d.nome)} — R$ ${Number(d.preco||0).toFixed(4)}</div>
        <div class="space-x-2">
          <button class="px-2 py-1 rounded bg-yellow-400" data-id="${doc.id}" data-a="e">Editar</button>
          <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${doc.id}" data-a="d">Excluir</button>
        </div>`;
      list.appendChild(li);
    });
    bindActions(list,"produtos",["nome","preco"]);
  });
}

/*********************** Agendamentos ************************/
function popularSelectsAppt(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  // clientes
  db.collection("clientes").where("userId","==",uid).get().then(s=>{
    const sel=$("appt-client-select"); if(!sel) return;
    sel.innerHTML=`<option value="">Cliente</option>`;
    s.forEach(d=>{ const o=document.createElement("option"); o.value=d.data().nome; o.textContent=d.data().nome; sel.appendChild(o); });
  });
  // reps
  db.collection("representantes").where("userId","==",uid).get().then(s=>{
    const sel=$("appt-rep-select"); if(!sel) return;
    sel.innerHTML=`<option value="">Representante</option>`;
    s.forEach(d=>{ const o=document.createElement("option"); o.value=d.data().nome; o.textContent=d.data().nome; sel.appendChild(o); });
  });
  // prods
  db.collection("produtos").where("userId","==",uid).get().then(s=>{
    const sel=$("appt-prod-select"); if(!sel) return;
    sel.innerHTML=`<option value="">Produto</option>`;
    s.forEach(d=>{ const o=document.createElement("option"); o.value=d.data().nome; o.textContent=d.data().nome; sel.appendChild(o); });
  });
}

async function carregarAgendamentos(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  const list=$("appts-list");
  const save=$("save-appt");
  if(save && !save._bound){
    save._bound=true;
    save.onclick=async ()=>{
      const data=$("appt-date").value;
      const cliente=$("appt-client-select").value;
      const representante=$("appt-rep-select").value;
      const produto=$("appt-prod-select").value;
      const quantidade=parseInt($("appt-qty").value,10)||0;
      if(!data||!cliente||!representante||!produto||!quantidade) return toast("Preencha todos os campos.");
      await db.collection("agendamentos").add({ data, cliente, representante, produto, quantidade, userId:uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      $("appt-date").value=""; $("appt-qty").value="";
    };
  }
  db.collection("agendamentos").where("userId","==",uid).onSnapshot(snap=>{
    const items = snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=>esc(a.data).localeCompare(esc(b.data)));
    renderApptsList(items);
    // também atualiza dashboard em tempo real
    carregarDashboard();
  });
}

function renderApptsList(items){
  const list=$("appts-list"); list.innerHTML="";
  if(!items.length){ list.innerHTML=`<li class="text-gray-500">Nenhum agendamento.</li>`; return; }
  items.forEach(a=>{
    const li=document.createElement("li");
    li.className="p-2 bg-white rounded shadow flex justify-between items-center";
    li.innerHTML=`
      <div>
        <div class="font-semibold">${esc(a.data)} — ${esc(a.cliente)}</div>
        <div class="text-sm text-gray-500">Rep: ${esc(a.representante)} • ${esc(a.produto)} • Qtd: ${esc(a.quantidade)}</div>
      </div>
      <div class="space-x-2">
        <button class="px-2 py-1 rounded bg-yellow-400" data-id="${a.id}" data-a="e">Editar</button>
        <button class="px-2 py-1 rounded bg-red-600 text-white" data-id="${a.id}" data-a="d">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  bindActions(list,"agendamentos",["data","cliente","representante","produto","quantidade"]);
}

/*********************** Ações editar/excluir genéricas ************************/
function bindActions(container, collectionName, fields){
  container.querySelectorAll("button[data-a]").forEach(btn=>{
    btn.onclick = async (e)=>{
      const id = e.currentTarget.getAttribute("data-id");
      const a  = e.currentTarget.getAttribute("data-a");
      if (a==="d"){
        if(!confirm("Excluir?")) return;
        await db.collection(collectionName).doc(id).delete();
      } else if (a==="e"){
        const snap = await db.collection(collectionName).doc(id).get();
        const d = snap.data();
        const current = fields.map(f=>esc(d[f]??"")).join(",");
        const novos = prompt(`Digite novos valores separados por vírgula (${fields.join(",")}):`, current);
        if(novos==null) return;
        const arr = novos.split(",");
        const up={};
        fields.forEach((f,i)=> up[f] = (arr[i]??"").trim());
        // normalização telefone
        if ("whatsapp" in up) up.whatsapp = up.whatsapp.replace(/^\+?55/,"");
        // coerção numérica simples
        if ("preco" in up) up.preco = parseFloat(up.preco)||0;
        if ("quantidade" in up) up.quantidade = parseInt(up.quantidade)||0;
        await db.collection(collectionName).doc(id).update(up);
      }
    };
  });
}

/*********************** Relatórios ************************/
async function popularFiltrosRelatorio(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  const repSel=$("report-rep"), prodSel=$("report-prod");
  if(repSel){
    repSel.innerHTML=`<option value="">Todos Representantes</option>`;
    (await db.collection("representantes").where("userId","==",uid).get()).forEach(d=>{
      const o=document.createElement("option"); o.value=d.data().nome; o.textContent=d.data().nome; repSel.appendChild(o);
    });
  }
  if(prodSel){
    prodSel.innerHTML=`<option value="">Todos Produtos</option>`;
    (await db.collection("produtos").where("userId","==",uid).get()).forEach(d=>{
      const o=document.createElement("option"); o.value=d.data().nome; o.textContent=d.data().nome; prodSel.appendChild(o);
    });
  }
}

async function aplicarRelatorio(){
  const uid=auth.currentUser?.uid; if(!uid) return;
  const start=$("report-start").value||null;
  const end  =$("report-end").value||null;
  const rep  =$("report-rep").value||"";
  const prod =$("report-prod").value||"";

  // busca simples por userId (sem orderBy/range para não exigir índice); filtros por data/rep/prod em memória
  const snap = await db.collection("agendamentos").where("userId","==",uid).get();
  let items = snap.docs.map(d=>({id:d.id, ...d.data()}));
  if(start) items = items.filter(i=> esc(i.data) >= start);
  if(end)   items = items.filter(i=> esc(i.data) <= end);
  if(rep)   items = items.filter(i=> i.representante === rep);
  if(prod)  items = items.filter(i=> i.produto === prod);
  items.sort((a,b)=> esc(a.data).localeCompare(esc(b.data)));

  renderReport(items);
}

function renderReport(items){
  const out=$("report-output");
  out.innerHTML = "";
  if(!items.length){ out.innerHTML=`<div class="text-gray-500">Nenhum registro para o filtro.</div>`; destroyChart(chartReport); return; }

  // tabela
  const table=document.createElement("table");
  table.className="w-full text-sm";
  table.innerHTML=`
    <thead>
      <tr class="text-left border-b">
        <th class="p-2">Data</th><th class="p-2">Cliente</th><th class="p-2">Rep</th>
        <th class="p-2">Produto</th><th class="p-2">Qtd</th>
      </tr>
    </thead>`;
  const tb=document.createElement("tbody");
  let totalsByProd={}, totalGeral=0;
  items.forEach(it=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="p-2">${esc(it.data)}</td>
      <td class="p-2">${esc(it.cliente)}</td>
      <td class="p-2">${esc(it.representante)}</td>
      <td class="p-2">${esc(it.produto)}</td>
      <td class="p-2">${esc(it.quantidade)}</td>`;
    tb.appendChild(tr);
    const q=parseInt(it.quantidade)||0;
    totalsByProd[it.produto]=(totalsByProd[it.produto]||0)+q;
    totalGeral+=q;
  });
  table.appendChild(tb);
  out.appendChild(table);

  // resumo
  const sum=document.createElement("div");
  sum.className="mt-3 font-semibold";
  sum.textContent=`Total geral: ${totalGeral}`;
  out.appendChild(sum);

  // gráfico
  destroyChart(chartReport);
  chartReport = new Chart($("chart-report"), {
    type:"bar",
    data:{ labels:Object.keys(totalsByProd), datasets:[{label:"Quantidade", data:Object.values(totalsByProd), backgroundColor:"rgba(234,88,12,0.6)"}] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true} } }
  });

  // guarda para PDF
  window._lastReportItems = items;
}

function exportarPDF(){
  const items = window._lastReportItems || [];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });
  let y=40;
  doc.setFontSize(14); doc.text("Relatório de Agendamentos", 40, y); y+=18;
  doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleString()}`, 40, y); y+=16;
  doc.text("Data",40,y); doc.text("Cliente",120,y); doc.text("Rep",260,y); doc.text("Produto",380,y); doc.text("Qtd",520,y); y+=10;
  doc.line(40,y,560,y); y+=12;
  items.forEach(it=>{
    if(y>740){ doc.addPage(); y=40; }
    doc.text(String(it.data||""),40,y);
    doc.text(String(it.cliente||""),120,y);
    doc.text(String(it.representante||""),260,y);
    doc.text(String(it.produto||""),380,y);
    doc.text(String(it.quantidade||0),520,y);
    y+=14;
  });
  doc.save(`relatorio_${Date.now()}.pdf`);
}
