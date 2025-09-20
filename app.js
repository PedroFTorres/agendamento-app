// app.js - Versão completa (compat Firebase v8, FullCalendar, Chart.js, jsPDF, XLSX)
// -------------------------
// Config Firebase (mantive a configuração que você usou)
// -------------------------
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
const db = firebase.firestore();

// -------------------------
// Helpers DOM & Estado
// -------------------------
const loginScreen = document.getElementById('login-screen');
const appRoot = document.getElementById('app-root');
const userEmailDisplay = document.getElementById('user-email-display');
const navButtons = document.querySelectorAll('.nav-btn');
const pageTitle = document.getElementById('page-title');

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.id === pageId ? p.classList.remove('hidden') : p.classList.add('hidden'));
  pageTitle.textContent = {
    'dashboard-page': 'Dashboard',
    'agendamentos-page': 'Agendamentos',
    'clientes-page': 'Clientes',
    'representantes-page': 'Representantes',
    'produtos-page': 'Produtos',
    'relatorios-page': 'Relatórios'
  }[pageId] || 'Painel';
}
navButtons.forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
showPage('dashboard-page');

// -------------------------
// Auth: login / register / logout
// -------------------------
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginMsg = document.getElementById('login-msg');

loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    loginMsg.classList.add('hidden');
  } catch (err) {
    loginMsg.textContent = err.message;
    loginMsg.classList.remove('hidden');
    console.error('login err', err);
  }
});

registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    alert('Conta criada com sucesso.');
  } catch (err) {
    alert('Erro criar conta: ' + err.message);
    console.error(err);
  }
});

logoutBtn.addEventListener('click', async () => {
  try { await auth.signOut(); }
  catch (err) { console.error('logout err', err); alert('Erro ao deslogar'); }
});

// -------------------------
// onAuthStateChanged -> inicializa UI
// -------------------------
onAuthStateChangedHandler = async (user) => {
  if (user) {
    loginScreen.classList.add('hidden');
    appRoot.classList.remove('hidden');
    userEmailDisplay.textContent = user.email || '-';
    // inicializa listeners / UI
    await initAppData();
  } else {
    loginScreen.classList.remove('hidden');
    appRoot.classList.add('hidden');
    userEmailDisplay.textContent = '-';
  }
};
auth.onAuthStateChanged(onAuthStateChangedHandler);

// -------------------------
// Inicialização de coleções
// -------------------------
const clientsCol = db.collection('clientes');
const repsCol = db.collection('representantes');
const productsCol = db.collection('produtos');
const apptsCol = db.collection('agendamentos');

// -------------------------
// Update summary cards
// -------------------------
async function updateSummaryCards() {
  const [cSnap, pSnap, rSnap, aSnap] = await Promise.all([
    clientsCol.get(), productsCol.get(), repsCol.get(), apptsCol.get()
  ]);
  document.getElementById('card-clients').textContent = cSnap.size;
  document.getElementById('card-products').textContent = pSnap.size;
  document.getElementById('card-reps').textContent = rSnap.size;
  document.getElementById('card-appts').textContent = aSnap.size;
}

// -------------------------
// Load selects for appointments & reports
// -------------------------
async function loadSelectOptions() {
  const [clients, reps, products] = await Promise.all([clientsCol.get(), repsCol.get(), productsCol.get()]);
  const selClient = document.getElementById('appt-client');
  const selRep = document.getElementById('appt-rep');
  const selProduct = document.getElementById('appt-product');
  const reportClient = document.getElementById('report-client');
  const reportRep = document.getElementById('report-rep');

  function fill(sel, snapshot, placeholder) {
    if (!sel) return;
    sel.innerHTML = '';
    const opt = document.createElement('option'); opt.value=''; opt.textContent = placeholder; sel.appendChild(opt);
    snapshot.forEach(d => {
      const o = document.createElement('option'); o.value = d.id; o.textContent = d.data().nome || d.data().name || '—';
      sel.appendChild(o);
    });
  }
  fill(selClient, clients, 'Selecione cliente');
  fill(selRep, reps, 'Selecione representante');
  fill(selProduct, products, 'Selecione produto');
  fill(reportClient, clients, 'Todos os clientes');
  fill(reportRep, reps, 'Todos os representantes');
}

// -------------------------
// CLIENTS CRUD + import XLSX
// -------------------------
let editClientId = null;
const clientListEl = document.getElementById('client-list');
document.getElementById('client-save').addEventListener('click', async () => {
  const name = document.getElementById('client-name').value.trim();
  const whats = document.getElementById('client-whatsapp').value.trim();
  if (!name) return alert('Nome obrigatório');
  try {
    if (editClientId) {
      await clientsCol.doc(editClientId).update({ nome: name, whatsapp: whats });
      editClientId = null;
    } else {
      await clientsCol.add({ nome: name, whatsapp: whats });
    }
    document.getElementById('client-name').value = '';
    document.getElementById('client-whatsapp').value = '';
  } catch (err) { console.error(err); alert('Erro salvar cliente'); }
});

const clientFileInput = document.getElementById('client-file');
clientFileInput.addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    let count = 0;
    for (const r of rows) {
      const nome = r.Nome || r.nome || r.Name;
      const whats = r.WhatsApp || r.whatsapp || r['Whats App'] || '';
      if (nome) {
        await clientsCol.add({ nome, whatsapp: whats });
        count++;
      }
    }
    alert(`Importados ${count} clientes`);
  } catch (err) {
    console.error('import err', err);
    alert('Erro ao importar planilha: ' + (err.message||err));
  } finally {
    ev.target.value = '';
  }
});

function bindClientsSnapshot() {
  clientsCol.orderBy('nome').onSnapshot(snapshot => {
    clientListEl.innerHTML = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement('div');
      li.className = 'p-3 bg-white rounded flex justify-between items-center';
      li.innerHTML = `<div>
                        <div class="font-semibold">${d.nome}</div>
                        <div class="text-sm text-gray-500">${d.whatsapp||''}</div>
                      </div>
                      <div class="space-x-2">
                        <button data-id="${doc.id}" class="edit-client px-3 py-1 bg-yellow-400 rounded">Editar</button>
                        <button data-id="${doc.id}" class="del-client px-3 py-1 bg-red-500 text-white rounded">Excluir</button>
                      </div>`;
      clientListEl.appendChild(li);
    });
    // bind actions
    document.querySelectorAll('.edit-client').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const snap = await clientsCol.doc(id).get();
      const data = snap.data();
      document.getElementById('client-name').value = data.nome || '';
      document.getElementById('client-whatsapp').value = data.whatsapp || '';
      editClientId = id;
      showPage('clientes-page');
    }));
    document.querySelectorAll('.del-client').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Excluir cliente?')) return;
      await clientsCol.doc(id).delete();
    }));
  });
}

// -------------------------
// REPRESENTANTES CRUD
// -------------------------
let editRepId = null;
const repListEl = document.getElementById('rep-list');
document.getElementById('rep-save').addEventListener('click', async () => {
  const name = document.getElementById('rep-name').value.trim();
  if (!name) return alert('Nome obrigatório');
  try {
    if (editRepId) {
      await repsCol.doc(editRepId).update({ nome: name });
      editRepId = null;
    } else {
      await repsCol.add({ nome: name });
    }
    document.getElementById('rep-name').value = '';
  } catch (err) { console.error(err); alert('Erro salvar representante'); }
});
function bindRepsSnapshot() {
  repsCol.orderBy('nome').onSnapshot(snapshot => {
    repListEl.innerHTML = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement('div');
      li.className = 'p-3 bg-white rounded flex justify-between items-center';
      li.innerHTML = `<div class="font-semibold">${d.nome}</div>
                      <div class="space-x-2">
                        <button data-id="${doc.id}" class="edit-rep px-3 py-1 bg-yellow-400 rounded">Editar</button>
                        <button data-id="${doc.id}" class="del-rep px-3 py-1 bg-red-500 text-white rounded">Excluir</button>
                      </div>`;
      repListEl.appendChild(li);
    });
    document.querySelectorAll('.edit-rep').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const snap = await repsCol.doc(id).get();
      document.getElementById('rep-name').value = snap.data().nome || '';
      editRepId = id;
      showPage('representantes-page');
    }));
    document.querySelectorAll('.del-rep').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Excluir representante?')) return;
      await repsCol.doc(id).delete();
    }));
  });
}

// -------------------------
// PRODUCTS CRUD
// -------------------------
let editProdId = null;
const productListEl = document.getElementById('product-list');
document.getElementById('product-save').addEventListener('click', async () => {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value.trim();
  const price = parseFloat(document.getElementById('product-price').value) || 0;
  const image = document.getElementById('product-image-url').value.trim();
  if (!name) return alert('Nome obrigatório');
  try {
    if (editProdId) {
      await productsCol.doc(editProdId).update({ nome: name, categoria: category, preco: price, imagem: image });
      editProdId = null;
    } else {
      await productsCol.add({ nome: name, categoria: category, preco: price, imagem: image });
    }
    document.getElementById('product-name').value = '';
    document.getElementById('product-category').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-image-url').value = '';
  } catch (err) { console.error(err); alert('Erro salvar produto'); }
});
function bindProductsSnapshot() {
  productsCol.orderBy('nome').onSnapshot(snapshot => {
    productListEl.innerHTML = '';
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement('div');
      li.className = 'p-3 bg-white rounded flex justify-between items-center';
      li.innerHTML = `<div>
                        <div class="font-semibold">${d.nome}</div>
                        <div class="text-sm text-gray-500">${d.categoria || ''} • R$ ${Number(d.preco||0).toFixed(4)}</div>
                      </div>
                      <div class="space-x-2">
                        <button data-id="${doc.id}" class="edit-prod px-3 py-1 bg-yellow-400 rounded">Editar</button>
                        <button data-id="${doc.id}" class="del-prod px-3 py-1 bg-red-500 text-white rounded">Excluir</button>
                      </div>`;
      productListEl.appendChild(li);
    });
    document.querySelectorAll('.edit-prod').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const snap = await productsCol.doc(id).get();
      const d = snap.data();
      document.getElementById('product-name').value = d.nome || '';
      document.getElementById('product-category').value = d.categoria || '';
      document.getElementById('product-price').value = d.preco || '';
      document.getElementById('product-image-url').value = d.imagem || '';
      editProdId = id;
      showPage('produtos-page');
    }));
    document.querySelectorAll('.del-prod').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Excluir produto?')) return;
      await productsCol.doc(id).delete();
    }));
  });
}

// -------------------------
// APPOINTMENTS CRUD + Calendar
// -------------------------
let editApptId = null;
const apptsListEl = document.getElementById('appts-list');
document.getElementById('appt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientId = document.getElementById('appt-client').value;
  const repId = document.getElementById('appt-rep').value;
  const productId = document.getElementById('appt-product').value;
  const date = document.getElementById('appt-date').value;
  const qty = parseInt(document.getElementById('appt-qty').value, 10) || 0;
  if (!clientId || !repId || !productId || !date) return alert('Preencha todos os campos');

  // read names
  const [cSnap, rSnap, pSnap] = await Promise.all([clientsCol.doc(clientId).get(), repsCol.doc(repId).get(), productsCol.doc(productId).get()]);
  const payload = {
    clienteId: clientId, clienteName: cSnap.data()?.nome || '',
    representanteId: repId, representanteName: rSnap.data()?.nome || '',
    produtoId: productId, produtoName: pSnap.data()?.nome || '',
    quantidade: qty, data: date
  };
  try {
    if (editApptId) {
      await apptsCol.doc(editApptId).update(payload);
      editApptId = null;
    } else {
      await apptsCol.add(payload);
    }
    document.getElementById('appt-form').reset();
  } catch (err) { console.error(err); alert('Erro salvar agendamento'); }
});

function bindApptsSnapshot() {
  apptsCol.orderBy('data').onSnapshot(snapshot => {
    apptsListEl.innerHTML = '';
    const events = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      const li = document.createElement('div');
      li.className = 'p-3 bg-white rounded flex justify-between items-center';
      li.innerHTML = `<div>
                        <div class="font-semibold">${d.clienteName} — ${d.produtoName}</div>
                        <div class="text-sm text-gray-500">${d.data} • Qtd: ${d.quantidade} • Rep: ${d.representanteName}</div>
                      </div>
                      <div class="space-x-2">
                        <button data-id="${doc.id}" class="edit-appt px-3 py-1 bg-yellow-400 rounded">Editar</button>
                        <button data-id="${doc.id}" class="del-appt px-3 py-1 bg-red-500 text-white rounded">Excluir</button>
                      </div>`;
      apptsListEl.appendChild(li);

      // calendar event
      events.push({ id: doc.id, title: `${d.clienteName} • ${d.produtoName} (${d.quantidade})`, start: d.data });
    });

    // bind actions
    document.querySelectorAll('.edit-appt').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const snap = await apptsCol.doc(id).get();
      const d = snap.data();
      document.getElementById('appt-client').value = d.clienteId;
      document.getElementById('appt-rep').value = d.representanteId;
      document.getElementById('appt-product').value = d.produtoId;
      document.getElementById('appt-qty').value = d.quantidade;
      document.getElementById('appt-date').value = d.data;
      editApptId = id;
      showPage('agendamentos-page');
    }));
    document.querySelectorAll('.del-appt').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Excluir agendamento?')) return;
      await apptsCol.doc(id).delete();
    }));

    // render calendar (recreate)
    renderCalendar(events);
  });
}

// -------------------------
// Calendar render (FullCalendar)
// -------------------------
let calendarInstance = null;
function renderCalendar(events) {
  const el = document.getElementById('calendar');
  el.innerHTML = '';
  if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; }
  calendarInstance = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    height: 550,
    events,
    eventClick: info => {
      const ev = info.event;
      alert(ev.title + '\nData: ' + ev.startStr);
    }
  });
  calendarInstance.render();
}

// -------------------------
// Charts (Chart.js) - reps & clients
// -------------------------
let chartReps = null, chartClients = null;
async function updateCharts() {
  const appts = (await apptsCol.get()).docs.map(d => d.data());
  const repsTotals = {}; const clientsTotals = {};
  appts.forEach(a => {
    repsTotals[a.representanteName] = (repsTotals[a.representanteName] || 0) + (a.quantidade || 0);
    clientsTotals[a.clienteName] = (clientsTotals[a.clienteName] || 0) + (a.quantidade || 0);
  });

  // reps
  const repsLabels = Object.keys(repsTotals);
  const repsValues = Object.values(repsTotals);
  const ctxR = document.getElementById('chart-reps').getContext('2d');
  if (chartReps) chartReps.destroy();
  chartReps = new Chart(ctxR, { type: 'bar', data: { labels: repsLabels, datasets: [{ label: 'Quantidade', data: repsValues }] } });

  // clients
  const clientsLabels = Object.keys(clientsTotals);
  const clientsValues = Object.values(clientsTotals);
  const ctxC = document.getElementById('chart-clients').getContext('2d');
  if (chartClients) chartClients.destroy();
  chartClients = new Chart(ctxC, { type: 'bar', data: { labels: clientsLabels, datasets: [{ label: 'Quantidade', data: clientsValues }] } });
}

// -------------------------
// Reports -> preview + PDF generation
// -------------------------
document.getElementById('preview-report').addEventListener('click', async () => {
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  const clientId = document.getElementById('report-client').value;
  const repId = document.getElementById('report-rep').value;

  let appts = (await apptsCol.get()).docs.map(d => ({ id: d.id, ...d.data() }));
  if (start) appts = appts.filter(a => a.data >= start);
  if (end) appts = appts.filter(a => a.data <= end);
  if (clientId) appts = appts.filter(a => a.clienteId === clientId);
  if (repId) appts = appts.filter(a => a.representanteId === repId);

  const container = document.getElementById('report-preview');
  if (!appts.length) { container.innerHTML = '<p class="text-gray-500">Nenhum agendamento encontrado.</p>'; return; }

  // build HTML table
  let html = '<table class="w-full table-auto"><thead><tr><th class="text-left">Data</th><th>Cliente</th><th>Rep</th><th>Produto</th><th>Qtd</th></tr></thead><tbody>';
  appts.forEach(a => { html += `<tr><td>${a.data}</td><td>${a.clienteName}</td><td>${a.representanteName}</td><td>${a.produtoName}</td><td>${a.quantidade}</td></tr>`; });
  html += '</tbody></table>';
  container.innerHTML = html;
});

document.getElementById('generate-pdf').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  const clientId = document.getElementById('report-client').value;
  const repId = document.getElementById('report-rep').value;

  let appts = (await apptsCol.get()).docs.map(d => ({ id: d.id, ...d.data() }));
  if (start) appts = appts.filter(a => a.data >= start);
  if (end) appts = appts.filter(a => a.data <= end);
  if (clientId) appts = appts.filter(a => a.clienteId === clientId);
  if (repId) appts = appts.filter(a => a.representanteId === repId);

  const totalsByProduct = {}; let totalGeral = 0;
  const rows = appts.map(a => {
    totalsByProduct[a.produtoName] = (totalsByProduct[a.produtoName] || 0) + (a.quantidade || 0);
    totalGeral += (a.quantidade || 0);
    return [a.data, a.clienteName, a.representanteName, a.produtoName, String(a.quantidade)];
  });

  try {
    const docPdf = new jsPDF('p','pt','a4');
    docPdf.setFontSize(14);
    docPdf.text('Relatório de Agendamentos', 40, 40);
    docPdf.setFontSize(10);
    docPdf.text(`Período: ${start||' - '} → ${end||' - '}`, 40, 60);
    docPdf.text(`Total Geral: ${totalGeral}`, 40, 75);

    docPdf.autoTable({ startY: 95, head: [['Data','Cliente','Representante','Produto','Qtd']], body: rows });

    let finalY = docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY + 20 : 95;
    docPdf.setFontSize(11);
    docPdf.text('Totais por produto:', 40, finalY);
    finalY += 14;
    Object.entries(totalsByProduct).forEach(([prod, q]) => {
      docPdf.text(`${prod}: ${q}`, 40, finalY); finalY += 12;
    });

    // pequenas imagens de gráfico (produtos)
    const tmp = document.createElement('canvas'); tmp.width = 600; tmp.height = 300;
    const tmpCtx = tmp.getContext('2d');
    new Chart(tmpCtx, {
      type: 'bar',
      data: { labels: Object.keys(totalsByProduct), datasets: [{ label: 'Qtd', data: Object.values(totalsByProduct) }] },
      options: { responsive: false, plugins: { legend: { display: false } } }
    });
    await new Promise(r => setTimeout(r, 600));
    const img = tmp.toDataURL('image/png');
    docPdf.addPage();
    docPdf.text('Gráfico - Totais por Produto', 40, 40);
    docPdf.addImage(img, 'PNG', 40, 60, 500, 250);

    docPdf.save(`relatorio_agendamentos_${Date.now()}.pdf`);
  } catch (err) {
    console.error('pdf err', err);
    alert('Erro ao gerar PDF: ' + (err.message||err));
  }
});

// -------------------------
// Init app data (subscribe to snapshots)
// -------------------------
async function initAppData() {
  // bind snapshot listeners
  bindClientsSnapshot();
  bindRepsSnapshot();
  bindProductsSnapshot();
  bindApptsSnapshot();

  // load selects & cards & charts
  await loadSelectOptions();
  await updateSummaryCards();
  await updateCharts();
}

// -------------------------
// Final small safety: ensure elements exist before using them
// -------------------------
(function safetyChecks() {
  // ensure required elements exist - log missing (helps debug)
  const required = ['login-btn','register-btn','logout-btn','client-save','client-file','rep-save','product-save','appt-form','generate-pdf'];
  required.forEach(id => { if (!document.getElementById(id)) console.warn('Missing element ID:', id); });
})();
