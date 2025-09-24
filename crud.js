
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

// ================== NOVA FUNÇÃO ==================
async function carregarSelect(collection, selectId, uid) {
  const snap = await db.collection(collection).where("userId", "==", uid).get();
  const sel = document.getElementById(selectId);
  sel.innerHTML = `<option value="">Selecione ${collection}</option>`;
  snap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = d.nome;
    opt.textContent = d.nome;
    sel.appendChild(opt);
  });
}

// ================== AGENDAMENTOS ==================
function renderAgendamentos() {
  pageContent.innerHTML = \`
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
  \`;

  let editId = null;

  waitForAuth().then(user => {
    carregarSelect("clientes", "ag-cliente", user.uid);
    carregarSelect("representantes", "ag-rep", user.uid);
    carregarSelect("produtos", "ag-prod", user.uid);

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
      } else {
        await db.collection("agendamentos").add(data);
      }
      e.target.reset();
    });

    db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .orderBy("data", "desc")
      .onSnapshot(snap => {
        const lista = document.getElementById("lista-agendamentos");
        lista.innerHTML = "";
        const grupos = {};
        snap.forEach(doc => {
          const d = doc.data();
          if (!grupos[d.data]) grupos[d.data] = [];
          grupos[d.data].push({ id: doc.id, ...d });
        });
        Object.keys(grupos).sort((a, b) => b.localeCompare(a)).forEach(dataStr => {
          const bloco = document.createElement("div");
          bloco.className = "bg-white rounded shadow p-3";
          const header = document.createElement("h3");
          header.className = "font-semibold text-lg mb-2";
          header.textContent = dataStr;
          bloco.appendChild(header);
          const ul = document.createElement("ul");
          ul.className = "space-y-2";
          grupos[dataStr].forEach(item => {
            const li = document.createElement("li");
            li.className = "p-2 bg-gray-50 rounded flex justify-between items-center";
            li.innerHTML = \`
              <div>
                <div class="font-bold">\${item.clienteNome}</div>
                <div class="text-sm text-gray-500">
                  Rep: \${item.representanteNome} • Prod: \${item.produtoNome} • Qtd: \${formatQuantidade(item.quantidade)}
                </div>
              </div>
              <div class="space-x-2">
                <button class="btn-editar bg-yellow-500 text-white px-2 py-1 rounded" data-id="\${item.id}">Editar</button>
                <button class="btn-excluir bg-red-600 text-white px-2 py-1 rounded" data-id="\${item.id}">Excluir</button>
              </div>
            \`;
            ul.appendChild(li);
          });
          bloco.appendChild(ul);
          lista.appendChild(bloco);
        });
        document.querySelectorAll(".btn-excluir").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (confirm("Excluir este agendamento?")) {
              await db.collection("agendamentos").doc(btn.dataset.id).delete();
            }
          });
        });
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
          });
        });
      });
  });
}
