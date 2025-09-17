// app.js (module)

// ----------------- Imports Firebase (v11 compat) -----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// SheetJS (import as global via dynamic import)
const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");

// jsPDF and autoTable are loaded as globals by <script> in HTML
const { jsPDF } = window.jspdf;

// Chart is global (Chart)
const ChartLib = window.Chart;

// FullCalendar is global (FullCalendar)
const FullCalendar = window.FullCalendar;

// ----------------- Firebase Config (substitua se preciso) -----------------
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.appspot.com",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};

// ----------------- Init -----------------
const app = initializeApp(firebaseConfig);
const auth = getAuth ? getAuth(app) : getAuth(app); // safe
const db = getFirestore(app);

// ----------------- Helpers & UI -----------------
const pages = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('.nav-btn');

function showPage(id) {
  pages.forEach(p => p.id === id ? p.classList.remove('hidden') : p.classList.add('hidden'));
  const title = document.getElementById('page-title');
  title.textContent = id.charAt(0).toUpperCase() + id.slice(1);
}
navBtns.forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

// set default page
showPage('dashboard');

// ----------------- Auth handlers -----------------
const loginBtn = document.getElementById('login-button');
const signupBtn = document.getElementById('signup-button');
const logoutBtn = document.getElementById('logout-button');
const userEmailDisplay = document.getElementById('user-email-display');

loginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert('Erro no login: ' + err.message);
  }
});

signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert('Conta criada! Faça o login.');
  } catch (err) {
    alert('Erro no cadastro: ' + err.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    // after signout onAuthStateChanged will show login
  } catch (err) {
    console.error(err);
    alert('Erro ao deslogar');
  }
});

// ----------------- Firestore CRUD / State -----------------
let calendar = null;
let chartReps = null;
let chartClients = null;

// utility: read collection and return array {id, ...data}
async function readCollection(name, orderField='') {
  try {
    const col = collection(db, name);
    let q = col;
    if (orderField) q = query(col, orderBy(orderField));
    const snap = await getDocs(q);
    const arr = [];
    snap.forEach(docSnap => arr.push({ id: docSnap.id, ...docSnap.data() }));
    return arr;
  } catch (err) {
    console.error('readCollection', name, err);
    return [];
  }
}

// ----------------- Populate summary cards -----------------
async function updateSummaryCards() {
  const clients = await readCollection('clientes');
  const products = await readCollection('produtos');
  const reps = await readCollection('representantes');
  // count appointments
  const appts = await readCollection('agendamentos');

  document.getElementById('card-clients').textContent = clients.length;
  document.getElementById('card-products').textContent = products.length;
  document.getElementById('card-reps').textContent = reps.length;
  document.getElementById('card-appts').textContent = appts.length;
}

// ----------------- Calendar (FullCalendar) -----------------
async function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendarEl.innerHTML = '';
  const appts = await readCollection('agendamentos');
  const events = appts.map(a => {
    const title = `(${a.quantidade}) ${a.produtoName || 'Produto'}`;
    return {
      id: a.id,
      title,
      start: a.data,
      extendedProps: a
    };
  });

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 600,
    events,
    eventClick: info => {
      const ap = info.event.extendedProps;
      alert(`Agendamento\nCliente: ${ap.clienteName}\nRepresentante: ${ap.representanteName}\nProduto: ${ap.produtoName}\nQtd: ${ap.quantidade}\nData: ${ap.data}`);
    }
  });
  calendar.render();
}

// ----------------- Load selects (clients, reps, products) -----------------
async function loadSelects() {
  const clients = await readCollection('clientes');
  const reps = await readCollection('representantes');
  const products = await readCollection('produtos');

  const selClient = document.getElementById('appt-client');
  const selRep = document.getElementById('appt-rep');
  const selProduct = document.getElementById('appt-product');
  const reportClient = document.getElementById('report-client');
  const reportRep = document.getElementById('report-rep');

  // helper to fill select
  function fill(selectEl, items, placeholder) {
    selectEl.innerHTML = '';
    const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent = placeholder; selectEl.appendChild(opt0);
    items.forEach(i => {
      const o = document.createElement('option'); o.value = i.id; o.textContent = i.name || i.nome || i.title || i.productName;
      selectEl.appendChild(o);
    });
  }

  fill(selClient, clients, 'Selecione cliente');
  fill(selRep, reps, 'Selecione representante');
  fill(selProduct, products, 'Selecione produto');
  fill(reportClient, clients, 'Todos os clientes');
  fill(reportRep, reps, 'Todos os representantes');
}

// ----------------- Agendamentos CRUD -----------------
let editApptId = null;
const apptForm = document.getElementById('appt-form');
const apptListEl = document.getElementById('appts-list');

apptForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientId = document.getElementById('appt-client').value;
  const repId = document.getElementById('appt-rep').value;
  const productId = document.getElementById('appt-product').value;
  const qty = parseInt(document.getElementById('appt-qty').value, 10);
  const date = document.getElementById('appt-date').value;

  if (!clientId || !repId || !productId || !qty || !date) { alert('Preencha todos os campos'); return; }

  // fetch names for nice display & reporting
  const clients = await readCollection('clientes');
  const reps = await readCollection('representantes');
  const products = await readCollection('produtos');

  const cliente = clients.find(c => c.id === clientId);
  const representante = reps.find(r => r.id === repId);
  const produto = products.find(p => p.id === productId);

  const payload = {
    clienteId: clientId,
    clienteName: cliente ? (cliente.name || cliente.nome) : '',
    representanteId: repId,
    representanteName: representante ? (representante.name || representante.nome) : '',
    produtoId: productId,
    produtoName: produto ? (produto.name || produto.nome) : '',
    quantidade: qty,
    data: date
  };

  try {
    if (editApptId) {
      await updateDoc(doc(db, 'agendamentos', editApptId), payload);
      editApptId = null;
    } else {
      await addDoc(collection(db, 'agendamentos'), payload);
    }
    apptForm.reset();
    await refreshAppointmentsUI();
    await renderCalendar();
    await updateChartsAndRankings();
    await updateSummaryCards();
  } catch (err) {
    console.error('save appt', err);
    alert('Erro ao salvar agendamento');
  }
});

// clear
document.getElementById('appt-clear').addEventListener('click', () => {
  apptForm.reset();
  editApptId = null;
});

async function refreshAppointmentsUI() {
  apptListEl.innerHTML = '';
  const appts = await readCollection('agendamentos', 'data');
  if (!appts.length) {
    apptListEl.innerHTML = '<div class="text-gray-500">Nenhum agendamento encontrado.</div>';
    return;
  }
  appts.forEach(a => {
    const card = document.createElement('div');
    card.className = 'p-3 bg-gray-50 rounded flex justify-between items-center';
    card.innerHTML = `
      <div>
        <div class="font-semibold">${a.clienteName} — ${a.produtoName}</div>
        <div class="text-sm text-gray-600">${a.data} • ${a.quantidade} unidade(s) • Rep: ${a.representanteName}</div>
      </div>
      <div class="space-x-2">
        <button data-id="${a.id}" class="edit-appt px-3 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${a.id}" class="del-appt px-3 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>
    `;
    apptListEl.appendChild(card);
  });

  // bind edit/delete
  document.querySelectorAll('.edit-appt').forEach(btn => btn.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const docRef = doc(db, 'agendamentos', id);
    // read doc to fill
    const snapshot = await getDocs(query(collection(db, 'agendamentos'))); // fallback
    // simpler: read all and find by id
    const all = await readCollection('agendamentos');
    const a = all.find(x => x.id === id);
    if (a) {
      document.getElementById('appt-client').value = a.clienteId;
      document.getElementById('appt-rep').value = a.representanteId;
      document.getElementById('appt-product').value = a.produtoId;
      document.getElementById('appt-qty').value = a.quantidade;
      document.getElementById('appt-date').value = a.data;
      editApptId = id;
      showPage('agendamentos');
    } else alert('Agendamento não encontrado');
  }));

  document.querySelectorAll('.del-appt').forEach(btn => btn.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir agendamento?')) return;
    await deleteDoc(doc(db, 'agendamentos', id));
    await refreshAppointmentsUI();
    await renderCalendar();
    await updateChartsAndRankings();
    await updateSummaryCards();
  }));
}

// ----------------- Clients / Reps / Products CRUD -----------------
let editClientId = null;
document.getElementById('client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('client-name').value.trim();
  const whatsapp = document.getElementById('client-whatsapp').value.trim();
  if (!name) return alert('Nome obrigatório');
  try {
    if (editClientId) {
      await updateDoc(doc(db, 'clientes', editClientId), { name, whatsapp });
      editClientId = null;
    } else {
      await addDoc(collection(db, 'clientes'), { name, whatsapp });
    }
    document.getElementById('client-form').reset();
    await loadClientsUI();
    await loadSelects();
    await updateSummaryCards();
    await updateChartsAndRankings();
  } catch (err) { console.error(err); alert('Erro salvar cliente'); }
});

async function loadClientsUI() {
  const list = document.getElementById('client-list');
  list.innerHTML = '';
  const rows = await readCollection('clientes', 'name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name} • ${r.whatsapp || ''}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-client px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-client px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-client').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('clientes');
    const item = all.find(x => x.id === id);
    if (!item) return alert('Não encontrado');
    document.getElementById('client-name').value = item.name;
    document.getElementById('client-whatsapp').value = item.whatsapp || '';
    editClientId = id;
  }));
  document.querySelectorAll('.del-client').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir cliente?')) return;
    await deleteDoc(doc(db, 'clientes', id));
    await loadClientsUI();
    await loadSelects();
    await updateSummaryCards();
  }));
}

let editRepId = null;
document.getElementById('rep-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('rep-name').value.trim();
  if (!name) return alert('Nome obrigatório');
  try {
    if (editRepId) {
      await updateDoc(doc(db, 'representantes', editRepId), { name });
      editRepId = null;
    } else {
      await addDoc(collection(db, 'representantes'), { name });
    }
    document.getElementById('rep-form').reset();
    await loadRepsUI();
    await loadSelects();
    await updateSummaryCards();
    await updateChartsAndRankings();
  } catch (err) { console.error(err); alert('Erro salvar representante'); }
});

async function loadRepsUI() {
  const list = document.getElementById('rep-list');
  list.innerHTML = '';
  const rows = await readCollection('representantes', 'name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-rep px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-rep px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-rep').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('representantes');
    const item = all.find(x => x.id === id);
    document.getElementById('rep-name').value = item.name;
    editRepId = id;
  }));
  document.querySelectorAll('.del-rep').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir representante?')) return;
    await deleteDoc(doc(db, 'representantes', id));
    await loadRepsUI();
    await loadSelects();
    await updateSummaryCards();
  }));
}

let editProdId = null;
document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const image = document.getElementById('product-image-url').value.trim();
  if (!name || isNaN(price)) return alert('Preencha os campos obrigatórios');
  try {
    if (editProdId) {
      await updateDoc(doc(db, 'produtos', editProdId), { name, category, price, image });
      editProdId = null;
    } else {
      await addDoc(collection(db, 'produtos'), { name, category, price, image });
    }
    document.getElementById('product-form').reset();
    await loadProductsUI();
    await loadSelects();
    await updateSummaryCards();
    await updateChartsAndRankings();
  } catch (err) { console.error(err); alert('Erro salvar produto'); }
});

async function loadProductsUI() {
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  const rows = await readCollection('produtos', 'name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name} • ${r.category || ''} • R$${r.price || 0}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-prod px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-prod px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-prod').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('produtos');
    const item = all.find(x => x.id === id);
    document.getElementById('product-name').value = item.name;
    document.getElementById('product-category').value = item.category;
    document.getElementById('product-price').value = item.price;
    document.getElementById('product-image-url').value = item.image || '';
    editProdId = id;
  }));
  document.querySelectorAll('.del-prod').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir produto?')) return;
    await deleteDoc(doc(db, 'produtos', id));
    await loadProductsUI();
    await loadSelects();
    await updateSummaryCards();
  }));
}

// ----------------- Import XLSX (clientes) -----------------
document.getElementById('client-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      for (const row of rows) {
        const nome = row.Nome || row.nome || row.Name;
        const whats = row.WhatsApp || row.whatsapp || row['Whats App'] || '';
        if (nome) await addDoc(collection(db, 'clientes'), { name: nome, whatsapp: whats });
      }
      await loadClientsUI();
      await loadSelects();
      await updateSummaryCards();
      alert('Importação concluída');
      ev.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error(err);
    alert('Erro importando planilha');
  }
});

// ----------------- Charts / Rankings -----------------
async function updateChartsAndRankings(periodStart=null, periodEnd=null) {
  // build data from agendamentos
  const appts = await readCollection('agendamentos');
  // filter by period if provided
  let filtered = appts;
  if (periodStart) filtered = filtered.filter(a => a.data >= periodStart);
  if (periodEnd) filtered = filtered.filter(a => a.data <= periodEnd);

  // reps totals
  const repTotals = {};
  const clientTotals = {};
  const productTotals = {};
  filtered.forEach(a => {
    repTotals[a.representanteName] = (repTotals[a.representanteName]||0) + (a.quantidade||0);
    clientTotals[a.clienteName] = (clientTotals[a.clienteName]||0) + (a.quantidade||0);
    productTotals[a.produtoName] = (productTotals[a.produtoName]||0) + (a.quantidade||0);
  });

  // prepare chart data (top 8)
  const repsSorted = Object.entries(repTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const repLabels = repsSorted.map(r=>r[0]||'—'); const repValues = repsSorted.map(r=>r[1]);

  const clientsSorted = Object.entries(clientTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const clientLabels = clientsSorted.map(r=>r[0]||'—'); const clientValues = clientsSorted.map(r=>r[1]);

  // render charts
  if (chartReps) chartReps.destroy();
  const ctxReps = document.getElementById('chart-reps').getContext('2d');
  chartReps = new ChartLib(ctxReps, { type:'bar', data:{ labels: repLabels, datasets:[{ label:'Quantidade', data: repValues }] }, options:{ responsive:true } });

  if (chartClients) chartClients.destroy();
  const ctxClients = document.getElementById('chart-clients').getContext('2d');
  chartClients = new ChartLib(ctxClients, { type:'bar', data:{ labels: clientLabels, datasets:[{ label:'Quantidade', data: clientValues }] }, options:{ responsive:true } });
}

// ----------------- Reports (generate PDF) -----------------
document.getElementById('generate-pdf').addEventListener('click', async (e) => {
  e.preventDefault();
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  const clientId = document.getElementById('report-client').value;
  const repId = document.getElementById('report-rep').value;

  const appts = await readCollection('agendamentos');
  let filtered = appts;
  if (start) filtered = filtered.filter(a => a.data >= start);
  if (end) filtered = filtered.filter(a => a.data <= end);
  if (clientId) filtered = filtered.filter(a=>a.clienteId === clientId);
  if (repId) filtered = filtered.filter(a=>a.representanteId === repId);

  // build totals per product and total geral
  const totalsByProduct = {};
  let totalGeral = 0;
  filtered.forEach(a => {
    totalsByProduct[a.produtoName] = (totalsByProduct[a.produtoName]||0) + (a.quantidade||0);
    totalGeral += (a.quantidade||0);
  });

  // prepare table rows
  const rows = filtered.map(a => [a.data, a.clienteName, a.representanteName, a.produtoName, a.quantidade]);

  // update preview
  const tableContainer = document.getElementById('report-table');
  tableContainer.innerHTML = `<table class="min-w-full"><thead><tr><th>Data</th><th>Cliente</th><th>Rep</th><th>Produto</th><th>Qtd</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}</tbody></table>`;
  document.getElementById('report-totals').innerHTML = `<div class="mt-3"><strong>Total Geral:</strong> ${totalGeral}</div><div class="mt-2"><strong>Por Produto:</strong><br>${Object.entries(totalsByProduct).map(t=>`${t[0]}: ${t[1]}`).join('<br>')}</div>`;

  // create PDF
  const docPdf = new jsPDF('p', 'pt', 'a4');
  docPdf.setFontSize(14);
  docPdf.text('Relatório de Agendamentos', 40, 40);
  docPdf.setFontSize(10);
  docPdf.text(`Período: ${start || '—'} a ${end || '—'}`, 40, 60);
  docPdf.text(`Total Geral: ${totalGeral}`, 40, 75);

  // table (autoTable)
  docPdf.autoTable({
    startY: 95,
    head: [['Data','Cliente','Representante','Produto','Quantidade']],
    body: rows
  });

  // add totals by product below table
  let finalY = docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY + 20 : 95;
  docPdf.text('Totais por produto:', 40, finalY);
  finalY += 12;
  Object.entries(totalsByProduct).forEach(([prod, q]) => {
    docPdf.text(`${prod}: ${q}`, 40, finalY);
    finalY += 12;
  });

  // add charts as images (optional) - generate small chart canvases
  // generate reps chart image
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = 600; tmpCanvas.height = 300;
  const tmpCtx = tmpCanvas.getContext('2d');
  new ChartLib(tmpCtx, {
    type:'bar',
    data:{ labels: Object.keys(totalsByProduct), datasets:[{ label:'Qtd', data: Object.values(totalsByProduct) }] },
    options:{ responsive:false, plugins:{ legend:{ display:false } } }
  });
  // wait render then add image
  await new Promise(r => setTimeout(r, 700));
  const imgData = tmpCanvas.toDataURL('image/png');
  docPdf.addPage();
  docPdf.text('Gráfico - Produtos', 40, 40);
  docPdf.addImage(imgData, 'PNG', 40, 60, 500, 250);

  // download
  docPdf.save(`relatorio_agendamentos_${Date.now()}.pdf`);
});

// ----------------- initial loading after login -----------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userEmailDisplay.textContent = user.email || user.displayName || 'Usuário';
    // load UI data
    await loadClientsUI();
    await loadRepsUI();
    await loadProductsUI();
    await loadSelects();
    await refreshAppointmentsUI();
    await renderCalendar();
    await updateSummaryCards();
    await updateChartsAndRankings();
  } else {
    userEmailDisplay.textContent = '-';
  }
});

// initial helper functions
async function loadClientsUI() { /* placeholder populated earlier */ return await loadClientsUI_impl(); }
async function loadRepsUI() { return await loadRepsUI_impl(); }
async function loadProductsUI() { return await loadProductsUI_impl(); }

// to avoid duplication because above functions are defined earlier in file style, we ensure they're defined:
async function loadClientsUI_impl() {
  const list = document.getElementById('client-list');
  list.innerHTML = '';
  const rows = await readCollection('clientes','name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name} • ${r.whatsapp||''}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-client px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-client px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-client').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('clientes');
    const item = all.find(x => x.id === id);
    document.getElementById('client-name').value = item.name;
    document.getElementById('client-whatsapp').value = item.whatsapp || '';
    editClientId = id;
  }));
  document.querySelectorAll('.del-client').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir cliente?')) return;
    await deleteDoc(doc(db,'clientes',id));
    await loadClientsUI_impl();
    await loadSelects();
    await updateSummaryCards();
  }));
}

async function loadRepsUI_impl() {
  const list = document.getElementById('rep-list');
  list.innerHTML = '';
  const rows = await readCollection('representantes','name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-rep px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-rep px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-rep').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('representantes');
    const item = all.find(x => x.id === id);
    document.getElementById('rep-name').value = item.name;
    editRepId = id;
  }));
  document.querySelectorAll('.del-rep').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir representante?')) return;
    await deleteDoc(doc(db,'representantes',id));
    await loadRepsUI_impl();
    await loadSelects();
    await updateSummaryCards();
  }));
}

async function loadProductsUI_impl() {
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  const rows = await readCollection('produtos','name');
  rows.forEach(r => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded flex justify-between items-center';
    li.innerHTML = `<div>${r.name} • ${r.category||''} • R$${r.price||0}</div>
      <div class="space-x-2">
        <button data-id="${r.id}" class="edit-prod px-2 py-1 bg-yellow-400 rounded">Editar</button>
        <button data-id="${r.id}" class="del-prod px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
      </div>`;
    list.appendChild(li);
  });
  document.querySelectorAll('.edit-prod').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    const all = await readCollection('produtos');
    const item = all.find(x => x.id === id);
    document.getElementById('product-name').value = item.name;
    document.getElementById('product-category').value = item.category;
    document.getElementById('product-price').value = item.price;
    document.getElementById('product-image-url').value = item.image || '';
    editProdId = id;
  }));
  document.querySelectorAll('.del-prod').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Excluir produto?')) return;
    await deleteDoc(doc(db,'produtos',id));
    await loadProductsUI_impl();
    await loadSelects();
    await updateSummaryCards();
  }));
}

// ----------------- loadSelects implementation (overrides previous) -----------------
async function loadSelects() {
  const clients = await readCollection('clientes');
  const reps = await readCollection('representantes');
  const products = await readCollection('produtos');

  const selClient = document.getElementById('appt-client');
  const selRep = document.getElementById('appt-rep');
  const selProduct = document.getElementById('appt-product');
  const reportClient = document.getElementById('report-client');
  const reportRep = document.getElementById('report-rep');

  function fill(selectEl, items, placeholder) {
    selectEl.innerHTML = '';
    const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent = placeholder; selectEl.appendChild(opt0);
    items.forEach(i => {
      const o = document.createElement('option'); o.value = i.id; o.textContent = i.name || i.nome || '—';
      selectEl.appendChild(o);
    });
  }

  fill(selClient, clients, 'Selecione cliente');
  fill(selRep, reps, 'Selecione representante');
  fill(selProduct, products, 'Selecione produto');
  fill(reportClient, clients, 'Todos os clientes');
  fill(reportRep, reps, 'Todos os representantes');
}

// ----------------- ensure initial state if user already logged in -----------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadClientsUI_impl();
    await loadRepsUI_impl();
    await loadProductsUI_impl();
    await loadSelects();
    await refreshAppointmentsUI();
    await renderCalendar();
    await updateSummaryCards();
    await updateChartsAndRankings();
  }
});

// ---- end of app.js ----
