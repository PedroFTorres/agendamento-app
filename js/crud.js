// ======================= UTIL =========================
const pageContent = document.getElementById("page-content");

let REPRESENTANTE_ATUAL = null;
let PERFIL = null;
async function carregarUsuario() {
  const user = await waitForAuth();f

  const snap = await db.collection("usuarios")
    .where("uid", "==", user.uid)
    .limit(1)
    .get();

  if (!snap.empty) {
    const dados = snap.docs[0].data();

    REPRESENTANTE_ATUAL = dados.nome;
    PERFIL = dados.perfil;

    console.log("Perfil:", PERFIL);
    console.log("Nome:", REPRESENTANTE_ATUAL);

    // 👤 MOSTRAR NOME
    const el = document.getElementById("usuario-logado");
    if (el) {
      el.textContent = "👤 " + REPRESENTANTE_ATUAL;
    }

    // 🔒 CONTROLE DE MENU POR PERFIL
    document.querySelectorAll("#sidebar li").forEach(item => {
      const perfilItem = item.getAttribute("data-perfil");

      if (PERFIL === "representante") {
        if (perfilItem === "admin") {
          item.style.display = "none";
        }
      }
    });

  } else {
    alert("Usuário não cadastrado");
  }
}
carregarUsuario();

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
  return Math.floor(Number(num || 0)).toLocaleString("pt-BR");
}
function formatMoeda(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}
function formatPrecoProduto(num) {
  return Number(num || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4, maximumFractionDigits: 4
  });
}
function formatarDataISO(data) {
  if (!data) return null;

  // já está no formato correto
  if (data.includes("-") && data.length === 10) return data;

  // formato brasileiro (17/04/2026)
  if (data.includes("/")) {
    const [d, m, y] = data.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return data;
}
// ================== FORMULÁRIOS ==================
function formHTML(type) {
  if (type === "clientes") {
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="clientes-nome" class="border p-2 rounded" placeholder="Nome do cliente" required>
        <input id="clientes-whatsapp" class="border p-2 rounded" placeholder="WhatsApp (ex: 98991234567)">
        <input id="clientes-cnpj" class="border p-2 rounded" placeholder="CNPJ">
<input id="clientes-ie" class="border p-2 rounded" placeholder="Inscrição Estadual">
<input id="clientes-cep" class="border p-2 rounded" placeholder="CEP">
        
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
<input id="representantes-email" class="border p-2 rounded" placeholder="Email do representante" required>
<input id="representantes-senha" class="border p-2 rounded" placeholder="Senha inicial" required>
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
        <div class="text-sm text-gray-500">
          WhatsApp: ${data.whatsapp || "—"} • Vinculado a: ${data.vinculadoPor || "—"}
        </div>`;
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
      const id = e.currentTarget.getAttribute("data-id");
      const type = e.currentTarget.getAttribute("data-type");
      const a = e.currentTarget.getAttribute("data-a");

      // ================== EXCLUIR ==================
      if (a === "d") {
        if (!confirm("Excluir este registro?")) return;
        await db.collection(type).doc(id).delete();
      }

      // ================== EDITAR ==================
      if (a === "e") {
        const snap = await db.collection(type).doc(id).get();
        const d = snap.data() || {};

// ================== CLIENTES ==================
if (type === "clientes") {
 
  // --- Modal de CADASTRAR NOVO CLIENTE ---
  if (!id) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
        <h3 class="text-lg font-bold mb-2">Novo Cliente</h3>
        <div class="grid grid-cols-1 gap-3">
          <input id="novo-nome" class="border p-2 rounded" placeholder="Nome" required>
          <input id="novo-whats" class="border p-2 rounded" placeholder="WhatsApp">
        
            
        </div>
        <div class="flex justify-end space-x-3 mt-4">
          <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
          <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const $nome = modal.querySelector("#novo-nome");
    const $whats = modal.querySelector("#novo-whats");
    const $rep = modal.querySelector("#novo-rep");

   
    modal.querySelector("#btn-cancel").addEventListener("click", () => modal.remove());

    modal.querySelector("#btn-save").addEventListener("click", async () => {
      const nome = $nome.value.trim();
      const whatsapp = $whats.value.trim();
      
      const user = await waitForAuth();

      if (!nome) {
        alert("Informe o nome do cliente!");
        return;
      }

      await db.collection(type).add({
        userId: user.uid,
        nome,
        whatsapp,
        vinculadoPor: REPRESENTANTE_ATUAL,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      modal.remove();
    });
  }

  // --- Modal de EDITAR CLIENTE EXISTENTE ---
  if (id) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
        <h3 class="text-lg font-bold mb-2">Editar Cliente</h3>
        <div class="grid grid-cols-1 gap-3">
          <input id="edit-nome" class="border p-2 rounded" value="${d.nome || ""}" placeholder="Nome">

<input id="edit-whats" class="border p-2 rounded" value="${d.whatsapp || ""}" placeholder="WhatsApp">

<input id="edit-cnpj" class="border p-2 rounded" value="${d.cnpj || ""}" placeholder="CNPJ">

<input id="edit-ie" class="border p-2 rounded" value="${d.ie || ""}" placeholder="Inscrição Estadual">

<input id="edit-cep" class="border p-2 rounded" value="${d.cep || ""}" placeholder="CEP">
          ${PERFIL === "admin" ? `
<select id="edit-user" class="border p-2 rounded"></select>
` : ""}
          
           
        </div>
        <div class="flex justify-end space-x-3 mt-4">
          <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
          <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

// 👉 CRIA AS VARIÁVEIS AQUI
const cnpjInput = modal.querySelector("#edit-cnpj");
const cepInput = modal.querySelector("#edit-cep");
const ieInput = modal.querySelector("#edit-ie");

// 👉 AGORA SIM pode usar
cnpjInput?.addEventListener("input", (e) => {
  let v = e.target.value.replace(/\D/g, "");

  if (v.length <= 11) {
    v = v.replace(/^(\d{3})(\d)/, "$1.$2");
    v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }

  e.target.value = v;
});

// CEP
cepInput?.addEventListener("input", (e) => {
  let v = e.target.value.replace(/\D/g, "");
  v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  e.target.value = v;
});

// IE
ieInput?.addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "");
});

    const $nome = modal.querySelector("#edit-nome");
    const $whats = modal.querySelector("#edit-whats");
   let $user = null;

if (PERFIL === "admin") {
  $user = modal.querySelector("#edit-user");

  const usersSnap = await db.collection("usuarios").get();

  usersSnap.forEach(doc => {
    const u = doc.data();

    const opt = document.createElement("option");
    opt.value = u.uid;
    opt.textContent = u.nome + " (" + u.perfil + ")";

    if (u.uid === d.userId) opt.selected = true;

    $user.appendChild(opt);
  });
}


    modal.querySelector("#btn-cancel").addEventListener("click", () => modal.remove());

    modal.querySelector("#btn-save").addEventListener("click", async () => {
      const nome = $nome.value.trim();
const whatsapp = $whats.value.trim();
const cnpj = modal.querySelector("#edit-cnpj").value.trim();
const ie = modal.querySelector("#edit-ie").value.trim();
const cep = modal.querySelector("#edit-cep").value.trim();
      // 🔒 VALIDAÇÃO
if (PERFIL === "representante") {
  if (!nome || !whatsapp || !cnpj || !cep) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }
}
      

     const updateData = {
  nome,
  whatsapp,
  cnpj,
  ie,
  cep
};

if (PERFIL === "admin" && $user) {
  updateData.userId = $user.value;

  const userSnap = await db.collection("usuarios")
    .where("uid", "==", $user.value)
    .get();

  if (!userSnap.empty) {
    updateData.vinculadoPor = userSnap.docs[0].data().nome;
  }
}

await db.collection(type).doc(id).update(updateData);

      modal.remove();
    });
  }
}

        // -------- REPRESENTANTES --------
        if (type === "representantes") {
          const modal = document.createElement("div");
          modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
        modal.innerHTML = `
  <div class="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
    <h3 class="text-lg font-bold mb-2">Editar Representante</h3>

    <div class="grid grid-cols-1 gap-3">
      <input id="edit-nome" class="border p-2 rounded" value="${d.nome || ""}" placeholder="Nome">

      <input id="edit-email" class="border p-2 rounded" value="${d.email || ""}" placeholder="Email">

      <input id="edit-senha" class="border p-2 rounded" placeholder="Nova senha (opcional)">

      <input id="edit-whats" class="border p-2 rounded" value="${d.whatsapp || ""}" placeholder="WhatsApp">
    </div>

    <div class="flex justify-end space-x-3 mt-4">
      <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
      <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
    </div>
  </div>
`;
          document.body.appendChild(modal);

          modal.querySelector("#btn-cancel").addEventListener("click", () => modal.remove());

          modal.querySelector("#btn-save").addEventListener("click", async () => {
           const nome = modal.querySelector("#edit-nome").value.trim();
const email = modal.querySelector("#edit-email").value.trim();
const senha = modal.querySelector("#edit-senha").value.trim();
const whatsapp = modal.querySelector("#edit-whats").value.trim();

// 🔥 Atualiza Firestore
await db.collection(type).doc(id).update({ nome, email, whatsapp });

// 🔥 ATUALIZAR SENHA (se digitou)
if (senha) {
  try {
    const user = await firebase.auth().getUserByEmail(email);
    await firebase.auth().updateUser(user.uid, {
      password: senha
    });
  } catch (e) {
    console.error("Erro ao atualizar senha:", e);
    alert("Senha não foi atualizada (limitação do Firebase)");
  }
}

modal.remove();
            modal.remove();
          });
        }

        // -------- PRODUTOS --------
        if (type === "produtos") {
          const modal = document.createElement("div");
          modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
          modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
              <h3 class="text-lg font-bold mb-2">Editar Produto</h3>
              <div class="grid grid-cols-1 gap-3">
                <input id="edit-nome" class="border p-2 rounded" value="${d.nome || ""}" placeholder="Nome do Produto">
                <input id="edit-categoria" class="border p-2 rounded" value="${d.categoria || ""}" placeholder="Categoria">
                <input id="edit-preco" type="number" step="0.0001" class="border p-2 rounded" value="${d.preco || 0}" placeholder="Preço">
              </div>
              <div class="flex justify-end space-x-3 mt-4">
                <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
                <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);

          modal.querySelector("#btn-cancel").addEventListener("click", () => modal.remove());

          modal.querySelector("#btn-save").addEventListener("click", async () => {
            const nome = modal.querySelector("#edit-nome").value.trim();
            const categoria = modal.querySelector("#edit-categoria").value.trim();
           const valor = modal.querySelector("#edit-preco").value.replace(",", ".");
           const preco = valor ? parseFloat(valor) : d.preco;

            await db.collection(type).doc(id).update({ nome, categoria, preco });
            modal.remove();
          });
        }
      } // fecha if (a === "e")
    }); // fecha addEventListener
  });   // fecha forEach
}       // fecha bindBasicActions

// ================== RENDER FORM ==================
function renderForm(type) {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4 capitalize">${type}</h2>
    <form id="${type}-form" class="bg-white p-4 rounded shadow mb-4">
      ${formHTML(type)}
    </form>
    ${type === "clientes" ? `
      <input type="text" id="clientes-search" placeholder="Pesquisar cliente..." 
             class="border p-2 rounded w-full mb-4">
    ` : ""}
    <ul id="${type}-list" class="space-y-2"></ul>
  `;
  if (type === "clientes") {
  const searchInput = document.getElementById("clientes-search");
  searchInput.addEventListener("input", () => {
    const termo = searchInput.value.toLowerCase();
    const list = document.getElementById(`${type}-list`);
const items = list.querySelectorAll("li");
    items.forEach(li => {
      const txt = li.textContent.toLowerCase();
      li.style.display = txt.includes(termo) ? "" : "none";
    });
  });
}

  const form = document.getElementById(`${type}-form`);
if (type === "clientes") {

  const cnpjInput = document.getElementById("clientes-cnpj");
  const cepInput = document.getElementById("clientes-cep");
  const ieInput = document.getElementById("clientes-ie");

  // CNPJ/CPF
  cnpjInput?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");

    if (v.length <= 11) {
      v = v.replace(/^(\d{3})(\d)/, "$1.$2");
      v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1-$2");
    } else {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }

    e.target.value = v;
  });

  // CEP
  cepInput?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    e.target.value = v;
  });

  // IE
  ieInput?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });
}
  

  const list = document.getElementById(`${type}-list`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();
    const uid = user.uid;
    let payload = { userId: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

   if (type === "clientes") {
  payload.nome = document.getElementById("clientes-nome").value.trim();
  payload.whatsapp = document.getElementById("clientes-whatsapp").value.trim();
  let doc = document.getElementById("clientes-cnpj").value.replace(/\D/g, "");

if (doc.length !== 11 && doc.length !== 14) {
  alert("CPF ou CNPJ inválido");
  return;
}

payload.cnpj = doc;
  payload.ie = document.getElementById("clientes-ie").value.trim();
  payload.cep = document.getElementById("clientes-cep").value.trim();

  payload.vinculadoPor = REPRESENTANTE_ATUAL;
   
  // 🔒 VALIDAÇÃO (AQUI É O PONTO CERTO)
  if (PERFIL === "representante") {
  if (
    !payload.nome ||
    !payload.whatsapp ||
    !payload.cnpj ||
    !payload.cep
  ) {
    alert("Preencha os campos obrigatórios!");
    return;
  }
}

// 🔒 BLOQUEIO
if (type === "clientes") {
  const snap = await db.collection("clientes")
    .where("cnpj", "==", payload.cnpj)
    .where("userId", "==", uid)
    .get();

  if (!snap.empty) {
    alert("❌ Este cliente já está vinculado a outro usuário.");
    return;
  }
}
    }

if (type === "representantes") {
      payload.nome = document.getElementById("representantes-nome").value.trim();
const nome = document.getElementById("representantes-nome").value.trim();
const email = document.getElementById("representantes-email").value.trim();
const senha = document.getElementById("representantes-senha").value.trim();

payload.nome = nome;
payload.email = email;

// 🔥 CRIA LOGIN NO FIREBASE
const cred = await firebase.auth().createUserWithEmailAndPassword(email, senha);

// 🔥 PEGA UID GERADO
payload.uid = cred.user.uid;
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
  let query = db.collection(type);

if (PERFIL === "representante") {
  query = query.where("userId", "==", user.uid);
}

query
  .orderBy("createdAt", "desc")
  .onSnapshot(snap => {
        list.innerHTML = "";
        if (snap.empty) {
          list.innerHTML = `<li class="text-gray-500">Nenhum registro.</li>`;
          return;
        }
        snap.forEach(doc => list.appendChild(listItem(type, doc.id, doc.data())));
bindBasicActions(list);

// 🔥 aplicar filtro após renderizar
if (type === "clientes") {
  const termo = document.getElementById("clientes-search").value.toLowerCase();
  const items = list.querySelectorAll("li");

  items.forEach(li => {
    const txt = li.textContent.toLowerCase();
    li.style.display = txt.includes(termo) ? "" : "none";
  });
}
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
        <select id="ag-produto" class="border p-2 rounded w-full"></select>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="date" id="ag-data" class="border p-2 rounded w-full" required>
        <input type="number" id="ag-qtd" class="border p-2 rounded w-full" placeholder="Quantidade" required>
        <input type="text" id="ag-obs" class="border p-2 rounded w-full" placeholder="Observação (opcional)">
      </div>
      <button class="bg-blue-600 text-white p-2 rounded w-full mt-2">Salvar</button>
    </form>
    <div id="ag-list" class="space-y-4"></div>
  `;

  const $selCliente = document.getElementById("ag-cliente");
  const $selRep     = document.getElementById("ag-representante");
  const $selProd    = document.getElementById("ag-produto");
  const $form       = document.getElementById("agendamento-form");
  const $list       = document.getElementById("ag-list");

 async function loadOptions(coll, select, labelField = "nome") {
  const user = await waitForAuth();
  select.innerHTML = `<option value="">Selecione ${coll}</option>`;

 let query = db.collection(coll);

if (PERFIL === "representante") {
  query = query.where("userId", "==", user.uid);
}

const snap = await query.orderBy(labelField).get();
  snap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = d[labelField] || "(sem nome)";
    select.appendChild(opt);
  });
}
  loadOptions("clientes", $selCliente);
  
  loadOptions("produtos", $selProd);

  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = await waitForAuth();
    const clienteNome = $selCliente.selectedOptions[0]?.textContent || "";
    const repNome = REPRESENTANTE_ATUAL;
    const prodNome    = $selProd.selectedOptions[0]?.textContent || "";
    const data        = document.getElementById("ag-data").value;
    const quantidade  = parseInt(document.getElementById("ag-qtd").value);
    const observacao  = document.getElementById("ag-obs").value;

    await db.collection("agendamentos").add({
      userId: user.uid,
      clienteNome,
      representanteNome: REPRESENTANTE_ATUAL,
      criadoPor: user.uid,
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

 waitForAuth().then(user => {

  let query = db.collection("agendamentos");

if (PERFIL === "representante") {
  query = query.where("criadoPor", "==", user.uid);
}
  query
    .orderBy("data", "asc")
    .onSnapshot(snap => {
        (async () => {
          $list.innerHTML = "";

          if (snap.empty) {
            $list.innerHTML = `<p class="text-gray-500">Nenhum agendamento.</p>`;
            return;
          }

          // Agrupa por dia
          const agPorDia = {};
          snap.forEach(doc => {
            const d = doc.data();
            const dia = d.data || "";
            if (!agPorDia[dia]) agPorDia[dia] = [];
            agPorDia[dia].push({ id: doc.id, ...d });
          });

          const hoje = new Date().toISOString().split("T")[0];
          const diasOrdenados = Object.keys(agPorDia).sort((a, b) => {
            // Hoje e futuros primeiro, depois passados
            if (a < hoje && b >= hoje) return 1;
            if (a >= hoje && b < hoje) return -1;
            return a.localeCompare(b);
          });

          for (const dia of diasOrdenados) {
            // Cabeçalho colapsável
            const header = document.createElement("div");
            header.className = "px-3 py-2 rounded border-l-4 border-orange-500 bg-orange-50 text-orange-700 font-bold cursor-pointer";
            header.textContent = `${dataCurtaBR(dia)} - ${diaSemanaPT(dia)}`;

            const container = document.createElement("div");
            container.className = "ml-4 mt-2 hidden space-y-2";

            // ---- Resumo por produto (agendado) ----
            const totaisPorProd = {};
            agPorDia[dia].forEach(item => {
              totaisPorProd[item.produtoNome] = (totaisPorProd[item.produtoNome] || 0) + (item.quantidade || 0);
            });

            const resumoDia = document.createElement("div");
            resumoDia.className = "flex flex-wrap gap-3";
            const coresBg = ["bg-yellow-300","bg-green-300","bg-pink-300","bg-blue-300","bg-orange-300"];
            let corIndex = 0;
            Object.entries(totaisPorProd).forEach(([prod, qtd]) => {
              const span = document.createElement("span");
              span.className = `${coresBg[corIndex % coresBg.length]} px-2 py-1 rounded font-mono`;
              span.textContent = `${prod}: ${formatQuantidade(qtd)}`;
              resumoDia.appendChild(span);
              corIndex++;
            });
            container.appendChild(resumoDia);

            // ---- Disponibilidade por produto (Produzido - Agendado) ----
            // Busca a produção do dia inteiro uma vez só
            const prodDiaSnap = await db.collection("producao")
              .where("userId", "==", user.uid)
              .where("data", "==", dia)
              .get();

            const produzidoPorProd = {};
            prodDiaSnap.forEach(pdoc => {
              const p = pdoc.data();
              produzidoPorProd[p.produto] = (produzidoPorProd[p.produto] || 0) + (p.quantidade || 0);
            });

            const disponibilidadeDia = document.createElement("div");
            disponibilidadeDia.className = "mt-2 p-2 bg-green-50 border border-green-200 rounded";
            const tituloDisp = document.createElement("div");
            tituloDisp.className = "font-bold text-green-700 mb-1";
            tituloDisp.textContent = "Disponível:";
            disponibilidadeDia.appendChild(tituloDisp);

            Object.entries(totaisPorProd).forEach(([prod, qtdAgendado]) => {
              const produzido = produzidoPorProd[prod] || 0;
              const disponivel = produzido - (qtdAgendado || 0);
              const cor =
                disponivel > 0 ? "text-green-700" :
                disponivel === 0 ? "text-gray-700" : "text-red-700";

              const linha = document.createElement("div");
              linha.className = "text-sm";
              linha.innerHTML = `<span class="font-medium">${prod}</span> → <span class="${cor}">${formatQuantidade(disponivel)}</span>`;
              disponibilidadeDia.appendChild(linha);
            });

            container.appendChild(disponibilidadeDia);

            // ---- Lista de agendamentos do dia ----
            agPorDia[dia].forEach(item => {
              const li = document.createElement("div");
              li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
              li.innerHTML = `
                <div>
                  <div class="font-semibold">${item.clienteNome}</div>
                  <div class="text-sm text-gray-500">
                    Rep: ${item.representanteNome || "-"} • Prod: ${item.produtoNome || "-"} • Qtd: ${formatQuantidade(item.quantidade)}
                  </div>
                  ${item.observacao ? `<div class="text-sm font-bold text-red-600">Obs: ${item.observacao}</div>` : ""}
                </div>
                <div class="space-x-2">
                  <button data-id="${item.id}" class="bg-yellow-500 text-white px-2 py-1 rounded btn-edit">Editar</button>
                  <button data-id="${item.id}" class="bg-red-600 text-white px-2 py-1 rounded btn-del">Excluir</button>
                </div>
              `;
              container.appendChild(li);
            });

            // Toggle abre/fecha
            header.addEventListener("click", () => {
              container.classList.toggle("hidden");
            });

            $list.appendChild(header);
            $list.appendChild(container);

            // Botões de ação
            container.querySelectorAll(".btn-del").forEach(btn => {
              btn.addEventListener("click", async e => {
                if (confirm("Excluir este agendamento?")) {
                  await db.collection("agendamentos").doc(e.target.dataset.id).delete();
                }
              });
            });

            container.querySelectorAll(".btn-edit").forEach(btn => {
              btn.addEventListener("click", async e => {
                const id = e.target.dataset.id;
                const snap = await db.collection("agendamentos").doc(id).get();
                const d = snap.data();

                // Modal estilizado
                const modal = document.createElement("div");
                modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                modal.innerHTML = `
                  <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
                    <h3 class="text-lg font-bold mb-2">Editar Agendamento</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input id="edit-cliente" class="border p-2 rounded" value="${d.clienteNome || ""}" placeholder="Cliente">
                      <input id="edit-rep" class="border p-2 rounded" value="${d.representanteNome || ""}" placeholder="Representante">
                      <input id="edit-prod" class="border p-2 rounded" value="${d.produtoNome || ""}" placeholder="Produto">
                      <input id="edit-qtd" type="number" class="border p-2 rounded" value="${d.quantidade || 0}" placeholder="Quantidade">
                      <input id="edit-data" type="date" class="border p-2 rounded" value="${d.data || ""}">
                      <input id="edit-obs" class="border p-2 rounded col-span-2" value="${d.observacao || ""}" placeholder="Observação">
                    </div>
                    <div class="flex justify-end space-x-3 mt-4">
                      <button id="btn-cancel" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
                      <button id="btn-save" class="bg-green-600 text-white px-4 py-2 rounded">Salvar</button>
                    </div>
                  </div>
                `;
                document.body.appendChild(modal);

                modal.querySelector("#btn-cancel").addEventListener("click", () => modal.remove());

                modal.querySelector("#btn-save").addEventListener("click", async () => {
                  const clienteNome = modal.querySelector("#edit-cliente").value.trim();
                  const representanteNome = modal.querySelector("#edit-rep").value.trim();
                  const produtoNome = modal.querySelector("#edit-prod").value.trim();
                  const quantidade = parseInt(modal.querySelector("#edit-qtd").value) || 0;
                  const data = modal.querySelector("#edit-data").value;
                  const observacao = modal.querySelector("#edit-obs").value.trim();

                  await db.collection("agendamentos").doc(id).update({ 
                    clienteNome, representanteNome, produtoNome, quantidade, data, observacao 
                  });

                  modal.remove();
                });
              });
            });
          }
        })().catch(err => {
          console.error("Erro ao montar listagem de agendamentos:", err);
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
  <select id="rel-representante" class="border p-2 rounded w-full">
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
}

async function gerarRelatorio() {
  const user = await waitForAuth();
  const uid = user.uid;

  const start = document.getElementById("rel-start").value;
  const end   = document.getElementById("rel-end").value;
  const clienteSel = document.getElementById("rel-cliente").value;
 

 let query = db.collection("agendamentos");

if (PERFIL === "representante") {
  query = query.where("userId", "==", uid);
}
  if (start) query = query.where("data", ">=", start);
  if (end)   query = query.where("data", "<=", end);
  if (clienteSel) query = query.where("clienteNome", "==", clienteSel);

  const snap = await query.get();
  // 🔥 Buscar preços dos produtos
const produtosSnap = await db.collection("produtos")
  .where("userId", "==", uid)
  .get();

const mapaPrecos = {};
// 🔥 preços por cliente
const precosClientesSnap = await db.collection("precos_clientes")
  .where("userId", "==", uid)
  .get();

const mapaPrecosClientes = {};

precosClientesSnap.forEach(doc => {
  const p = doc.data();
  const chave = `${p.clienteNome}_${p.produtoNome}`;
  mapaPrecosClientes[chave] = p.preco;
});
produtosSnap.forEach(doc => {
  const p = doc.data();
  mapaPrecos[p.nome] = p.preco || 0;
});

  let totalGeral = 0;
  let faturamentoPrevisto = 0;
  const porProduto = {};
  const porRep = {};
  const porCli = {};
  const linhasTabela = [];

 snap.forEach(doc => {
  const d = doc.data();
  const qtd = d.quantidade || 0;

  totalGeral += qtd;

// 💰 preço inteligente
const precoPadrao = mapaPrecos[d.produtoNome] || 0;
const precoCliente = mapaPrecosClientes[`${d.clienteNome}_${d.produtoNome}`];

const precoFinal = precoCliente ?? precoPadrao;

const valorTotal = qtd * precoFinal;

faturamentoPrevisto += valorTotal;

    // Totais
    porProduto[d.produtoNome] = (porProduto[d.produtoNome] || 0) + qtd;
    porRep[d.representanteNome] = (porRep[d.representanteNome] || 0) + qtd;
    porCli[d.clienteNome] = (porCli[d.clienteNome] || 0) + qtd;

    linhasTabela.push({
  cliente: d.clienteNome || "-",
  produto: d.produtoNome || "-",
  representante: d.representanteNome || "-",
  qtd: qtd,
  data: d.data || "-",
  valorTotal: valorTotal // 🔥 NOVO
});
  });

  // Renderiza os totais na tela
 let html = `
  <p><strong>Total Geral:</strong> ${formatQuantidade(totalGeral)}</p>
  <p><strong>Previsão de Faturamento:</strong> ${formatMoeda(faturamentoPrevisto)}</p>
  <ul>
`;
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
  window.__REL_CACHE__ = { 
  start, 
  end, 
  linhasTabela, 
  totalGeral, 
  faturamentoPrevisto, // 👈 adicionar isso
  porProduto, 
  porRep 
};
}

// ================== EXPORTAR PDF ==================
async function exportarPDF() {
  if (!window.__REL_CACHE__) {
    alert("Nenhum relatório carregado para exportar.");
    return;
  }

  const { start, end, linhasTabela, totalGeral, faturamentoPrevisto, porProduto, porRep } = window.__REL_CACHE__;
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

    return currentY; // última linha usada
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
 // CABEÇALHO
doc.text("Cliente", 14, y);
doc.text("Produto", 60, y);
doc.text("Qtd", 120, y);
doc.text("Valor", 150, y); // 🔥 posição final

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

    // Produto
    doc.text(row.produto, 70, y, { maxWidth: 40 });

    // Quantidade e Data
    doc.text(formatQuantidade(row.qtd), 120, y, { align: "right" });
    doc.text(formatMoeda(row.valorTotal), 190, y, { align: "right" });
    
    // Ajusta Y para próxima linha
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
  y += 8;
doc.text(`PREVISÃO DE FATURAMENTO: ${formatMoeda(faturamentoPrevisto)}`, 14, y);

  y += 12;

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

  // Resetar cor para preto
  doc.setTextColor(0, 0, 0);

  // ===== Download =====
  doc.save("relatorio-agendamentos.pdf");
}

// ================== DASHBOARD COM FULLCALENDAR ==================
function renderDashboard() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Calendário de Agendamentos</h2>
   <div id="calendar" class="bg-white p-4 rounded shadow w-full overflow-x-auto"></div>
  `;

  waitForAuth().then(user => {
  let query = db.collection("agendamentos");

if (PERFIL === "representante") {
  query = query.where("criadoPor", "==", user.uid);
}

query.onSnapshot(snap => {
        // Paleta de cores para eventos
        const cores = [
          "#f87171", // vermelho
          "#60a5fa", // azul
          "#34d399", // verde
          "#fbbf24", // amarelo
          "#a78bfa", // roxo
          "#fb923c", // laranja
          "#14b8a6"  // turquesa
        ];
        let corIndex = 0;

        const eventos = snap.docs.map(doc => {
  const d = doc.data();
  const cor = cores[corIndex % cores.length];
  corIndex++;

  const nomeCliente = d.clienteNome
    ? d.clienteNome.split(" ")[0]
    : "Sem cliente";

  return {
    id: doc.id,
    title: `${nomeCliente} • ${d.produtoNome || ""} (${d.quantidade || 0})`,
    start: formatarDataISO(d.data),
    backgroundColor: cor,
    borderColor: cor,
    textColor: "#000",
    extendedProps: {
      representante: d.representanteNome,
      observacao: d.observacao
    }
  };
});
        window.agendamentos = snap.docs.map(doc => doc.data());

        // Resumo por dia → produtos e quantidades
        const resumoPorDia = {};
        snap.docs.forEach(doc => {
          const d = doc.data();
          const data = d.data;
          if (!resumoPorDia[data]) resumoPorDia[data] = {};
          resumoPorDia[data][d.produtoNome] =
            (resumoPorDia[data][d.produtoNome] || 0) + (d.quantidade || 0);
        });

        // Tooltip container
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip-custom";
        document.body.appendChild(tooltip);

       const calendarEl = document.getElementById("calendar");
if (!calendarEl) return;

calendarEl.innerHTML = "";

        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: "dayGridMonth",
          locale: "pt-br",
          // ✅ Registra o clique no dia do calendário
dateClick: function(info) {
  abrirResumoDoDia(info.dateStr);
},

          height: "auto",
          headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
          },
          events: eventos,

          // Tooltip customizado ao passar mouse no dia
          dayCellDidMount: function(info) {
            const dataISO = info.date.toISOString().split("T")[0];
            if (resumoPorDia[dataISO]) {
              const produtosDia = resumoPorDia[dataISO];
              const linhas = Object.entries(produtosDia)
                .map(([prod, qtd]) => `${prod}: ${qtd.toLocaleString("pt-BR")}`)
                .join("\n");

              info.el.addEventListener("mouseenter", e => {
                tooltip.textContent = linhas;
                tooltip.style.opacity = "1";
                tooltip.style.top = e.pageY + 10 + "px";
                tooltip.style.left = e.pageX + 10 + "px";
              });
              info.el.addEventListener("mousemove", e => {
                tooltip.style.top = e.pageY + 10 + "px";
                tooltip.style.left = e.pageX + 10 + "px";
              });
              info.el.addEventListener("mouseleave", () => {
                tooltip.style.opacity = "0";
              });
            }
          },

         eventClick: function(info) {
  abrirEdicaoAgendamento(info.event.id);
}
        });

        calendar.render();
      });
  });
}
async function abrirModalAgendamento(dataSelecionada) {
  const user = await waitForAuth();

  const clientesSnap = await db.collection("clientes").where("userId","==",user.uid).orderBy("nome").get();
  const produtosSnap = await db.collection("produtos").where("userId","==",user.uid).get();

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  modal.innerHTML = `
    <div class="bg-white p-6 rounded w-full max-w-md space-y-3">
      <h3 class="text-lg font-bold">Novo Agendamento</h3>

     <select id="m-cliente" class="border p-2 w-full"></select>
<select id="m-representante" class="border p-2 w-full"></select>
<select id="m-produto" class="border p-2 w-full"></select>
      <input id="m-qtd" type="number" class="border p-2 w-full" placeholder="Quantidade">
      
      <div class="flex justify-end space-x-2">
        <button id="cancelar" class="bg-gray-400 text-white px-3 py-1 rounded">Cancelar</button>
        <button id="salvar" class="bg-green-600 text-white px-3 py-1 rounded">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const selCliente = modal.querySelector("#m-cliente");
  const selProduto = modal.querySelector("#m-produto");
  

  clientesSnap.forEach(doc=>{
    const opt = document.createElement("option");
    opt.value = doc.data().nome;
    opt.textContent = doc.data().nome;
    selCliente.appendChild(opt);
  });

  produtosSnap.forEach(doc=>{
    const opt = document.createElement("option");
    opt.value = doc.data().nome;
    opt.textContent = doc.data().nome;
    selProduto.appendChild(opt);
  });

  modal.querySelector("#cancelar").onclick = ()=>modal.remove();

  modal.querySelector("#salvar").onclick = async ()=>{
    const cliente = selCliente.value;
    const produto = selProduto.value;
    const qtd = parseInt(modal.querySelector("#m-qtd").value);

   await db.collection("agendamentos").add({
  userId: user.uid,
  clienteNome: cliente,
  representanteNome: REPRESENTANTE_ATUAL,
  produtoNome: produto,
  quantidade: qtd,
  data: dataSelecionada,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
});

    modal.remove();
  };
}
async function abrirEdicaoAgendamento(id) {
  const user = await waitForAuth();

  const snap = await db.collection("agendamentos").doc(id).get();
  const d = snap.data();

  const clientesSnap = await db.collection("clientes")
    .where("userId","==",user.uid)
    .orderBy("nome")
    .get();

  const produtosSnap = await db.collection("produtos")
    .where("userId","==",user.uid)
    .get();

 

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  modal.innerHTML = `
    <div class="bg-white p-6 rounded w-full max-w-md space-y-3">
      <h3 class="text-lg font-bold">Editar Agendamento</h3>

      <select id="edit-cliente" class="border p-2 w-full"></select>
      <select id="edit-representante" class="border p-2 w-full"></select>
      <select id="edit-produto" class="border p-2 w-full"></select>

      <input id="edit-data" type="date" class="border p-2 w-full">
      <input id="edit-qtd" type="number" class="border p-2 w-full">

      <div class="flex justify-between">
        <button id="excluir" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button>
        <button id="salvar" class="bg-green-600 text-white px-3 py-1 rounded">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const selCliente = modal.querySelector("#edit-cliente");
  const selProduto = modal.querySelector("#edit-produto");
  

  // CLIENTES
  clientesSnap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.data().nome;
    opt.textContent = doc.data().nome;
    if (doc.data().nome === d.clienteNome) opt.selected = true;
    selCliente.appendChild(opt);
  });

  

  // PRODUTOS
  produtosSnap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.data().nome;
    opt.textContent = doc.data().nome;
    if (doc.data().nome === d.produtoNome) opt.selected = true;
    selProduto.appendChild(opt);
  });

  // Preenche outros campos
  modal.querySelector("#edit-qtd").value = d.quantidade || 0;
  modal.querySelector("#edit-data").value = d.data || "";

  // SALVAR
  modal.querySelector("#salvar").onclick = async () => {
    await db.collection("agendamentos").doc(id).update({
      clienteNome: selCliente.value,
      representanteNome: REPRESENTANTE_ATUAL,
      produtoNome: selProduto.value,
      quantidade: parseInt(modal.querySelector("#edit-qtd").value) || 0,
      data: modal.querySelector("#edit-data").value
    });

    modal.remove();
  };

  // EXCLUIR
  modal.querySelector("#excluir").onclick = async () => {
    if (confirm("Excluir agendamento?")) {
      await db.collection("agendamentos").doc(id).delete();
      modal.remove();
    }
  };
}
async function abrirResumoDoDia(dataSelecionada) {
  const user = await waitForAuth();

 let query = db.collection("agendamentos")
  .where("data", "==", dataSelecionada);

if (PERFIL === "representante") {
  query = query.where("criadoPor", "==", user.uid);
}

const snap = await query.get();

  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};

  const lista = [];

  snap.forEach(doc => {
    const d = doc.data();
    const qtd = d.quantidade || 0;

    totalGeral += qtd;

    // Produto
    porProduto[d.produtoNome] = (porProduto[d.produtoNome] || 0) + qtd;

    // Representante
    porRep[d.representanteNome || "Sem rep"] =
      (porRep[d.representanteNome || "Sem rep"] || 0) + qtd;

    lista.push(d);
  });

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  modal.innerHTML = `
    <div class="bg-white p-6 rounded w-full max-w-3xl space-y-4 max-h-[90vh] overflow-auto">
      <h3 class="text-lg font-bold">Resumo do dia ${dataSelecionada}</h3>

      <div class="bg-blue-50 border border-blue-200 p-4 rounded text-center">
  <div class="text-sm text-gray-600">Total Geral</div>
  <div class="text-2xl font-bold text-blue-700">
    ${totalGeral.toLocaleString("pt-BR")}
  </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="bg-gray-50 p-3 rounded">
  <h4 class="font-bold mb-2">Por Produto</h4>
  ${Object.entries(porProduto).map(([prod, qtd]) => `
    <div class="flex justify-between border-b py-1">
      <span>${prod}</span>
      <strong>${qtd.toLocaleString("pt-BR")}</strong>
    </div>
  `).join("")}
</div>
          ${Object.entries(porProduto).map(([prod, qtd]) => `
            <div>${prod}: ${qtd.toLocaleString("pt-BR")}</div>
          `).join("")}
        </div>

        <div>
         <div class="bg-gray-50 p-3 rounded">
  <h4 class="font-bold mb-2">Por Representante</h4>
  ${Object.entries(porRep).map(([rep, qtd]) => `
    <div class="flex justify-between border-b py-1">
      <span>${rep}</span>
      <strong>${qtd.toLocaleString("pt-BR")}</strong>
    </div>
  `).join("")}
</div>
          ${Object.entries(porRep).map(([rep, qtd]) => `
            <div>${rep}: ${qtd.toLocaleString("pt-BR")}</div>
          `).join("")}
        </div>
      </div>

      <div>
        <h4 class="font-bold">Agendamentos:</h4>
    ${lista.map((item, i) => `
  <div class="py-2 px-2 ${i % 2 === 0 ? 'bg-gray-100' : 'bg-white'} rounded">
    <div class="font-medium">
      ${item.clienteNome}
    </div>
    <div class="text-sm text-gray-600">
      ${item.produtoNome} • ${item.quantidade.toLocaleString("pt-BR")}
    </div>
    <div class="text-xs text-gray-500">
      Rep: ${item.representanteNome || "-"}
    </div>
  </div>
`).join("")}
          
      </div>

      <div class="flex justify-between mt-4">
        <button id="novo" class="bg-green-600 text-white px-3 py-1 rounded">
          + Novo Agendamento
        </button>

        <div class="space-x-2">
          <button id="imprimir" class="bg-blue-600 text-white px-3 py-1 rounded">
            Imprimir
          </button>
          <button id="fechar" class="bg-gray-400 text-white px-3 py-1 rounded">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // FECHAR
  modal.querySelector("#fechar").onclick = () => modal.remove();

  // NOVO AGENDAMENTO
  modal.querySelector("#novo").onclick = () => {
    modal.remove();
    abrirModalAgendamento(dataSelecionada);
  };

  // IMPRIMIR
  modal.querySelector("#imprimir").onclick = () => {
    const w = window.open("", "", "width=800,height=600");
    w.document.write(`
      <html>
        <head>
          <title>Resumo ${dataSelecionada}</title>
        </head>
        <body>
          ${modal.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };
}
// ================== MENU ==================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;

   if (page === "agendamentos") renderAgendamentos();
    else if (page === "pedidos") renderPedidos();
    else if (page === "relatorios") renderRelatorios();
    else if (page === "dashboard") renderDashboard();
    else if (page === "producao") renderProducao();
    else if (page === "recibo") renderRecibo();
    else if (page === "whatsapp") renderWhatsapp();
    else renderForm(page);

    // 👇 ISSO AQUI QUE RESOLVE SEU PROBLEMA
    const menu = document.getElementById("sidebar");
    if (window.innerWidth < 768) {
      menu.classList.add("-translate-x-full");
    }
  });
});

function renderPrecosClientes() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Preços por Cliente</h2>

    <form id="form-preco" class="bg-white p-4 rounded shadow space-y-3">
      <select id="pc-cliente" class="border p-2 w-full"></select>
      <select id="pc-produto" class="border p-2 w-full"></select>
      <input id="pc-preco" type="number" step="0.0001" class="border p-2 w-full" placeholder="Preço">

      <button class="bg-blue-600 text-white p-2 rounded w-full">Salvar</button>
    </form>

    <ul id="pc-list" class="mt-4 space-y-2"></ul>
  `;

  const $cliente = document.getElementById("pc-cliente");
  const $produto = document.getElementById("pc-produto");
  const $form = document.getElementById("form-preco");
  const $list = document.getElementById("pc-list");

  // carregar clientes
  waitForAuth().then(user => {
   db.collection("clientes")
  .where("userId","==",user.uid)
  .get()
  .then(snap=>{
    $cliente.innerHTML = `<option value="">Selecione cliente</option>`;

    const lista = [];

    snap.forEach(doc=>{
      lista.push(doc.data());
    });

    // 🔥 ordena no JS (garantido)
    lista.sort((a,b)=> a.nome.localeCompare(b.nome, 'pt-BR'));

    lista.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d.nome;
      opt.textContent = d.nome;
      $cliente.appendChild(opt);
    });
  });
    db.collection("produtos")
      .where("userId","==",user.uid)
      .get()
      .then(snap=>{
        $produto.innerHTML = `<option value="">Selecione produto</option>`;
        snap.forEach(doc=>{
          const opt = document.createElement("option");
          opt.value = doc.data().nome;
          opt.textContent = doc.data().nome;
          $produto.appendChild(opt);
        });
      });
  });

  // salvar preço
  $form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const user = await waitForAuth();

    const cliente = $cliente.value;
    const produto = $produto.value;
    const valorInput = document.getElementById("pc-preco").value.replace(",", ".");
const preco = parseFloat(valorInput);

    if (!cliente || !produto || isNaN(preco)) {
      alert("Preencha tudo!");
      return;
    }

    await db.collection("precos_clientes").add({
      userId: user.uid,
      clienteNome: cliente,
      produtoNome: produto,
      preco,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $form.reset();
  });

 waitForAuth().then(user=>{
  let query = db.collection("precos_clientes");

if (PERFIL === "representante") {
  query = query.where("userId","==",user.uid);
}

query.onSnapshot(snap=>{
      $list.innerHTML = "";

      $list.innerHTML = "";

const mapa = {};

snap.forEach(doc=>{
  const d = doc.data();

  if (!mapa[d.clienteNome]) {
    mapa[d.clienteNome] = [];
  }

  mapa[d.clienteNome].push({
    id: doc.id,
    produto: d.produtoNome,
    preco: d.preco
  });
});

// 🔥 render agrupado por cliente
Object.entries(mapa).forEach(([cliente, itens])=>{

  const box = document.createElement("div");
  box.className = "bg-white p-3 rounded shadow";

  let html = `<div class="font-bold mb-2">${cliente}</div>`;

  itens.forEach(item=>{
  html += `
    <div class="flex justify-between items-center border-b py-1">
      
      <span>${item.produto}</span>

      <div class="flex gap-2 items-center">
        <span>${formatMoeda(item.preco)}</span>

        <button data-id="${item.id}" class="bg-yellow-500 text-white px-2 py-1 rounded btn-edit">
          Editar
        </button>

        <button data-id="${item.id}" class="bg-red-600 text-white px-2 py-1 rounded btn-del">
          Excluir
        </button>
      </div>

    </div>
  `;
});

  box.innerHTML = html;
  $list.appendChild(box);
});
        
      });
    });

  $list.addEventListener("click", async e=>{

  const id = e.target.dataset.id;
  if (!id) return;

  // EXCLUIR
  if (e.target.classList.contains("btn-del")) {
    if (confirm("Excluir?")) {
      await db.collection("precos_clientes").doc(id).delete();
    }
  }

 if (e.target.classList.contains("btn-edit")) {
  let novoPreco = prompt("Novo preço (ex: 0,700):");

  if (novoPreco) {
    novoPreco = novoPreco.replace(",", ".");
  }

  if (novoPreco && !isNaN(parseFloat(novoPreco))) {
    await db.collection("precos_clientes").doc(id).update({
      preco: parseFloat(novoPreco)
    });
  }
}

});
}

function renderPedidos() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Pedidos</h2>

    ${PERFIL === "representante" ? `
    <div class="bg-white p-4 rounded shadow mb-4 space-y-2">
      <select id="p-cliente" class="border p-2 w-full"></select>
      <select id="p-produto" class="border p-2 w-full"></select>
      <input id="p-qtd" type="number" class="border p-2 w-full" placeholder="Quantidade">
      <button id="btn-pedido" class="bg-blue-600 text-white p-2 rounded w-full">
        Enviar Pedido
      </button>
    </div>
    ` : ""}

    <!-- 🔥 CONTROLE DE MÊS -->
    <div class="flex items-center justify-between mb-3">
      <button id="mes-anterior" class="px-3 py-1 bg-gray-200 rounded">←</button>
      <span id="mes-atual" class="font-bold"></span>
      <button id="mes-proximo" class="px-3 py-1 bg-gray-200 rounded">→</button>
    </div>

    <div id="lista-pedidos" class="space-y-2"></div>
  `;

  const $cliente = document.getElementById("p-cliente");
  const $produto = document.getElementById("p-produto");
  const lista = document.getElementById("lista-pedidos");

  // 🔥 CONTROLE DE DATA
  let dataAtual = new Date();

  const mesAtualEl = document.getElementById("mes-atual");
  const btnAnt = document.getElementById("mes-anterior");
  const btnProx = document.getElementById("mes-proximo");

  function formatarMes(data) {
    return data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    });
  }

  btnAnt.onclick = () => {
    dataAtual.setMonth(dataAtual.getMonth() - 1);
    renderPedidos();
  };

  btnProx.onclick = () => {
    dataAtual.setMonth(dataAtual.getMonth() + 1);
    renderPedidos();
  };

  waitForAuth().then(async user => {

    // CLIENTES
    let cliQuery = db.collection("clientes");
    if (PERFIL === "representante") {
      cliQuery = cliQuery.where("userId", "==", user.uid);
    }

    const cliSnap = await cliQuery.orderBy("nome").get();
    cliSnap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().nome;
      opt.textContent = doc.data().nome;
      $cliente?.appendChild(opt);
    });

    // PRODUTOS
    const prodSnap = await db.collection("produtos").get();
    prodSnap.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.data().nome;
      opt.textContent = doc.data().nome;
      $produto?.appendChild(opt);
    });

  });

  // CRIAR PEDIDO
  document.getElementById("btn-pedido")?.addEventListener("click", async () => {
    const user = await waitForAuth();

    const cliente = document.getElementById("p-cliente").value;
    const produto = document.getElementById("p-produto").value;
    const quantidade = parseInt(document.getElementById("p-qtd").value);

    if (!cliente || !produto || !quantidade) {
      alert("Preencha tudo!");
      return;
    }

    await db.collection("pedidos").add({
      userId: user.uid,
      clienteNome: cliente,
      produtoNome: produto,
      quantidade,
      representanteNome: REPRESENTANTE_ATUAL,
      status: "pendente",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Pedido enviado!");
  });

  waitForAuth().then(async user => {

    if (!PERFIL) {
      await carregarUsuario();
    }

    let query = db.collection("pedidos");

    if (PERFIL === "representante") {
      query = query.where("userId", "==", user.uid);
    }

    query.orderBy("createdAt", "desc")
      .onSnapshot(snap => {

        lista.innerHTML = "";

        if (snap.empty) {
          lista.innerHTML = `<p class="text-gray-500">Nenhum pedido.</p>`;
          return;
        }

        const pedidosPorMes = {};

        snap.forEach(doc => {
          const p = doc.data();
          const data = p.createdAt?.toDate?.() || new Date();

          const mes = data.toLocaleString("pt-BR", { month: "long", year: "numeric" });

          if (!pedidosPorMes[mes]) pedidosPorMes[mes] = [];
          pedidosPorMes[mes].push({ id: doc.id, ...p });
        });

        const mesSelecionado = formatarMes(dataAtual);
        mesAtualEl.textContent = mesSelecionado;

        Object.entries(pedidosPorMes).forEach(([mes, pedidos]) => {

          if (mes !== mesSelecionado) return;

          const header = document.createElement("div");
          header.className = "bg-gray-200 p-2 rounded font-bold";
          header.textContent = mes;

          const container = document.createElement("div");
          container.className = "space-y-2 mt-2";

          pedidos.forEach(p => {

            const corStatus =
              p.status === "pendente" ? "orange" :
              p.status === "aprovado" ? "green" :
              "red";

            const item = document.createElement("div");
            item.className = "bg-white p-3 rounded shadow";

          item.innerHTML = `
  <b>${p.clienteNome}</b> - ${p.produtoNome} (${p.quantidade})<br>

  <div style="font-size:12px; color:#555;">
    Representante: ${p.representanteNome || "não informado"}
  </div>

  <span style="color:${corStatus}; font-weight:bold">
    ${p.status}
  </span>

  ${PERFIL === "admin" && p.status === "pendente" ? `
    <div class="mt-2 space-x-2">
      <button data-id="${p.id}" class="btn-aprovar bg-green-600 text-white px-2 py-1 rounded">
        Aprovar
      </button>
      <button data-id="${p.id}" class="btn-cancelar bg-red-600 text-white px-2 py-1 rounded">
        Cancelar
      </button>
    </div>
  ` : ""}
`;
const btnAprovar = item.querySelector(".btn-aprovar");
const btnCancelar = item.querySelector(".btn-cancelar");

if (btnAprovar) {
  btnAprovar.addEventListener("click", async (e) => {
    aprovarPedido(p.id, e.target);
  });
}

if (btnCancelar) {
  btnCancelar.addEventListener("click", async (e) => {
    cancelarPedido(p.id, e.target);
  });
}
            container.appendChild(item);
          });
      

          lista.appendChild(header);
          lista.appendChild(container);
        });

      });

  });
}
