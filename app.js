// app.js - Sistema completo: login, CRUD, agendamentos, import XLSX, relatórios, gráficos
// Compat Firebase v8 (carregado via <script> no index.html)
// Requer: Chart.js, jsPDF (umd) e XLSX (SheetJS) carregados no HTML.

// ---------- Configuração Firebase (use sua config real) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAza98u8-NVn9hNbuLwcsaCZX2hXbtVaHk",
  authDomain: "meu-app-de-login.firebaseapp.com",
  projectId: "meu-app-de-login",
  storageBucket: "meu-app-de-login.firebasestorage.app",
  messagingSenderId: "61119567504",
  appId: "1:61119567504:web:556bb893c9eba6c4e12a15",
  measurementId: "G-YY6QTZX57K"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- Utility: get element safely ----------
function $id(id) {
  return document.getElementById(id);
}

// Ensure code runs after DOM loaded
document.addEventListener("DOMContentLoaded", () => {

  // ---------- Sections & UI elements ----------
  const loginSection = $id("login-section");
  const appSection = $id("app-section");
  const usuarioLogado = $id("usuario-logado");

  // Login inputs/buttons
  const loginEmail = $id("login-email");
  const loginSenha = $id("login-senha");
  const loginBtn = $id("login-btn");
  const registerBtn = $id("register-btn");
  const logoutBtn = $id("logout-btn");

  // CLIENTES UI
  const clienteNome = $id("cliente-nome");
  const clienteWhats = $id("cliente-whatsapp");
  const salvarClienteBtn = $id("salvar-cliente");
  const listaClientes = $id("lista-clientes");
  const uploadExcel = $id("upload-excel");
  const importarClientesBtn = $id("importar-clientes");

  // REPRESENTANTES UI
  const repNome = $id("rep-nome");
  const salvarRepBtn = $id("salvar-rep");
  const listaReps = $id("lista-rep");

  // PRODUTOS UI
  const prodNome = $id("produto-nome");
  const prodPreco = $id("produto-preco");
  const salvarProdBtn = $id("salvar-produto");
  const listaProds = $id("lista-produtos");

  // AGENDAMENTOS UI
  const agendaData = $id("agenda-data");
  const agendaCliente = $id("agenda-cliente");
  const agendaRep = $id("agenda-rep");
  const agendaProd = $id("agenda-produto");
  const agendaQtd = $id("agenda-quantidade");
  const salvarAgendaBtn = $id("salvar-agenda");
  const listaAgenda = $id("lista-agenda");

  // DASHBOARD elements (counts + charts)
  const countClientesEl = $id("count-clientes");
  const countRepsEl = $id("count-rep");
  const countProdsEl = $id("count-produtos");
  const countAgendEl = $id("count-agenda");
  const graficoRepEl = $id("grafico-rep");
  const graficoCliEl = $id("grafico-cli");

  // RELATÓRIOS UI
  const filtroInicio = $id("filtro-inicio");
  const filtroFim = $id("filtro-fim");
  const filtroCliente = $id("filtro-cliente");
  const filtroRep = $id("filtro-rep");
  const filtroProduto = $id("filtro-produto");
  const aplicarFiltrosBtn = $id("aplicar-filtros");
  const gerarPdfBtn = $id("gerar-pdf");
  const listaRelatorios = $id("lista-relatorios");
  const graficoRelatoriosEl = $id("grafico-relatorios");

  // Basic checks
  if (!loginBtn || !registerBtn || !logoutBtn) {
    console.warn("Elementos de autenticação ausentes. Verifique IDs no HTML.");
  }

  // ---------- Estado local ----------
  let editClientId = null;
  let editRepId = null;
  let editProdId = null;
  let editApptId = null;

  // Chart instances
  let chartReps = null;
  let chartClients = null;
  let chartReport = null;

  // ---------- Firebase collection refs ----------
  const clientsCol = db.collection("clientes");
  const repsCol = db.collection("representantes");
  const productsCol = db.collection("produtos");
  const apptsCol = db.collection("agendamentos");

  // ---------- AUTH: Login / Register / Logout ----------
  if (loginBtn) loginBtn.addEventListener("click", async () => {
    try {
      const email = loginEmail.value.trim();
      const pass = loginSenha.value;
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      alert("Erro no login: " + (err.message || err));
      console.error(err);
    }
  });

  if (registerBtn) registerBtn.addEventListener("click", async () => {
    try {
      const email = loginEmail.value.trim();
      const pass = loginSenha.value;
      await auth.createUserWithEmailAndPassword(email, pass);
      alert("Conta criada com sucesso.");
    } catch (err) {
      alert("Erro ao registrar: " + (err.message || err));
      console.error(err);
    }
  });

  if (logoutBtn) logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
  });

  // onAuthStateChanged -> controla visibilidade e inicializa listeners
  auth.onAuthStateChanged(user => {
    if (user) {
      if (loginSection) loginSection.classList.add("hidden");
      if (appSection) appSection.classList.remove("hidden");
      if (usuarioLogado) usuarioLogado.textContent = user.email || "-";
      // inicializar dados e listeners
      initApp();
    } else {
      if (loginSection) loginSection.classList.remove("hidden");
      if (appSection) appSection.classList.add("hidden");
      if (usuarioLogado) usuarioLogado.textContent = "-";
    }
  });

  // ---------- Inicialização: inscrever snapshots e carregar selects ----------
  async function initApp() {
    try {
      bindClientsSnapshot();
      bindRepsSnapshot();
      bindProductsSnapshot();
      bindApptsSnapshot();
      await updateSummaryCards();
      await updateCharts();
      await populateFiltersSelects();
    } catch (err) {
      console.error("Erro initApp:", err);
    }
  }

  // ---------- SUMMARY CARDS ----------
  async function updateSummaryCards() {
    try {
      const [cSnap, rSnap, pSnap, aSnap] = await Promise.all([
        clientsCol.get(), repsCol.get(), productsCol.get(), apptsCol.get()
      ]);
      if (countClientesEl) countClientesEl.textContent = cSnap.size;
      if (countRepsEl) countRepsEl.textContent = rSnap.size;
      if (countProdsEl) countProdsEl.textContent = pSnap.size;
      if (countAgendEl) countAgendEl.textContent = aSnap.size;
    } catch (err) {
      console.error("Erro updateSummary:", err);
    }
  }

  // ---------- CLIENTS CRUD ----------
  if (salvarClienteBtn) {
    salvarClienteBtn.addEventListener("click", async () => {
      try {
        const nome = (clienteNome && clienteNome.value.trim()) || "";
        const whatsapp = (clienteWhats && clienteWhats.value.trim()) || "";
        if (!nome) return alert("Nome do cliente é obrigatório.");
        if (editClientId) {
          await clientsCol.doc(editClientId).update({ nome, whatsapp });
          editClientId = null;
          salvarClienteBtn.textContent = "Salvar";
        } else {
          await clientsCol.add({ nome, whatsapp });
        }
        if (clienteNome) clienteNome.value = "";
        if (clienteWhats) clienteWhats.value = "";
      } catch (err) {
        console.error("Erro salvar cliente:", err);
        alert("Erro ao salvar cliente.");
      }
    });
  }

  function bindClientsSnapshot() {
    clientsCol.orderBy("nome").onSnapshot(snapshot => {
      try {
        if (!listaClientes) return;
        listaClientes.innerHTML = "";
        snapshot.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("div");
          li.className = "p-2 border-b flex justify-between items-center";
          li.innerHTML = `
            <div>
              <div class="font-semibold">${escapeHtml(d.nome)}</div>
              <div class="text-sm text-gray-500">${escapeHtml(d.whatsapp || "")}</div>
            </div>
            <div class="space-x-2">
              <button data-id="${doc.id}" class="btn-edit-client px-2 py-1 bg-yellow-400 rounded">Editar</button>
              <button data-id="${doc.id}" class="btn-del-client px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
            </div>
          `;
          listaClientes.appendChild(li);
        });

        // attach handlers
        document.querySelectorAll(".btn-edit-client").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.dataset.id;
            const snap = await clientsCol.doc(id).get();
            const data = snap.data();
            if (clienteNome) clienteNome.value = data.nome || "";
            if (clienteWhats) clienteWhats.value = data.whatsapp || "";
            editClientId = id;
            if (salvarClienteBtn) salvarClienteBtn.textContent = "Atualizar";
            // show clients section
            showSectionSafe("clientes");
          });
        });
        document.querySelectorAll(".btn-del-client").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!confirm("Excluir cliente?")) return;
            try {
              await clientsCol.doc(id).delete();
            } catch (err) { console.error(err); alert("Erro ao excluir cliente."); }
          });
        });

      } catch (err) { console.error("bindClientsSnapshot error:", err); }
    });
  }

  // ---------- IMPORTAR CLIENTES via XLSX ----------
  if (importarClientesBtn) {
    importarClientesBtn.addEventListener("click", () => {
      const fileInput = uploadExcel;
      if (!fileInput || !fileInput.files || !fileInput.files[0]) return alert("Selecione um arquivo .xlsx");
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);
          let imported = 0;
          for (const row of rows) {
            const nome = row.Nome || row.nome || row.Name;
            let whats = row.WhatsApp || row.whatsapp || row["Whats App"] || "";
            if (!nome) continue;
            // remove leading '55' or '+' country code if present
            whats = String(whats).replace(/^\+?55/, "").trim();
            await clientsCol.add({ nome: String(nome), whatsapp: whats });
            imported++;
          }
          alert(`Importados ${imported} clientes.`);
          fileInput.value = "";
        } catch (err) {
          console.error("Erro importar XLSX:", err);
          alert("Erro ao importar planilha: " + (err.message || err));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ---------- REPRESENTANTES CRUD ----------
  if (salvarRepBtn) {
    salvarRepBtn.addEventListener("click", async () => {
      try {
        const nome = (repNome && repNome.value.trim()) || "";
        if (!nome) return alert("Nome do representante é obrigatório.");
        if (editRepId) {
          await repsCol.doc(editRepId).update({ nome });
          editRepId = null;
          salvarRepBtn.textContent = "Salvar";
        } else {
          await repsCol.add({ nome });
        }
        if (repNome) repNome.value = "";
      } catch (err) {
        console.error("Erro salvar rep:", err); alert("Erro ao salvar representante.");
      }
    });
  }

  function bindRepsSnapshot() {
    repsCol.orderBy("nome").onSnapshot(snapshot => {
      try {
        if (!listaReps) return;
        listaReps.innerHTML = "";
        snapshot.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("div");
          li.className = "p-2 border-b flex justify-between items-center";
          li.innerHTML = `
            <div class="font-semibold">${escapeHtml(d.nome)}</div>
            <div class="space-x-2">
              <button data-id="${doc.id}" class="btn-edit-rep px-2 py-1 bg-yellow-400 rounded">Editar</button>
              <button data-id="${doc.id}" class="btn-del-rep px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
            </div>
          `;
          listaReps.appendChild(li);
        });

        document.querySelectorAll(".btn-edit-rep").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          const snap = await repsCol.doc(id).get();
          repNome.value = snap.data().nome || "";
          editRepId = id;
          salvarRepBtn.textContent = "Atualizar";
          showSectionSafe("representantes");
        }));
        document.querySelectorAll(".btn-del-rep").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm("Excluir representante?")) return;
          await repsCol.doc(id).delete();
        }));

      } catch (err) { console.error("bindRepsSnapshot:", err); }
    });
  }

  // ---------- PRODUCTS CRUD ----------
  if (salvarProdBtn) {
    salvarProdBtn.addEventListener("click", async () => {
      try {
        const nome = (prodNome && prodNome.value.trim()) || "";
        const preco = parseFloat((prodPreco && prodPreco.value) || 0) || 0;
        if (!nome) return alert("Nome do produto é obrigatório.");
        if (editProdId) {
          await productsCol.doc(editProdId).update({ nome, preco });
          editProdId = null;
          salvarProdBtn.textContent = "Salvar";
        } else {
          await productsCol.add({ nome, preco });
        }
        if (prodNome) prodNome.value = "";
        if (prodPreco) prodPreco.value = "";
      } catch (err) { console.error("Erro salvar produto:", err); alert("Erro ao salvar produto."); }
    });
  }

  function bindProductsSnapshot() {
    productsCol.orderBy("nome").onSnapshot(snapshot => {
      try {
        if (!listaProds) return;
        listaProds.innerHTML = "";
        snapshot.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("div");
          li.className = "p-2 border-b flex justify-between items-center";
          li.innerHTML = `
            <div>
              <div class="font-semibold">${escapeHtml(d.nome)}</div>
              <div class="text-sm text-gray-500">R$ ${Number(d.preco || 0).toFixed(4)}</div>
            </div>
            <div class="space-x-2">
              <button data-id="${doc.id}" class="btn-edit-prod px-2 py-1 bg-yellow-400 rounded">Editar</button>
              <button data-id="${doc.id}" class="btn-del-prod px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
            </div>
          `;
          listaProds.appendChild(li);
        });

        document.querySelectorAll(".btn-edit-prod").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          const snap = await productsCol.doc(id).get();
          const d = snap.data();
          prodNome.value = d.nome || "";
          prodPreco.value = d.preco || "";
          editProdId = id;
          salvarProdBtn.textContent = "Atualizar";
          showSectionSafe("produtos");
        }));
        document.querySelectorAll(".btn-del-prod").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm("Excluir produto?")) return;
          await productsCol.doc(id).delete();
        }));

      } catch (err) { console.error("bindProductsSnapshot:", err); }
    });
  }

  // ---------- APPOINTMENTS (Agendamentos) CRUD ----------
  if (salvarAgendaBtn) {
    salvarAgendaBtn.addEventListener("click", async () => {
      try {
        const data = (agendaData && agendaData.value) || "";
        const cliente = (agendaCliente && agendaCliente.value.trim()) || "";
        const representante = (agendaRep && agendaRep.value.trim()) || "";
        const produto = (agendaProd && agendaProd.value.trim()) || "";
        const quantidade = parseInt((agendaQtd && agendaQtd.value) || 0, 10) || 0;
        if (!data || !cliente || !representante || !produto) return alert("Preencha todos os campos do agendamento.");

        const payload = {
          data, cliente, representante, produto, quantidade, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (editApptId) {
          await apptsCol.doc(editApptId).update(payload);
          editApptId = null;
          salvarAgendaBtn.textContent = "Salvar";
        } else {
          await apptsCol.add(payload);
        }

        if (agendaData) agendaData.value = "";
        if (agendaCliente) agendaCliente.value = "";
        if (agendaRep) agendaRep.value = "";
        if (agendaProd) agendaProd.value = "";
        if (agendaQtd) agendaQtd.value = "";

      } catch (err) { console.error("Erro salvar agendamento:", err); alert("Erro ao salvar agendamento."); }
    });
  }

  function bindApptsSnapshot() {
    apptsCol.orderBy("data").onSnapshot(snapshot => {
      try {
        if (!listaAgenda) return;
        listaAgenda.innerHTML = "";
        snapshot.forEach(doc => {
          const d = doc.data();
          const li = document.createElement("div");
          li.className = "p-2 border-b flex justify-between items-center";
          li.innerHTML = `
            <div>
              <div class="font-semibold">${escapeHtml(d.cliente)} — ${escapeHtml(d.produto)}</div>
              <div class="text-sm text-gray-500">${escapeHtml(d.data)} • Qtd: ${d.quantidade || 0} • Rep: ${escapeHtml(d.representante)}</div>
            </div>
            <div class="space-x-2">
              <button data-id="${doc.id}" class="btn-edit-appt px-2 py-1 bg-yellow-400 rounded">Editar</button>
              <button data-id="${doc.id}" class="btn-del-appt px-2 py-1 bg-red-500 text-white rounded">Excluir</button>
            </div>
          `;
          listaAgenda.appendChild(li);
        });

        document.querySelectorAll(".btn-edit-appt").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          const snap = await apptsCol.doc(id).get();
          const d = snap.data();
          if (agendaData) agendaData.value = d.data || "";
          if (agendaCliente) agendaCliente.value = d.cliente || "";
          if (agendaRep) agendaRep.value = d.representante || "";
          if (agendaProd) agendaProd.value = d.produto || "";
          if (agendaQtd) agendaQtd.value = d.quantidade || 0;
          editApptId = id;
          salvarAgendaBtn.textContent = "Atualizar";
          showSectionSafe("agendamentos");
        }));
        document.querySelectorAll(".btn-del-appt").forEach(btn => btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm("Excluir agendamento?")) return;
          await apptsCol.doc(id).delete();
        }));

        // update summary & charts when appointments change
        updateSummaryCards();
        updateCharts();

      } catch (err) { console.error("bindApptsSnapshot:", err); }
    });
  }

  // ---------- POPULATE SELECTS / FILTER INPUTS ----------
  async function populateFiltersSelects() {
    try {
      // For simplicity, filters are text inputs in this layout; we will provide datalists or placeholders
      // Optionally, you can populate <select> if you change UI to use selects.
      // We'll populate HTML datalist-like behavior via simple autocomplete arrays (not mandatory).
      // For now, update counts and charts
      await updateSummaryCards();
      await updateCharts();
    } catch (err) { console.error(err); }
  }

  // ---------- CHARTS: Dashboard & Reports ----------
  async function updateCharts() {
    try {
      // Build totals from appointments
      const snaps = await apptsCol.get();
      const totalsByRep = {};
      const totalsByClient = {};
      snaps.forEach(doc => {
        const d = doc.data();
        const rep = d.representante || "—";
        const cli = d.cliente || "—";
        const qtd = parseInt(d.quantidade || 0, 10) || 0;
        totalsByRep[rep] = (totalsByRep[rep] || 0) + qtd;
        totalsByClient[cli] = (totalsByClient[cli] || 0) + qtd;
      });

      // Reps chart
      const repLabels = Object.keys(totalsByRep);
      const repValues = Object.values(totalsByRep);
      if (graficoRepEl) {
        const ctx = graficoRepEl.getContext("2d");
        if (chartReps) chartReps.destroy();
        chartReps = new Chart(ctx, {
          type: "bar",
          data: {
            labels: repLabels,
            datasets: [{ label: "Quantidade", data: repValues }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // Clients chart
      const cliLabels = Object.keys(totalsByClient);
      const cliValues = Object.values(totalsByClient);
      if (graficoCliEl) {
        const ctx2 = graficoCliEl.getContext("2d");
        if (chartClients) chartClients.destroy();
        chartClients = new Chart(ctx2, {
          type: "bar",
          data: { labels: cliLabels, datasets: [{ label: "Quantidade", data: cliValues }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

    } catch (err) { console.error("Erro updateCharts:", err); }
  }

  // ---------- RELATÓRIOS: Filtrar e gerar PDF ----------
  if (aplicarFiltrosBtn) {
    aplicarFiltrosBtn.addEventListener("click", async () => {
      try {
        let appts = (await apptsCol.get()).docs.map(d => ({ id: d.id, ...d.data() }));
        const start = filtroInicio && filtroInicio.value;
        const end = filtroFim && filtroFim.value;
        const cli = filtroCliente && filtroCliente.value.trim();
        const rep = filtroRep && filtroRep.value.trim();
        const prod = filtroProduto && filtroProduto.value.trim();

        if (start) appts = appts.filter(a => a.data >= start);
        if (end) appts = appts.filter(a => a.data <= end);
        if (cli) appts = appts.filter(a => String(a.cliente).toLowerCase().includes(cli.toLowerCase()));
        if (rep) appts = appts.filter(a => String(a.representante).toLowerCase().includes(rep.toLowerCase()));
        if (prod) appts = appts.filter(a => String(a.produto).toLowerCase().includes(prod.toLowerCase()));

        renderReportPreview(appts);
      } catch (err) { console.error("Erro aplicar filtros:", err); alert("Erro ao aplicar filtros."); }
    });
  }

  function renderReportPreview(appts) {
    try {
      if (!listaRelatorios) return;
      listaRelatorios.innerHTML = "";
      if (!appts || !appts.length) {
        listaRelatorios.innerHTML = "<li>Nenhum resultado</li>";
        if (graficoRelatoriosEl && chartReport) { chartReport.destroy(); chartReport = null; }
        return;
      }
      // Show list
      appts.forEach(a => {
        const li = document.createElement("li");
        li.className = "p-2 border-b";
        li.textContent = `${a.data} — ${a.cliente} — ${a.representante} — ${a.produto} — Qtd: ${a.quantidade || 0}`;
        listaRelatorios.appendChild(li);
      });

      // Chart: totals by product (example)
      const totalsByProd = {};
      appts.forEach(a => { totalsByProd[a.produto] = (totalsByProd[a.produto] || 0) + (parseInt(a.quantidade || 0, 10) || 0); });

      if (graficoRelatoriosEl) {
        const ctx = graficoRelatoriosEl.getContext("2d");
        if (chartReport) chartReport.destroy();
        chartReport = new Chart(ctx, {
          type: "bar",
          data: { labels: Object.keys(totalsByProd), datasets: [{ label: "Quantidade", data: Object.values(totalsByProd) }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

    } catch (err) { console.error("Erro renderReportPreview:", err); }
  }

  if (gerarPdfBtn) {
    gerarPdfBtn.addEventListener("click", async () => {
      try {
        // get filtered items from preview if any, else all
        let appts = (await apptsCol.get()).docs.map(d => ({ id: d.id, ...d.data() }));
        const start = filtroInicio && filtroInicio.value;
        const end = filtroFim && filtroFim.value;
        const cli = filtroCliente && filtroCliente.value.trim();
        const rep = filtroRep && filtroRep.value.trim();
        const prod = filtroProduto && filtroProduto.value.trim();

        if (start) appts = appts.filter(a => a.data >= start);
        if (end) appts = appts.filter(a => a.data <= end);
        if (cli) appts = appts.filter(a => String(a.cliente).toLowerCase().includes(cli.toLowerCase()));
        if (rep) appts = appts.filter(a => String(a.representante).toLowerCase().includes(rep.toLowerCase()));
        if (prod) appts = appts.filter(a => String(a.produto).toLowerCase().includes(prod.toLowerCase()));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        doc.setFontSize(12);
        doc.text("Relatório de Agendamentos", 40, 40);
        doc.setFontSize(10);
        let y = 60;
        doc.text(`Período: ${start || "-"} até ${end || "-"}`, 40, y); y += 18;

        // header
        doc.setFontSize(10);
        doc.text("Data", 40, y);
        doc.text("Cliente", 120, y);
        doc.text("Rep", 260, y);
        doc.text("Produto", 380, y);
        doc.text("Qtd", 500, y);
        y += 12;
        doc.setLineWidth(0.5);
        doc.line(40, y, 560, y);
        y += 12;

        // rows (paginate)
        const lineHeight = 14;
        for (const a of appts) {
          if (y > 750) { doc.addPage(); y = 40; }
          doc.text(String(a.data || ""), 40, y);
          doc.text(String(a.cliente || ""), 120, y);
          doc.text(String(a.representante || ""), 260, y);
          doc.text(String(a.produto || ""), 380, y);
          doc.text(String(a.quantidade || "0"), 500, y);
          y += lineHeight;
        }

        // totals by product
        const totalsByProd = {};
        let totalGeral = 0;
        appts.forEach(a => { totalsByProd[a.produto] = (totalsByProd[a.produto] || 0) + (parseInt(a.quantidade || 0, 10) || 0); totalGeral += (parseInt(a.quantidade || 0, 10) || 0); });

        if (y + 40 > 750) { doc.addPage(); y = 40; }
        y += 10;
        doc.text("Totais por produto:", 40, y); y += 14;
        Object.entries(totalsByProd).forEach(([prod, q]) => {
          if (y > 750) { doc.addPage(); y = 40; }
          doc.text(`${prod}: ${q}`, 40, y);
          y += 12;
        });
        if (y > 750) { doc.addPage(); y = 40; }
        doc.text(`Total geral: ${totalGeral}`, 40, y + 10);

        doc.save(`relatorio_agendamentos_${Date.now()}.pdf`);

      } catch (err) {
        console.error("Erro gerar PDF:", err);
        alert("Erro ao gerar PDF: " + (err.message || err));
      }
    });
  }

  // ---------- Bind snapshots for all collections ----------
  function bindRepsSnapshot() { /* implemented earlier */ }
  function bindProductsSnapshot() { /* implemented earlier */ }
  function bindApptsSnapshot() { /* implemented earlier */ }
  // Because we declared these earlier as functions, re-use them (they are already defined).

  // Ensure the named functions exist in scope (they are declared above)
  // If any were hoisted as consts, they're already defined.

  // ---------- Utility helpers ----------
  function showSectionSafe(sectionId) {
    // show section by id only if present
    const el = $id(sectionId);
    if (!el) return console.warn("showSectionSafe: elemento não encontrado", sectionId);
    // hide all main sections
    document.querySelectorAll("main section").forEach(s => s.classList.add("hidden"));
    el.classList.remove("hidden");
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/[&<>"']/g, (s) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[s]);
  }

  // Safety: if some snapshots functions were not hoisted, attach them now
  // (they are defined above with function names — ensure available)
  if (typeof bindRepsSnapshot !== "function") {
    // fallback simple implementation
    window.bindRepsSnapshot = function() { repsCol.orderBy("nome").onSnapshot(() => { /* no-op */ }); };
  }
  if (typeof bindProductsSnapshot !== "function") {
    window.bindProductsSnapshot = function() { productsCol.orderBy("nome").onSnapshot(() => { /* no-op */ }); };
  }
  if (typeof bindApptsSnapshot !== "function") {
    window.bindApptsSnapshot = function() { apptsCol.orderBy("data").onSnapshot(() => { /* no-op */ }); };
  }

  // Safety: ensure initial binding (if auth already signed in)
  if (auth.currentUser) {
    initApp().catch(err => console.error(err));
  }

}); // DOMContentLoaded end

// ---------------- END OF FILE ----------------
