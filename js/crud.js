// ======================= UTIL =========================
const pageContent = document.getElementById("page-content");
document.getElementById("sidebar").style.display = "none";

let REPRESENTANTE_ATUAL = null;
let PERFIL = null;

// 🔒 REGRA DE OURO - CLIENTES FILTRADOS
async function getClientesFiltrados() {
  const user = await waitForAuth();

  let query = db.collection("clientes");

  // 👉 REPRESENTANTE só vê os dele
  if (PERFIL === "representante") {
    query = query.where("userId", "==", user.uid);
  }

  // 👉 ADMIN vê todos (sem filtro)
  return await query.get();
}
async function carregarUsuario() {
  const user = await waitForAuth();

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
    document.getElementById("sidebar").style.display = "block";

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

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizarDocumento(valor) {
  return String(valor || "").replace(/\D/g, "");
}

async function encontrarClienteDuplicado({ cnpj, nome, userId, ignoreId = null }) {
  const cnpjNormalizado = normalizarDocumento(cnpj);
  const nomeNormalizado = normalizarTexto(nome);
  if (!cnpjNormalizado && !nomeNormalizado) return null;

  const snap = await db.collection("clientes").get();
  let duplicado = null;

  snap.forEach(doc => {
    if (duplicado) return;
    if (ignoreId && doc.id === ignoreId) return;

    const data = doc.data() || {};
    const cnpjDoc = normalizarDocumento(data.cnpj);
    const nomeDoc = normalizarTexto(data.nome);

    const cnpjIgual = cnpjNormalizado && cnpjDoc && cnpjDoc === cnpjNormalizado;
    const nomeIgual = nomeNormalizado && nomeDoc && nomeDoc === nomeNormalizado;

    if (cnpjIgual || (!cnpjNormalizado && nomeIgual)) {
      duplicado = { id: doc.id, ...data };
    }
  });

  
  if (duplicado && userId && duplicado.userId === userId) {
    return { ...duplicado, mesmoRepresentante: true };
  }

  return duplicado;
}


function toast(msg) {
  try { alert(msg); } catch (_) { console.log(msg); }
}

async function criarUsuarioAuthSemTrocarSessao(email, senha) {
  const appNome = "cadastro-usuarios";
  let appSecundario = null;

  for (let i = 0; i < firebase.apps.length; i++) {
    if (firebase.apps[i].name === appNome) {
      appSecundario = firebase.apps[i];
      break;
    }
  }

  if (!appSecundario) {
    appSecundario = firebase.initializeApp(firebase.app().options, appNome);
  }

  const authSecundario = appSecundario.auth();
  const cred = await authSecundario.createUserWithEmailAndPassword(email, senha);
  await authSecundario.signOut();
  return cred.user.uid;
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

function formatarCodigoPedido(numero) {
  return "PED-" + String(numero).padStart(4, "0");
}

function extrairNumeroPedido(codigo) {
  const match = String(codigo || "").match(/PED-(\d+)/i);
  return match ? Number(match[1]) : 0;
}

async function buscarMaiorNumeroPedido() {
  try {
    const snap = await db.collection("pedidos")
      .orderBy("codigo", "desc")
      .limit(100)
      .get();

    let maior = 0;
    snap.forEach(doc => {
      maior = Math.max(maior, extrairNumeroPedido(doc.data()?.codigo));
    });

    return maior;
  } catch (e) {
    console.warn("Não foi possível consultar o maior número de pedido existente.", e);
    return 0;
  }
}

async function gerarCodigoPedidoUnico() {
  const agora = new Date();
  const dois = (valor) => String(valor).padStart(2, "0");
  const tres = (valor) => String(valor).padStart(3, "0");
  const data = `${agora.getFullYear()}${dois(agora.getMonth() + 1)}${dois(agora.getDate())}`;
  const hora = `${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`;
  const aleatorio = String(Math.floor(Math.random() * 100)).padStart(2, "0");

  return `PED-${data}-${hora}${tres(agora.getMilliseconds())}-${aleatorio}`;
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
   if (PERFIL === "representante") {
      return `
        <button id="btn-abrir-modal-cliente" type="button" class="w-full md:w-auto text-white p-2 rounded" style="background-color: #E67E22;">+ Novo Cliente</button>

        <div id="modal-cliente" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-0 md:p-4">
          <div class="bg-white w-full md:max-w-2xl md:mx-auto md:mt-12 rounded-t-2xl md:rounded-xl p-4 md:p-6 max-h-[92vh] overflow-y-auto absolute bottom-0 left-0 right-0 md:static">
            <h3 class="text-lg font-bold mb-3">Cadastrar Cliente</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input id="m-clientes-nome" class="border p-2 rounded" placeholder="Nome do cliente">
              <input id="m-clientes-whatsapp" class="border p-2 rounded" placeholder="WhatsApp (ex: 98991234567)">
              <input id="m-clientes-cnpj" class="border p-2 rounded" placeholder="CNPJ ou CPF">
              <input id="m-clientes-ie" class="border p-2 rounded" placeholder="Inscrição Estadual">
              <input id="m-clientes-cep" class="border p-2 rounded md:col-span-2" placeholder="CEP">
               <p id="m-clientes-cep-help" class="text-xs text-gray-500 md:col-span-2"></p>
              <input id="m-clientes-endereco" class="border p-2 rounded md:col-span-2 bg-gray-100" placeholder="Endereço (logradouro)" readonly>
              <input id="m-clientes-numero" class="border p-2 rounded" placeholder="Número">
              <input id="m-clientes-bairro" class="border p-2 rounded bg-gray-100" placeholder="Bairro" readonly>
              <input id="m-clientes-cidade" class="border p-2 rounded bg-gray-100" placeholder="Cidade" readonly>
              <input id="m-clientes-uf" class="border p-2 rounded bg-gray-100" placeholder="UF" maxlength="2" readonly>
              <input id="m-clientes-complemento" class="border p-2 rounded md:col-span-2 bg-gray-100" placeholder="Complemento (opcional)" readonly>
            </div>
            <div class="flex flex-col-reverse md:flex-row justify-end gap-2 mt-4">
              <button id="btn-cancelar-modal-cliente" type="button" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
              <button id="btn-salvar-modal-cliente" type="button" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar Cliente</button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <label class="block text-sm font-medium mb-1">Importar Clientes de Planilha (.xlsx)</label>
          <input type="file" id="import-clientes" accept=".xlsx" class="border p-2 rounded w-full">
        </div>
      `;
    }
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
  
  if (type === "usuarios") {
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input id="usuarios-nome" class="border p-2 rounded" placeholder="Nome do usuário" required>
        <input id="usuarios-email" type="email" class="border p-2 rounded" placeholder="Email" required>
        <input id="usuarios-senha" type="password" class="border p-2 rounded" placeholder="Senha inicial" required>
        <select id="usuarios-perfil" class="border p-2 rounded" required>
          <option value="representante">Representante</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button class="bg-blue-600 text-white p-2 rounded mt-3">Cadastrar usuário</button>
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
function bindModalNovoClienteRepresentante() {
  if (PERFIL !== "representante") return;

  const modal = document.getElementById("modal-cliente");
  const abrir = document.getElementById("btn-abrir-modal-cliente");
  const cancelar = document.getElementById("btn-cancelar-modal-cliente");
  const salvar = document.getElementById("btn-salvar-modal-cliente");

  const mCnpj = document.getElementById("m-clientes-cnpj");
  const mCep = document.getElementById("m-clientes-cep");
  const mIe = document.getElementById("m-clientes-ie");
   const mCepHelp = document.getElementById("m-clientes-cep-help");
  const mEndereco = document.getElementById("m-clientes-endereco");
  const mNumero = document.getElementById("m-clientes-numero");
  const mBairro = document.getElementById("m-clientes-bairro");
  const mCidade = document.getElementById("m-clientes-cidade");
  const mUf = document.getElementById("m-clientes-uf");
  const mComplemento = document.getElementById("m-clientes-complemento");
  let cepExigeEnderecoManual = false;

  const camposEndereco = [mEndereco, mBairro, mCidade, mUf, mComplemento];
  const limparEndereco = () => {
    [mEndereco, mNumero, mBairro, mCidade, mUf, mComplemento].forEach(el => {
      if (el) el.value = "";
    });
  };
  const setMensagemCep = (msg, cor = "text-gray-500") => {
    if (!mCepHelp) return;
    mCepHelp.className = `text-xs md:col-span-2 ${cor}`;
    mCepHelp.textContent = msg;
  };
  const setEnderecoManual = (manual) => {
    camposEndereco.forEach(el => {
      if (!el) return;
      el.readOnly = !manual;
      el.classList.toggle("bg-gray-100", !manual);
    });
  };

  mCnpj?.addEventListener("input", (e) => {
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
  mCep?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    e.target.value = v.replace(/^(\d{5})(\d)/, "$1-$2");
    if (v.length < 8) {
      cepExigeEnderecoManual = false;
      limparEndereco();
      setEnderecoManual(false);
      setMensagemCep("");
    }
  });
  mIe?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });
   mUf?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
  });

  mCep?.addEventListener("blur", async () => {
    const cepLimpo = (mCep?.value || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    try {
      setMensagemCep("Buscando endereço pelo CEP...");
      setEnderecoManual(false);
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dados = await resp.json();

      if (!resp.ok || dados.erro) {
        cepExigeEnderecoManual = true;
        limparEndereco();
        setEnderecoManual(true);
        setMensagemCep("CEP não encontrado. Preencha o endereço manualmente.", "text-yellow-600");
        return;
      }

      mEndereco.value = dados.logradouro || "";
      mBairro.value = dados.bairro || "";
      mCidade.value = dados.localidade || "";
      mUf.value = (dados.uf || "").toUpperCase();
      mComplemento.value = dados.complemento || "";

      if (!dados.logradouro) {
        cepExigeEnderecoManual = true;
        setEnderecoManual(true);
        setMensagemCep("CEP geral detectado. Complete o endereço manualmente.", "text-yellow-600");
      } else {
        cepExigeEnderecoManual = false;
        setEnderecoManual(false);
        setMensagemCep("Endereço carregado automaticamente pelo CEP.", "text-green-600");
      }
    } catch (err) {
      console.error("Erro ao consultar CEP:", err);
      cepExigeEnderecoManual = true;
      setEnderecoManual(true);
      setMensagemCep("Não foi possível consultar o CEP agora. Preencha manualmente.", "text-yellow-600");
    }
  });

  abrir?.addEventListener("click", () => modal?.classList.remove("hidden"));
 cancelar?.addEventListener("click", () => {
    modal?.classList.add("hidden");
    cepExigeEnderecoManual = false;
    setMensagemCep("");
    limparEndereco();
    setEnderecoManual(false);
  });
  salvar?.addEventListener("click", async () => {
    const user = await waitForAuth();
    const payload = {
      userId: user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      nome: document.getElementById("m-clientes-nome").value.trim(),
      whatsapp: document.getElementById("m-clientes-whatsapp").value.trim(),
      cnpj: normalizarDocumento(document.getElementById("m-clientes-cnpj").value),
      ie: document.getElementById("m-clientes-ie").value.trim(),
      cep: document.getElementById("m-clientes-cep").value.trim(),
      endereco: document.getElementById("m-clientes-endereco").value.trim(), 
      numero: document.getElementById("m-clientes-numero").value.trim(),
      bairro: document.getElementById("m-clientes-bairro").value.trim(),
      cidade: document.getElementById("m-clientes-cidade").value.trim(),
      uf: document.getElementById("m-clientes-uf").value.trim().toUpperCase(),
      complemento: document.getElementById("m-clientes-complemento").value.trim(),
      vinculadoPor: REPRESENTANTE_ATUAL,
    };

    if (!payload.nome || !payload.whatsapp || !payload.cnpj || !payload.cep) {
      alert("Preencha os campos obrigatórios!");
      return;
    }
     if (!payload.numero) {
      alert("Informe o número do endereço.");
      return;
    }
    if (cepExigeEnderecoManual && (!payload.endereco || !payload.bairro || !payload.cidade || !payload.uf)) {
      alert("Este CEP é geral. Preencha endereço, bairro, cidade e UF manualmente.");
      return;
    }
    if (payload.cnpj.length !== 11 && payload.cnpj.length !== 14) {
      alert("CPF ou CNPJ inválido");
      return;
    }

    const clienteDuplicado = await encontrarClienteDuplicado({
      cnpj: payload.cnpj,
      nome: payload.nome,
      userId: user.uid
    });

    if (clienteDuplicado) {
      const msg = clienteDuplicado.mesmoRepresentante
        ? "❌ Já existe um cliente com este CPF/CNPJ para este representante."
        : "❌ Este cliente já está vinculado a outro representante e não pode ser cadastrado novamente.";
      alert(msg);
      return;
    }

    await db.collection("clientes").add(payload);
    toast("Cliente salvo com sucesso!");
    modal?.classList.add("hidden");
    cepExigeEnderecoManual = false;
    setMensagemCep("");
    ["m-clientes-nome", "m-clientes-whatsapp", "m-clientes-cnpj", "m-clientes-ie", "m-clientes-cep"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    limparEndereco();
    setEnderecoManual(false);
  });
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
    } else if (type === "usuarios") {
    main = `<div class="font-semibold">${data.nome || "—"}</div>
        <div class="text-sm text-gray-500">
          ${data.email || "—"} • Perfil: ${data.perfil || "—"}
        </div>`;
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
const cnpj = normalizarDocumento(modal.querySelector("#edit-cnpj").value);
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
     const userIdDestino = (PERFIL === "admin" && $user) ? $user.value : d.userId;
const clienteDuplicado = await encontrarClienteDuplicado({
  cnpj,
  nome,
  userId: userIdDestino,
  ignoreId: id
});

if (clienteDuplicado) {
  const msg = clienteDuplicado.mesmoRepresentante
    ? "❌ Já existe um cliente com este CPF/CNPJ para este representante."
    : "❌ Este cliente já está vinculado a outro representante e não pode ser salvo.";
  alert(msg);
  return;
}
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
        if (type === "usuarios") {
          const modal = document.createElement("div");
          modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
          modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
              <h3 class="text-lg font-bold mb-2">Editar Usuário</h3>
              <div class="grid grid-cols-1 gap-3">
                <input id="edit-nome" class="border p-2 rounded" value="${d.nome || ""}" placeholder="Nome">
                <input id="edit-email" class="border p-2 rounded bg-gray-100" value="${d.email || ""}" readonly>
                <select id="edit-perfil" class="border p-2 rounded">
                  <option value="representante" ${d.perfil === "representante" ? "selected" : ""}>Representante</option>
                  <option value="admin" ${d.perfil === "admin" ? "selected" : ""}>Admin</option>
                </select>
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
            const perfil = modal.querySelector("#edit-perfil").value;

            if (!nome) {
              alert("Informe o nome.");
              return;
            }

            await db.collection(type).doc(id).update({ nome, perfil });
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

function renderProdutos() {
  if (PERFIL !== "admin") {
    pageContent.innerHTML = `<p class="text-red-600 font-semibold">Apenas administradores podem gerenciar produtos.</p>`;
    return;
  }

  pageContent.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-xl font-bold">Produtos</h2>
        <p class="text-sm text-gray-500">Catálogo organizado por categoria.</p>
      </div>
      <button id="btn-novo-produto" class="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto">
        + Criar Produto
      </button>
    </div>

    <div class="bg-white p-3 rounded shadow mb-4">
      <input id="busca-produtos" type="search" class="border p-2 rounded w-full" placeholder="Buscar por produto ou categoria">
    </div>

    <div id="produtos-organizados" class="space-y-4"></div>

    <div id="modal-produto" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-2 sm:p-4 overflow-y-auto">
      <div class="bg-white w-full max-w-lg mx-auto my-8 rounded-xl shadow-lg overflow-hidden">
        <div class="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 id="modal-produto-titulo" class="text-lg font-bold">Criar Produto</h3>
            <p class="text-xs text-gray-500">Informe os dados do produto.</p>
          </div>
          <button id="fechar-modal-produto" type="button" class="text-gray-500 text-2xl leading-none" aria-label="Fechar">×</button>
        </div>

        <form id="modal-produto-form" class="p-5 space-y-4">
          <label class="block">
            <span class="block text-sm font-semibold mb-1">Nome do produto *</span>
            <input id="modal-produto-nome" class="border p-2 rounded w-full" required placeholder="Ex.: Produto Premium">
          </label>

          <label class="block">
            <span class="block text-sm font-semibold mb-1">Categoria</span>
            <input id="modal-produto-categoria" class="border p-2 rounded w-full" placeholder="Ex.: Linha Tradicional">
          </label>

          <label class="block">
            <span class="block text-sm font-semibold mb-1">Preço</span>
            <input id="modal-produto-preco" type="text" inputmode="decimal" class="border p-2 rounded w-full" placeholder="Ex.: 12,5000">
          </label>

          <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button id="cancelar-modal-produto" type="button" class="bg-gray-400 text-white px-4 py-2 rounded">Cancelar</button>
            <button id="salvar-modal-produto" type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Salvar Produto</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById("modal-produto");
  const form = document.getElementById("modal-produto-form");
  const campoNome = document.getElementById("modal-produto-nome");
  const campoCategoria = document.getElementById("modal-produto-categoria");
  const campoPreco = document.getElementById("modal-produto-preco");
  const lista = document.getElementById("produtos-organizados");
  const busca = document.getElementById("busca-produtos");
  let produtoEmEdicao = null;
  let produtosAtuais = [];

  const escapar = (valor) => typeof escapeHtmlRelatorio === "function"
    ? escapeHtmlRelatorio(valor)
    : String(valor || "");

  function fecharModal() {
    modal.classList.add("hidden");
    form.reset();
    produtoEmEdicao = null;
  }

  function abrirModal(produto = null) {
    produtoEmEdicao = produto?.id || null;
    document.getElementById("modal-produto-titulo").textContent = produto ? "Editar Produto" : "Criar Produto";
    campoNome.value = produto?.nome || "";
    campoCategoria.value = produto?.categoria || "";
    campoPreco.value = produto && Number.isFinite(Number(produto.preco))
      ? Number(produto.preco).toFixed(4).replace(".", ",")
      : "";
    modal.classList.remove("hidden");
    setTimeout(() => campoNome.focus(), 50);
  }

  function renderizarLista() {
    const termo = String(busca.value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
    const filtrados = produtosAtuais
      .filter(produto => {
        const texto = `${produto.nome || ""} ${produto.categoria || ""}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return !termo || texto.includes(termo);
      })
      .sort((a, b) => {
        const categoriaA = String(a.categoria || "Sem categoria");
        const categoriaB = String(b.categoria || "Sem categoria");
        return collator.compare(categoriaA, categoriaB) ||
          collator.compare(String(a.nome || ""), String(b.nome || ""));
      });

    if (!filtrados.length) {
      lista.innerHTML = `<div class="bg-white p-5 rounded shadow text-gray-500">Nenhum produto encontrado.</div>`;
      return;
    }

    const categorias = new Map();
    filtrados.forEach(produto => {
      const categoria = String(produto.categoria || "").trim() || "Sem categoria";
      if (!categorias.has(categoria)) categorias.set(categoria, []);
      categorias.get(categoria).push(produto);
    });

    lista.innerHTML = Array.from(categorias.entries()).map(([categoria, produtos]) => `
      <section class="bg-white rounded shadow overflow-hidden">
        <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 class="font-bold text-blue-900">${escapar(categoria)}</h3>
          <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            ${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"}
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2 p-3">
          ${produtos.map(produto => `
            <article class="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="font-semibold break-words">${escapar(produto.nome || "Sem nome")}</div>
                <div class="text-sm text-gray-500">Preço: ${formatPrecoProduto(produto.preco)}</div>
              </div>
              <div class="flex gap-2 shrink-0">
                <button type="button" data-acao="editar-produto" data-id="${produto.id}" class="bg-yellow-500 text-white px-3 py-1 rounded">Editar</button>
                <button type="button" data-acao="excluir-produto" data-id="${produto.id}" class="bg-red-600 text-white px-3 py-1 rounded">Excluir</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  document.getElementById("btn-novo-produto").addEventListener("click", () => abrirModal());
  document.getElementById("fechar-modal-produto").addEventListener("click", fecharModal);
  document.getElementById("cancelar-modal-produto").addEventListener("click", fecharModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharModal();
  });
  busca.addEventListener("input", renderizarLista);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = campoNome.value.trim();
    const categoria = campoCategoria.value.trim();
    const precoTexto = campoPreco.value.trim().replace(",", ".");
    const preco = precoTexto ? Number(precoTexto) : 0;

    if (!nome) {
      alert("Informe o nome do produto.");
      return;
    }
    if (!Number.isFinite(preco) || preco < 0) {
      alert("Informe um preço válido.");
      return;
    }

    const botaoSalvar = document.getElementById("salvar-modal-produto");
    botaoSalvar.disabled = true;

    try {
      const editando = Boolean(produtoEmEdicao);

      if (produtoEmEdicao) {
        await db.collection("produtos").doc(produtoEmEdicao).update({
          nome,
          categoria,
          preco,
          editadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const user = await waitForAuth();
        await db.collection("produtos").add({
          userId: user.uid,
          nome,
          categoria,
          preco,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      fecharModal();
      toast(editando ? "Produto atualizado!" : "Produto criado!");
    } catch (e) {
      console.error("Erro ao salvar produto:", e);
      alert("Não foi possível salvar o produto.");
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  lista.addEventListener("click", async (e) => {
    const botao = e.target.closest("button[data-acao]");
    if (!botao) return;

    const produto = produtosAtuais.find(item => item.id === botao.dataset.id);
    if (!produto) return;

    if (botao.dataset.acao === "editar-produto") {
      abrirModal(produto);
      return;
    }

    if (botao.dataset.acao === "excluir-produto") {
      if (!confirm(`Excluir o produto "${produto.nome}"?`)) return;

      try {
        await db.collection("produtos").doc(produto.id).delete();
      } catch (e) {
        console.error("Erro ao excluir produto:", e);
        alert("Não foi possível excluir o produto.");
      }
    }
  });

  db.collection("produtos").onSnapshot(
    (snap) => {
      produtosAtuais = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      renderizarLista();
    },
    (erro) => {
      console.error("Erro ao carregar produtos:", erro);
      lista.innerHTML = `<div class="bg-white p-5 rounded shadow text-red-600">Não foi possível carregar os produtos.</div>`;
    }
  );
}

// ================== RENDER FORM ==================
function renderForm(type) {
   if (type === "produtos") {
    renderProdutos();
    return;
  }

   if (type === "usuarios" && PERFIL !== "admin") {
    pageContent.innerHTML = `<p class="text-red-600 font-semibold">Sem permissão para acessar usuários.</p>`;
    return;
  }
  
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
    bindModalNovoClienteRepresentante();
  }
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
    if (type === "clientes" && PERFIL === "representante") return;

    const user = await waitForAuth();
    const uid = user.uid;
    let payload = { userId: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

   if (type === "clientes") {
  payload.nome = document.getElementById("clientes-nome").value.trim();
  payload.whatsapp = document.getElementById("clientes-whatsapp").value.trim();
  let doc = normalizarDocumento(document.getElementById("clientes-cnpj").value);

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
   const clienteDuplicado = await encontrarClienteDuplicado({
    cnpj: payload.cnpj,
    nome: payload.nome,
    userId: uid
  });

  if (clienteDuplicado) {
    const msg = clienteDuplicado.mesmoRepresentante
      ? "❌ Já existe um cliente com este CPF/CNPJ para este representante."
      : "❌ Este cliente já está vinculado a outro representante e não pode ser cadastrado novamente.";
    alert(msg);
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
  } else if (type === "usuarios") {
      if (PERFIL !== "admin") {
        alert("Apenas admin pode cadastrar usuários.");
        return;
      }

      const nome = document.getElementById("usuarios-nome").value.trim();
      const email = document.getElementById("usuarios-email").value.trim();
      const senha = document.getElementById("usuarios-senha").value.trim();
      const perfil = document.getElementById("usuarios-perfil").value;

      if (!nome || !email || !senha || !perfil) {
        alert("Preencha todos os campos.");
        return;
      }

      if (senha.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
      }

      const existe = await db.collection("usuarios")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!existe.empty) {
        alert("Já existe um usuário com esse e-mail.");
        return;
      }

      const uidNovoUsuario = await criarUsuarioAuthSemTrocarSessao(email, senha);
      payload = {
        nome,
        email,
        perfil,
        uid: uidNovoUsuario,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
  
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

  query.onSnapshot(
    snap => {
      list.innerHTML = "";

      if (snap.empty) {
        list.innerHTML = `<li class="text-gray-500">Nenhum registro.</li>`;
        return;
      }

      snap.forEach(doc => list.appendChild(listItem(type, doc.id, doc.data())));
      bindBasicActions(list);
    },
    err => {
      console.error("🔥 ERRO SNAP:", err);
    }
  );
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
        let importados = 0;
        let ignorados = 0;
        for (let row of rows) {
         const nome = (row["Nome"] || row["nome"] || "").trim();
          const whatsapp = (row["WhatsApp"] || row["whatsapp"] || "").trim();
          const cnpj = normalizarDocumento(row["CNPJ"] || row["cnpj"] || row["CPF"] || row["cpf"] || "");

          if (!nome || !cnpj) {
            ignorados++;
            continue;
          }

          
            const clienteDuplicado = await encontrarClienteDuplicado({
            cnpj,
            nome,
            userId: user.uid
          });

          if (clienteDuplicado) {
            ignorados++;
            continue;
          }

          await db.collection("clientes").add({
            userId: user.uid,
            nome,
            whatsapp,
            cnpj,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          importados++;
        }
        alert(`Importação concluída! ${importados} cliente(s) importado(s) e ${ignorados} ignorado(s).`);
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

// ================== AGENDAMENTOS ==================
function excluirAgendamentoESincronizarPedido(id) {
  return (async () => {
    await waitForAuth();

    if (PERFIL !== "admin") {
      alert("Sem permissão para excluir agendamentos.");
      return;
    }

    const agendamentoRef = db.collection("agendamentos").doc(id);
    const agendamentoSnap = await agendamentoRef.get();

    if (!agendamentoSnap.exists) {
      alert("Agendamento não encontrado.");
      return;
    }

    const agendamento = agendamentoSnap.data() || {};
    let pedidoDoc = null;

    const porListaIds = await db.collection("pedidos")
      .where("agendamentoIds", "array-contains", id)
      .limit(1)
      .get();

    if (!porListaIds.empty) {
      pedidoDoc = porListaIds.docs[0];
    }

    if (!pedidoDoc) {
      const porIdPrincipal = await db.collection("pedidos")
        .where("agendamentoId", "==", id)
        .limit(1)
        .get();

      if (!porIdPrincipal.empty) {
        pedidoDoc = porIdPrincipal.docs[0];
      }
    }

    if (!pedidoDoc && agendamento.pedidoId) {
      const porCodigo = await db.collection("pedidos")
        .where("codigo", "==", agendamento.pedidoId)
        .limit(1)
        .get();

      if (!porCodigo.empty) {
        pedidoDoc = porCodigo.docs[0];
      }
    }

    const batch = db.batch();
    batch.delete(agendamentoRef);

    if (pedidoDoc) {
      const pedido = pedidoDoc.data() || {};
      let agendamentosRestantes = [];

      if (agendamento.pedidoId) {
        const relacionados = await db.collection("agendamentos")
          .where("pedidoId", "==", agendamento.pedidoId)
          .get();

        agendamentosRestantes = relacionados.docs
          .filter(doc => doc.id !== id)
          .map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      } else {
        const idsAtuais = Array.isArray(pedido.agendamentoIds) && pedido.agendamentoIds.length
          ? pedido.agendamentoIds
          : (pedido.agendamentoId ? [pedido.agendamentoId] : []);

        const snapsRestantes = await Promise.all(
          idsAtuais
            .filter(agendamentoId => agendamentoId !== id)
            .map(agendamentoId => db.collection("agendamentos").doc(agendamentoId).get())
        );

        agendamentosRestantes = snapsRestantes
          .filter(doc => doc.exists)
          .map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      }

      if (!agendamentosRestantes.length) {
        batch.update(pedidoDoc.ref, {
          status: "cancelado",
          motivoCancelamento: "Agendamento excluído pela Dashboard",
          notificadoCancelado: true,
          agendamentoId: "",
          agendamentoIds: [],
          editadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const itensRestantes = agendamentosRestantes.map(item => ({
          produtoNome: item.produtoNome || "Não informado",
          quantidade: Number(item.quantidade || 0)
        }));
        const quantidadeRestante = itensRestantes.reduce(
          (total, item) => total + item.quantidade,
          0
        );
        const idsRestantes = agendamentosRestantes.map(item => item.id);

        batch.update(pedidoDoc.ref, {
          agendamentoId: idsRestantes[0] || "",
          agendamentoIds: idsRestantes,
          itens: itensRestantes,
          produtoNome: itensRestantes[0]?.produtoNome || "",
          produtosResumo: itensRestantes
            .map(item => `${item.produtoNome} (${formatQuantidade(item.quantidade)})`)
            .join(", "),
          quantidade: quantidadeRestante,
          editadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    await batch.commit();
  })();
}

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

 let snap;
if (coll === "clientes") {
  const user = await waitForAuth();

  let query = db.collection("clientes");

  if (PERFIL === "representante") {
    query = query.where("userId", "==", user.uid);
  }

  query.onSnapshot(snap => {
  select.innerHTML = `<option value="">Selecione cliente</option>`;

  const lista = [];

  snap.forEach(doc => {
    const d = doc.data();
    lista.push({
      id: doc.id,
      nome: d.nome || ""
    });
  });

  lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  lista.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.nome;
    select.appendChild(opt);
  });
});

return;
} else {
  let query = db.collection(coll);

  if (PERFIL === "representante") {
    query = query.where("userId", "==", user.uid);
  }

  snap = await query.orderBy(labelField).get();
}
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
    const clienteId = $selCliente.value;
    const clienteNome = $selCliente.selectedOptions[0]?.textContent || "";
    const prodNome = $selProd.selectedOptions[0]?.textContent || "";
    const data = document.getElementById("ag-data").value;
    const quantidade = parseInt(document.getElementById("ag-qtd").value);
    const observacao = document.getElementById("ag-obs").value;
    const clienteSnap = clienteId
      ? await db.collection("clientes").doc(clienteId).get()
      : null;
    const clienteDados = clienteSnap?.exists ? (clienteSnap.data() || {}) : {};
    const representanteUid = clienteDados.userId || "";
    const representanteNome = clienteDados.vinculadoPor || REPRESENTANTE_ATUAL;

    await db.collection("agendamentos").add({
      userId: user.uid,
      criadoPor: user.uid,
      representanteUserId: representanteUid,
      criadoPorAdmin: PERFIL === "admin",
      origem: "dashboard",
      clienteNome,
      representanteNome,
      produtoNome: prodNome,
      data,
      quantidade,
      observacao,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
  query = query.where("userId", "==", user.uid);
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
                  await excluirAgendamentoESincronizarPedido(e.target.dataset.id);
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

function escapeHtmlRelatorio(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterPeriodoMes(valorMes) {
  const [ano, mes] = String(valorMes || "").split("-").map(Number);
  if (!ano || !mes) return { inicio: "", fim: "" };
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
    fim: `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`
  };
}

function aplicarMesRelatorio(valorMes) {
  const periodo = obterPeriodoMes(valorMes);
  const inicio = document.getElementById("rel-start");
  const fim = document.getElementById("rel-end");
  if (inicio) inicio.value = periodo.inicio;
  if (fim) fim.value = periodo.fim;
}

function renderRelatorios(somenteRanking = false) {
  window.__MODO_RANKING_CLIENTES__ = somenteRanking;
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const colunasFiltro = PERFIL === "admin" ? "lg:grid-cols-5" : "lg:grid-cols-4";

  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-3">${somenteRanking ? "Ranking de Clientes" : "Relatórios"}</h2>

    <div class="bg-white p-3 rounded shadow mb-4">
      <div class="grid grid-cols-1 ${colunasFiltro} gap-2 items-end">
        <label class="block">
          <span class="block text-xs font-semibold text-gray-600 mb-1">Mês</span>
          <input type="month" id="rel-mes" value="${mesAtual}" class="border p-2 rounded w-full">
        </label>

        <label class="block">
          <span class="block text-xs font-semibold text-gray-600 mb-1">Cliente</span>
          <select id="rel-cliente" class="border p-2 rounded w-full">
            <option value="">Todos os clientes</option>
          </select>
        </label>

        <label class="block">
          <span class="block text-xs font-semibold text-gray-600 mb-1">Produto</span>
          <select id="rel-produto" class="border p-2 rounded w-full">
            <option value="">Todos os produtos</option>
          </select>
        </label>

        ${PERFIL === "admin" ? `
          <label class="block">
            <span class="block text-xs font-semibold text-gray-600 mb-1">Representante</span>
            <select id="rel-representante" class="border p-2 rounded w-full">
              <option value="">Todos os representantes</option>
            </select>
          </label>
        ` : ""}

        <button id="rel-filtrar" class="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Atualizar
        </button>
      </div>

      <details id="rel-periodo-detalhes" class="mt-2 border-t pt-2">
        <summary class="text-sm font-semibold text-blue-700 cursor-pointer select-none">
          Período personalizado
        </summary>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <label class="block">
            <span class="block text-xs text-gray-600 mb-1">Data inicial</span>
            <input type="date" id="rel-start" class="border p-2 rounded w-full">
          </label>
          <label class="block">
            <span class="block text-xs text-gray-600 mb-1">Data final</span>
            <input type="date" id="rel-end" class="border p-2 rounded w-full">
          </label>
        </div>
        <button id="rel-aplicar-periodo" class="mt-2 border border-blue-600 text-blue-700 px-4 py-2 rounded w-full md:w-auto">
          Aplicar período
        </button>
      </details>

      ${somenteRanking ? "" : `
        <button id="rel-pdf" class="mt-2 bg-green-600 text-white px-4 py-2 rounded w-full md:w-auto">
          Exportar PDF
        </button>
      `}
    </div>

    ${somenteRanking ? `<div id="rel-totais" class="hidden"></div>` : `
      <div class="bg-white p-4 rounded shadow mb-4">
        <h3 class="text-lg font-semibold mb-2">Totais</h3>
        <div id="rel-totais">Carregando relatório...</div>
      </div>
    `}

    ${!somenteRanking && PERFIL === "admin" ? `
      <div class="bg-white p-4 rounded shadow mb-4">
        <h3 class="text-lg font-semibold mb-2">Ranking Representantes</h3>
        <canvas id="chart-reps" style="height:300px"></canvas>
      </div>
    ` : ""}

    <div class="bg-white p-3 sm:p-4 rounded shadow">
      <h3 class="text-lg font-semibold mb-1">Ranking de Clientes</h3>
      <p class="text-sm text-gray-500 mb-3">Classificação pela quantidade total carregada no período.</p>
      <div id="ranking-clientes-lista" class="space-y-2 mb-4"></div>
      <canvas id="chart-clis" style="height:300px"></canvas>
    </div>
  `;

  aplicarMesRelatorio(mesAtual);

  document.getElementById("rel-mes").addEventListener("change", (e) => {
    aplicarMesRelatorio(e.target.value);
    document.getElementById("rel-periodo-detalhes").open = false;
  });

  ["rel-start", "rel-end"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      document.getElementById("rel-mes").value = "";
    });
  });

  document.getElementById("rel-filtrar").addEventListener("click", gerarRelatorio);
  document.getElementById("rel-aplicar-periodo").addEventListener("click", gerarRelatorio);
  document.getElementById("rel-pdf")?.addEventListener("click", exportarPDF);

  carregarFiltrosRelatorio()
    .then(gerarRelatorio)
    .catch(err => {
      console.error("Erro ao preparar relatório:", err);
      const totais = document.getElementById("rel-totais");
      if (totais) totais.textContent = "Não foi possível carregar o relatório.";
      const ranking = document.getElementById("ranking-clientes-lista");
      if (ranking) ranking.innerHTML = `<p class="text-red-600">Não foi possível carregar o ranking.</p>`;
    });
}

function renderRankingClientes() {
  renderRelatorios(true);

  const titulo = pageContent.querySelector("h2");
  if (titulo) titulo.textContent = "Ranking de Clientes";

  document.getElementById("rel-totais")?.closest(".bg-white")?.classList.add("hidden");
  document.getElementById("chart-reps")?.closest(".bg-white")?.classList.add("hidden");
}

async function carregarFiltrosRelatorio() {
  const user = await waitForAuth();
  const selCli = document.getElementById("rel-cliente");
  let cliQuery = db.collection("clientes");

  if (PERFIL === "representante") {
    cliQuery = cliQuery.where("userId", "==", user.uid);
  }

  const cliSnap = await cliQuery.get();
  const clientes = new Set();
  cliSnap.forEach(doc => {
    const nome = String(doc.data()?.nome || "").trim();
    if (nome) clientes.add(nome);
  });

  const clientesOrdenados = Array.from(clientes)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (PERFIL === "representante") {
    window.__REL_CLIENTES_REPRESENTANTE__ = clientesOrdenados;
  }

  clientesOrdenados.forEach(nome => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      selCli.appendChild(opt);
    });

  const selProduto = document.getElementById("rel-produto");
  if (selProduto) {
    const produtosSnap = await db.collection("produtos").get();
    const produtos = new Set();

    produtosSnap.forEach(doc => {
      const nome = String(doc.data()?.nome || "").trim();
      if (nome) produtos.add(nome);
    });

    Array.from(produtos)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach(nome => {
        const opt = document.createElement("option");
        opt.value = nome;
        opt.textContent = nome;
        selProduto.appendChild(opt);
      });
  }

  const selRep = document.getElementById("rel-representante");
  if (PERFIL === "admin" && selRep) {
    const repSnap = await db.collection("usuarios")
      .where("perfil", "==", "representante")
      .get();
    const representantes = new Set();

    repSnap.forEach(doc => {
      const nome = String(doc.data()?.nome || "").trim();
      if (nome) representantes.add(nome);
    });

    Array.from(representantes)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach(nome => {
        const opt = document.createElement("option");
        opt.value = nome;
        opt.textContent = nome;
        selRep.appendChild(opt);
      });
  }
}

async function gerarRelatorio() {
  const user = await waitForAuth();
  const start = document.getElementById("rel-start").value;
  const end = document.getElementById("rel-end").value;
  const clienteSel = document.getElementById("rel-cliente").value;
  const produtoSel = document.getElementById("rel-produto")?.value || "";
  const representanteSel = document.getElementById("rel-representante")?.value || "";
  const totaisEl = document.getElementById("rel-totais");
  const rankingEl = document.getElementById("ranking-clientes-lista");

  if (start && end && start > end) {
    alert("A data inicial não pode ser posterior à data final.");
    return;
  }

  totaisEl.textContent = "Carregando...";
  rankingEl.innerHTML = "";

  let documentosAgendamentos = [];

  if (PERFIL === "representante") {
    const documentosPorId = new Map();
    const snapProprios = await db.collection("agendamentos")
      .where("userId", "==", user.uid)
      .get();

    snapProprios.docs.forEach(doc => documentosPorId.set(doc.id, doc));

    const clientesDoRepresentante = Array.isArray(window.__REL_CLIENTES_REPRESENTANTE__)
      ? window.__REL_CLIENTES_REPRESENTANTE__
      : [];

    try {
      for (let inicio = 0; inicio < clientesDoRepresentante.length; inicio += 10) {
        const loteNomes = clientesDoRepresentante.slice(inicio, inicio + 10);
        if (!loteNomes.length) continue;

        const snapClientes = await db.collection("agendamentos")
          .where("clienteNome", "in", loteNomes)
          .get();

        snapClientes.docs.forEach(doc => documentosPorId.set(doc.id, doc));
      }
    } catch (e) {
      console.warn("Agendamentos antigos serão exibidos após serem vinculados ao representante.", e);
    }

    documentosAgendamentos = Array.from(documentosPorId.values());
  } else {
    const snap = await db.collection("agendamentos").get();
    documentosAgendamentos = snap.docs;
  }

  const docsFiltrados = documentosAgendamentos.filter(doc => {
    const d = doc.data() || {};
    const data = String(d.data || "");
    if (start && data < start) return false;
    if (end && data > end) return false;
    if (clienteSel && String(d.clienteNome || "") !== clienteSel) return false;
    if (produtoSel && String(d.produtoNome || "") !== produtoSel) return false;
    if (PERFIL === "admin" && representanteSel && String(d.representanteNome || "") !== representanteSel) return false;
    return true;
  });

  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};
  const porCli = {};
  const linhasTabela = [];

  docsFiltrados.forEach(doc => {
    const d = doc.data() || {};
    const qtd = Number(d.quantidade || 0);
    const produto = d.produtoNome || "Não informado";
    const representante = d.representanteNome || "Não informado";
    const cliente = d.clienteNome || "Não informado";

    totalGeral += qtd;
    porProduto[produto] = (porProduto[produto] || 0) + qtd;
    porRep[representante] = (porRep[representante] || 0) + qtd;
    porCli[cliente] = (porCli[cliente] || 0) + qtd;

    linhasTabela.push({
      cliente,
      produto,
      representante,
      qtd,
      data: d.data || "-"
    });
  });

  const produtosOrdenados = Object.entries(porProduto)
    .sort((a, b) => b[1] - a[1]);
  let html = `<p><strong>Total carregado:</strong> ${formatQuantidade(totalGeral)}</p>`;

  if (produtosOrdenados.length) {
    html += `<ul class="mt-2 space-y-1">`;
    produtosOrdenados.forEach(([produto, qtd]) => {
      html += `<li>${escapeHtmlRelatorio(produto)}: ${formatQuantidade(qtd)}</li>`;
    });
    html += "</ul>";
  } else {
    html += `<p class="text-gray-500 mt-2">Nenhum carregamento encontrado no período.</p>`;
  }
  totaisEl.innerHTML = html;

  const rankingClientes = Object.entries(porCli)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));

  const classificacoes = [
    { nome: "Diamante", icone: "💎", estilo: "background:#dbeafe;color:#1e3a8a;border-color:#93c5fd;" },
    { nome: "Ouro", icone: "🥇", estilo: "background:#fef3c7;color:#92400e;border-color:#fbbf24;" },
    { nome: "Prata", icone: "🥈", estilo: "background:#f1f5f9;color:#475569;border-color:#cbd5e1;" },
    { nome: "Bronze", icone: "🥉", estilo: "background:#ffedd5;color:#9a3412;border-color:#fdba74;" },
    { nome: "Cobre", icone: "🟤", estilo: "background:#f5e6dc;color:#7c2d12;border-color:#c08457;" }
  ];

  if (!rankingClientes.length) {
    rankingEl.innerHTML = `<p class="text-gray-500">Nenhum cliente para classificar neste período.</p>`;
  } else {
    rankingEl.innerHTML = rankingClientes.map(([cliente, qtd], index) => {
      const classificacao = classificacoes[index];
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border p-3 rounded-lg">
          <div class="flex flex-wrap items-center gap-2 min-w-0">
            <span class="font-bold text-gray-500">#${index + 1}</span>
            ${classificacao ? `
              <span class="inline-flex items-center justify-center w-7 h-7 rounded-full border text-sm" style="${classificacao.estilo}" title="${classificacao.nome}" aria-label="${classificacao.nome}">
                ${classificacao.icone}
              </span>
            ` : ""}
            <span class="font-semibold break-words">${escapeHtmlRelatorio(cliente)}</span>
          </div>
          <strong class="whitespace-nowrap">${formatQuantidade(qtd)}</strong>
        </div>
      `;
    }).join("");
  }

  if (chartRepsInst) {
    chartRepsInst.destroy();
    chartRepsInst = null;
  }
  if (chartClisInst) {
    chartClisInst.destroy();
    chartClisInst = null;
  }

  const canvasReps = document.getElementById("chart-reps");
  if (PERFIL === "admin" && canvasReps) {
    const rankingReps = Object.entries(porRep).sort((a, b) => b[1] - a[1]);
    chartRepsInst = new Chart(canvasReps, {
      type: "bar",
      data: {
        labels: rankingReps.map(item => item[0]),
        datasets: [{
          label: "Quantidade",
          data: rankingReps.map(item => item[1]),
          backgroundColor: "#f28c28"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }} }
    });
  }

  const coresRanking = ["#60a5fa", "#fbbf24", "#94a3b8", "#fb923c", "#b87333"];
  chartClisInst = new Chart(document.getElementById("chart-clis"), {
    type: "bar",
    data: {
      labels: rankingClientes.map(item => item[0]),
      datasets: [{
        label: "Quantidade carregada",
        data: rankingClientes.map(item => item[1]),
        backgroundColor: rankingClientes.map((_, index) => coresRanking[index] || "#1f3b64")
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });

  window.__REL_CACHE__ = {
    start,
    end,
    linhasTabela,
    totalGeral,
    porProduto,
    porRep,
    porCli,
    rankingClientes,
    clienteSel,
    produtoSel,
    representanteSel
  };
}

// ================== EXPORTAR PDF ==================
async function exportarPDF() {
  if (!window.__REL_CACHE__) {
    alert("Nenhum relatório carregado para exportar.");
    return;
  }

  const {
    start,
    end,
    totalGeral,
    porProduto,
    porRep,
    porCli,
    rankingClientes,
    clienteSel,
    produtoSel,
    representanteSel
  } = window.__REL_CACHE__;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const formatDateBR = (dateStr) => {
    if (!dateStr) return "";
    const [ano, mes, dia] = dateStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };
  const brandBlue = [31, 59, 100];
  const brandOrange = [242, 140, 40];
  const textDark = [31, 41, 55];
  const textMuted = [107, 114, 128];
  const margemX = 14;
  const largura = 182;
  let y = 18;

  const garantirPagina = (altura = 10) => {
    if (y + altura > 282) {
      doc.addPage();
      y = 18;
    }
  };

  const tituloSecao = (titulo) => {
    garantirPagina(14);
    doc.setFillColor(...brandBlue);
    doc.roundedRect(margemX, y, largura, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, margemX + 3, y + 5.6);
    y += 11;
  };

  const linha = (posicao, nome, quantidade, indice = 0) => {
    const prefixo = posicao ? `#${posicao}  ` : "";
    const nomeLinhas = doc.splitTextToSize(`${prefixo}${nome || "-"}`, 143);
    const altura = Math.max(8, nomeLinhas.length * 4.3 + 3);
    garantirPagina(altura + 2);
    doc.setFillColor(indice % 2 === 0 ? 248 : 255, indice % 2 === 0 ? 250 : 255, indice % 2 === 0 ? 252 : 255);
    doc.roundedRect(margemX, y, largura, altura, 1.5, 1.5, "F");
    doc.setFont("helvetica", posicao ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    doc.text(nomeLinhas, margemX + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(formatQuantidade(quantidade), margemX + largura - 3, y + 5, { align: "right" });
    y += altura + 1.5;
  };

  try {
    const logo = await fetch("img/logo.png")
      .then(resposta => resposta.blob())
      .then(blob => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }));
    doc.addImage(logo, "PNG", margemX, 10, 22, 22);
  } catch (_) {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...brandBlue);
  doc.text("Relatório Geral", 40, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...textMuted);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, 40, 24);

  y = 38;
  doc.setDrawColor(...brandOrange);
  doc.setLineWidth(0.7);
  doc.line(margemX, y, margemX + largura, y);
  y += 7;

  let periodo = "Todos os períodos";
  if (start && end) periodo = `${formatDateBR(start)} a ${formatDateBR(end)}`;
  else if (start) periodo = `A partir de ${formatDateBR(start)}`;
  else if (end) periodo = `Até ${formatDateBR(end)}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...textDark);
  doc.text(`Período: ${periodo}`, margemX, y);
  y += 5;
  if (clienteSel) {
    doc.text(`Cliente: ${clienteSel}`, margemX, y);
    y += 5;
  }
  if (produtoSel) {
    doc.text(`Produto: ${produtoSel}`, margemX, y);
    y += 5;
  }
  if (representanteSel) {
    doc.text(`Representante: ${representanteSel}`, margemX, y);
    y += 5;
  }
  y += 2;

  tituloSecao("Resumo");
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margemX, y, largura, 14, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text("Quantidade total carregada", margemX + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...brandBlue);
  doc.text(formatQuantidade(totalGeral), margemX + 4, y + 11.5);
  y += 18;

  tituloSecao("Totais por Produto");
  const produtosOrdenados = Object.entries(porProduto || {}).sort((a, b) => b[1] - a[1]);
  if (!produtosOrdenados.length) linha("", "Nenhum produto no período", 0);
  produtosOrdenados.forEach(([nome, quantidade], indice) => linha("", nome, quantidade, indice));
  y += 3;

  tituloSecao("Ranking de Representantes");
  const representantesOrdenados = Object.entries(porRep || {}).sort((a, b) => b[1] - a[1]);
  if (!representantesOrdenados.length) linha("", "Nenhum representante no período", 0);
  representantesOrdenados.forEach(([nome, quantidade], indice) => linha(indice + 1, nome, quantidade, indice));
  y += 3;

  tituloSecao("Ranking de Clientes");
  const clientesOrdenados = Array.isArray(rankingClientes) && rankingClientes.length
    ? rankingClientes
    : Object.entries(porCli || {}).sort((a, b) => b[1] - a[1]);
  if (!clientesOrdenados.length) linha("", "Nenhum cliente no período", 0);
  clientesOrdenados.forEach(([nome, quantidade], indice) => linha(indice + 1, nome, quantidade, indice));

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(`Página ${pagina} de ${totalPaginas}`, 196, 290, { align: "right" });
  }

  doc.save("relatorio-geral.pdf");
}

// ================== DASHBOARD COM FULLCALENDAR ==================
async function obterPedidosAdminOcultosDoRepresentante(user) {
  if (PERFIL !== "representante" || !user?.uid) return new Set();

  const snap = await db.collection("pedidos")
    .where("userId", "==", user.uid)
    .get();

  return new Set(
    snap.docs
      .map(doc => doc.data() || {})
      .filter(pedido => pedido.criadoPorAdmin === true)
      .map(pedido => pedido.codigo)
      .filter(Boolean)
  );
}

function renderDashboard() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Calendário de Agendamentos</h2>
   <div id="calendar" class="bg-white p-4 rounded shadow w-full overflow-x-auto"></div>
  `;

  waitForAuth().then(async user => {
const pedidosAdminOcultos = await obterPedidosAdminOcultosDoRepresentante(user);
let query;

if (PERFIL === "representante") {
  query = db.collection("agendamentos")
    .where("userId", "==", user.uid);
} else {
  query = db.collection("agendamentos"); // ✅ SIMPLES
}

query.onSnapshot(snap => {
        const docsVisiveis = snap.docs.filter(doc => {
          if (PERFIL !== "representante") return true;
          const agendamento = doc.data();
          return agendamento.criadoPorAdmin !== true
            && !pedidosAdminOcultos.has(agendamento.pedidoId);
        });

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

        const eventos = docsVisiveis.map(doc => {
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
        window.agendamentos = docsVisiveis.map(doc => doc.data());

        // Resumo por dia → produtos e quantidades
        const resumoPorDia = {};
        docsVisiveis.forEach(doc => {
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

  const representanteSomenteConsulta = PERFIL === "representante";
  
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
            right: representanteSomenteConsulta
              ? "dayGridMonth"
              : "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
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
  if (representanteSomenteConsulta) {
    abrirResumoDoDia(info.event.startStr?.split("T")[0] || info.event.start);
    return;
  }
  abrirEdicaoAgendamento(info.event.id);
}
        });

       calendar.render();
},
err => {
  console.error("🔥 ERRO NO CALENDÁRIO:", err);
});
  });
}
async function abrirModalAgendamento(dataSelecionada) {
  const user = await waitForAuth();

 const clientesSnap = await getClientesFiltrados();
  const produtosSnap = await db.collection("produtos").where("userId","==",user.uid).get();

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

 modal.innerHTML = `
  <div class="bg-white p-6 rounded w-full max-w-md space-y-3">
    <h3 class="text-lg font-bold">Novo Agendamento</h3>

    <select id="m-cliente" class="border p-2 w-full"></select>
    <select id="m-produto" class="border p-2 w-full"></select>

    <input id="m-qtd" type="number" class="border p-2 w-full" placeholder="Quantidade">
    <textarea id="m-obs" class="border p-2 w-full rounded" rows="3" placeholder="Observação (opcional)"></textarea>

    <div class="flex justify-end space-x-2">
      <button id="cancelar" class="bg-gray-400 text-white px-3 py-1 rounded">Cancelar</button>
      <button id="salvar" class="bg-green-600 text-white px-3 py-1 rounded">Salvar</button>
    </div>
  </div>
`;

  document.body.appendChild(modal);

  const selCliente = modal.querySelector("#m-cliente");
  const selProduto = modal.querySelector("#m-produto");
  

 const lista = [];

clientesSnap.forEach(doc => {
  const d = doc.data();

  if (!d.nome || d.nome.trim() === "") return;

  lista.push({
    id: doc.id,
    nome: d.nome,
    userId: d.userId || "",
    representanteNome: d.vinculadoPor || ""
  });
});

lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

lista.forEach(cliente => {
  const opt = document.createElement("option");
  opt.value = cliente.id;
  opt.textContent = cliente.nome;
  opt.dataset.userId = cliente.userId;
  opt.dataset.representanteNome = cliente.representanteNome;
  selCliente.appendChild(opt);
});

  produtosSnap.forEach(doc=>{
    const opt = document.createElement("option");
    opt.value = doc.data().nome;
    opt.textContent = doc.data().nome;
    selProduto.appendChild(opt);
  });

  modal.querySelector("#cancelar").onclick = ()=>modal.remove();

  modal.querySelector("#salvar").onclick = async () => {
    const clienteOption = selCliente.selectedOptions[0];
    const cliente = clienteOption?.textContent || "";
    const produto = selProduto.value;
    const qtd = parseInt(modal.querySelector("#m-qtd").value);
    const observacao = modal.querySelector("#m-obs").value.trim();
    const representanteUid = clienteOption?.dataset.userId || user.uid;
    const representanteNome = clienteOption?.dataset.representanteNome || REPRESENTANTE_ATUAL;

    await db.collection("agendamentos").add({
      userId: representanteUid,
      criadoPor: user.uid,
      origem: "dashboard",
      clienteNome: cliente,
      representanteNome,
      produtoNome: produto,
      quantidade: qtd,
      data: dataSelecionada,
      observacao,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    modal.remove();
  };
}
async function abrirEdicaoAgendamento(id) {
  const user = await waitForAuth();

  const snap = await db.collection("agendamentos").doc(id).get();
  const d = snap.data();

  const clientesSnap = await getClientesFiltrados();

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
      <textarea id="edit-observacao" class="border p-2 w-full rounded" rows="3" placeholder="Observação (opcional)"></textarea>

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
  let prodQuery = db.collection("produtos");

const prodSnap = await prodQuery.get();

// ✅ CORREÇÃO AQUI
const $produto = modal.querySelector("#edit-produto");
const nomes = new Set();

$produto.innerHTML = `<option value="">Selecione produto</option>`;

// lista para ordenar
const listaProdutos = [];

prodSnap.forEach(doc => {
  const d = doc.data();

  if (!d.nome || d.nome.trim() === "") return;

  listaProdutos.push(d.nome);
});

// ordena corretamente
listaProdutos.sort((a, b) => a.localeCompare(b, 'pt-BR'));

// monta select de PRODUTOS
listaProdutos.forEach(nome => {
  const opt = document.createElement("option");
  opt.value = nome;
  opt.textContent = nome;

  if (nome === d.produtoNome) opt.selected = true;

  selProduto.appendChild(opt);
});
  // Preenche outros campos
  modal.querySelector("#edit-qtd").value = d.quantidade || 0;
  modal.querySelector("#edit-data").value = d.data || "";
  modal.querySelector("#edit-observacao").value = d.observacao || "";

  // SALVAR
  modal.querySelector("#salvar").onclick = async () => {
    await db.collection("agendamentos").doc(id).update({
      clienteNome: selCliente.value,
      representanteNome: d.representanteNome || REPRESENTANTE_ATUAL,
      produtoNome: selProduto.value,
      quantidade: parseInt(modal.querySelector("#edit-qtd").value) || 0,
      data: modal.querySelector("#edit-data").value,
      observacao: modal.querySelector("#edit-observacao").value.trim()
    });

    modal.remove();
  };

  // EXCLUIR
  modal.querySelector("#excluir").onclick = async () => {
    if (confirm("Excluir agendamento?")) {
      await excluirAgendamentoESincronizarPedido(id);
      modal.remove();
    }
  };
}
function imprimirResumoDiario(dataSelecionada, totalGeral, porProduto, porRep, lista) {
  const janela = window.open("", "", "width=1000,height=750");
  if (!janela) {
    alert("Permita a abertura de janelas para imprimir o relatório.");
    return;
  }

  const escapar = (valor) => typeof escapeHtmlRelatorio === "function"
    ? escapeHtmlRelatorio(valor)
    : String(valor || "");
  const formatarData = (data) => {
    const [ano, mes, dia] = String(data || "").split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
  };
  const logoUrl = new URL("img/logo.png", window.location.href).href;
  const produtos = Object.entries(porProduto || {}).sort((a, b) => b[1] - a[1]);
  const representantes = Object.entries(porRep || {}).sort((a, b) => b[1] - a[1]);
  const agendamentos = [...(lista || [])].sort((a, b) =>
    String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""), "pt-BR")
  );

  const linhasResumo = (itens) => itens.map(([nome, quantidade]) => `
    <div class="resumo-linha">
      <span>${escapar(nome)}</span>
      <strong>${formatQuantidade(quantidade)}</strong>
    </div>
  `).join("") || `<p class="vazio">Nenhum registro.</p>`;

  const linhasTabela = agendamentos.map((item, indice) => `
    <tr>
      <td>${indice + 1}</td>
      <td>${escapar(item.clienteNome || "-")}</td>
      <td>${escapar(item.produtoNome || "-")}</td>
      <td class="numero">${formatQuantidade(item.quantidade || 0)}</td>
      <td>${escapar(item.representanteNome || "-")}</td>
      <td>${escapar(item.observacao || "-")}</td>
    </tr>
  `).join("");

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Agendamentos de ${formatarData(dataSelecionada)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2937;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            background: #fff;
          }
          .cabecalho {
            display: flex;
            align-items: center;
            gap: 14px;
            border-bottom: 3px solid #f28c28;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .cabecalho img { width: 54px; height: 54px; object-fit: contain; }
          h1 { margin: 0 0 4px; color: #1f3b64; font-size: 21px; }
          .subtitulo { color: #6b7280; font-size: 12px; }
          .total {
            background: #eef4ff;
            border: 1px solid #c7d7f2;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
          }
          .total span { display: block; color: #6b7280; margin-bottom: 3px; }
          .total strong { color: #1f3b64; font-size: 22px; }
          .resumos {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 14px;
          }
          .card {
            border: 1px solid #dfe6f1;
            border-radius: 8px;
            overflow: hidden;
          }
          .card h2 {
            margin: 0;
            padding: 7px 9px;
            color: #fff;
            background: #1f3b64;
            font-size: 12px;
          }
          .resumo-linha {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 6px 9px;
            border-bottom: 1px solid #edf0f5;
          }
          .resumo-linha:last-child { border-bottom: 0; }
          .vazio { padding: 8px; color: #6b7280; }
          h2.tabela-titulo { color: #1f3b64; font-size: 14px; margin: 0 0 7px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          th {
            background: #1f3b64;
            color: #fff;
            text-align: left;
            padding: 7px 5px;
            font-size: 9px;
          }
          td {
            border-bottom: 1px solid #dfe6f1;
            padding: 6px 5px;
            vertical-align: top;
            overflow-wrap: anywhere;
          }
          tbody tr:nth-child(even) { background: #f8fafc; }
          th:nth-child(1), td:nth-child(1) { width: 5%; }
          th:nth-child(2), td:nth-child(2) { width: 24%; }
          th:nth-child(3), td:nth-child(3) { width: 20%; }
          th:nth-child(4), td:nth-child(4) { width: 12%; }
          th:nth-child(5), td:nth-child(5) { width: 19%; }
          th:nth-child(6), td:nth-child(6) { width: 20%; }
          .numero { text-align: right; font-weight: bold; }
          .rodape {
            margin-top: 12px;
            padding-top: 7px;
            border-top: 1px solid #dfe6f1;
            color: #6b7280;
            font-size: 9px;
            text-align: right;
          }
          @media (max-width: 700px) {
            .resumos { grid-template-columns: 1fr; }
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            tr { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header class="cabecalho">
          <img src="${logoUrl}" alt="Logo">
          <div>
            <h1>Relatório Diário de Agendamentos</h1>
            <div class="subtitulo">Data: ${formatarData(dataSelecionada)}</div>
          </div>
        </header>

        <section class="total">
          <span>Quantidade total agendada</span>
          <strong>${formatQuantidade(totalGeral)}</strong>
        </section>

        <section class="resumos">
          <div class="card">
            <h2>Totais por Produto</h2>
            ${linhasResumo(produtos)}
          </div>
          <div class="card">
            <h2>Totais por Representante</h2>
            ${linhasResumo(representantes)}
          </div>
        </section>

        <h2 class="tabela-titulo">Agendamentos do dia</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Representante</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>${linhasTabela || `<tr><td colspan="6">Nenhum agendamento.</td></tr>`}</tbody>
        </table>

        <footer class="rodape">
          Emitido em ${new Date().toLocaleString("pt-BR")}
        </footer>
      </body>
    </html>
  `);
  janela.onload = () => setTimeout(() => janela.print(), 250);
  janela.document.close();
  janela.focus();
}

async function abrirResumoDoDia(dataSelecionada) {
  const user = await waitForAuth();
  const representanteSomenteConsulta = PERFIL === "representante";

 let query = db.collection("agendamentos")
  .where("data", "==", dataSelecionada);

if (PERFIL === "representante") {
  query = query.where("userId", "==", user.uid);
}

const snap = await query.get();
const pedidosAdminOcultos = await obterPedidosAdminOcultosDoRepresentante(user);
const docsVisiveis = snap.docs.filter(doc => {
  if (PERFIL !== "representante") return true;
  const agendamento = doc.data();
  return agendamento.criadoPorAdmin !== true
    && !pedidosAdminOcultos.has(agendamento.pedidoId);
});

  let totalGeral = 0;
  const porProduto = {};
  const porRep = {};

  const lista = [];

  docsVisiveis.forEach(doc => {
    const d = doc.data();
    const qtd = d.quantidade || 0;

    totalGeral += qtd;

    // Produto
    porProduto[d.produtoNome] = (porProduto[d.produtoNome] || 0) + qtd;

    // Representante
    porRep[d.representanteNome || "Sem rep"] =
      (porRep[d.representanteNome || "Sem rep"] || 0) + qtd;

    lista.push({ id: doc.id, ...d });
  });

  const observacoesPorVinculo = new Map();

  async function buscarObservacaoPedido(agendamento) {
    const chave = agendamento.pedidoId
      ? `pedido:${agendamento.pedidoId}`
      : `agendamento:${agendamento.id}`;

    if (observacoesPorVinculo.has(chave)) {
      return observacoesPorVinculo.get(chave);
    }

    const consulta = (async () => {
      let pedidoDoc = null;

      if (agendamento.pedidoId) {
        const porCodigo = await db.collection("pedidos")
          .where("codigo", "==", agendamento.pedidoId)
          .limit(1)
          .get();

        if (!porCodigo.empty) {
          pedidoDoc = porCodigo.docs[0];
        } else {
          const porId = await db.collection("pedidos").doc(String(agendamento.pedidoId)).get();
          if (porId.exists) pedidoDoc = porId;
        }
      }

      if (!pedidoDoc && agendamento.id) {
        const porListaIds = await db.collection("pedidos")
          .where("agendamentoIds", "array-contains", agendamento.id)
          .limit(1)
          .get();

        if (!porListaIds.empty) {
          pedidoDoc = porListaIds.docs[0];
        }
      }

      if (!pedidoDoc && agendamento.id) {
        const porIdPrincipal = await db.collection("pedidos")
          .where("agendamentoId", "==", agendamento.id)
          .limit(1)
          .get();

        if (!porIdPrincipal.empty) {
          pedidoDoc = porIdPrincipal.docs[0];
        }
      }

      return String(pedidoDoc?.data()?.observacao || "").trim();
    })();

    observacoesPorVinculo.set(chave, consulta);
    return consulta;
  }

  await Promise.all(lista.map(async (agendamento) => {
    if (String(agendamento.observacao || "").trim()) return;

    try {
      const observacaoPedido = await buscarObservacaoPedido(agendamento);
      if (observacaoPedido) {
        agendamento.observacao = observacaoPedido;
      }
    } catch (e) {
      console.warn("Não foi possível recuperar a observação do pedido.", e);
    }
  }));

  const modal = document.createElement("div");
 modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto";

  modal.innerHTML = `
     <div class="bg-white p-6 rounded w-full max-w-3xl max-h-[90vh] flex flex-col gap-4 overflow-hidden my-6">
      <h3 class="text-lg font-bold">${representanteSomenteConsulta ? "Resumo das suas vendas" : "Resumo do dia"} ${dataSelecionada}</h3>

 <div class="bg-blue-50 border border-blue-200 p-4 rounded text-center">
        <div class="text-sm text-gray-600">${representanteSomenteConsulta ? "Total vendido por você" : "Total Geral"}</div>
        <div class="text-2xl font-bold text-blue-700">
          ${totalGeral.toLocaleString("pt-BR")}
        </div>
      </div>

      <div class="overflow-y-auto pr-1 space-y-4">
        <div class="grid ${representanteSomenteConsulta ? "grid-cols-1" : "grid-cols-2"} gap-4">
          <div class="bg-gray-50 p-3 rounded">
  <h4 class="font-bold mb-2">Por Produto</h4>
            ${Object.entries(porProduto).map(([prod, qtd]) => `
              <div class="flex justify-between border-b py-1">
                <span>${prod}</span>
                <strong>${qtd.toLocaleString("pt-BR")}</strong>
              </div>
            `).join("")}
          </div>
     ${representanteSomenteConsulta ? "" : `
            <div class="bg-gray-50 p-3 rounded">
              <h4 class="font-bold mb-2">Por Representante</h4>
              ${Object.entries(porRep).map(([rep, qtd]) => `
                <div class="flex justify-between border-b py-1">
                  <span>${rep}</span>
                  <strong>${qtd.toLocaleString("pt-BR")}</strong>
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <div>
          <h4 class="font-bold mb-2">Agendamentos:</h4>
          <div class="max-h-72 overflow-y-auto space-y-1 pr-1">
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
                ${item.observacao ? `
                  <div class="text-xs font-semibold text-red-600 mt-1">
                    Obs: ${escapeHtmlRelatorio(item.observacao)}
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
          
      </div>

      <div class="flex ${representanteSomenteConsulta ? "justify-end" : "justify-between"} mt-2">
        ${representanteSomenteConsulta ? "" : `
          <button id="novo" class="bg-green-600 text-white px-3 py-1 rounded">
            + Novo Agendamento
          </button>
        `}

        <div class="space-x-2">
          ${representanteSomenteConsulta ? "" : `
            <button id="imprimir" class="bg-blue-600 text-white px-3 py-1 rounded">
              Imprimir
            </button>
          `}
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

 if (!representanteSomenteConsulta) {
    // NOVO AGENDAMENTO
    modal.querySelector("#novo").onclick = () => {
      modal.remove();
      abrirModalAgendamento(dataSelecionada);
    };

  // IMPRIMIR
    modal.querySelector("#imprimir").onclick = () => {
      imprimirResumoDiario(dataSelecionada, totalGeral, porProduto, porRep, lista);
    };
  }
}
// ================== MENU ==================
document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;

   if (page === "agendamentos") renderAgendamentos();
    else if (page === "pedidos") renderPedidos();
    else if (page === "relatorios") renderRelatorios();
    else if (page === "ranking-clientes") renderRankingClientes();
    else if (page === "dashboard") renderDashboard();
    else if (page === "notificacoes") renderNotificacoes();
    else if (page === "producao") renderProducao();
    else if (page === "recibo") renderRecibo();
    else if (page === "whatsapp") renderWhatsapp();
    else if (page === "notas") renderNotas();
    else renderForm(page);

    // 👇 ISSO AQUI QUE RESOLVE SEU PROBLEMA
    const menu = document.getElementById("sidebar");
    if (window.innerWidth < 768) {
      menu.classList.add("-translate-x-full");
    }
  });
});

function normalizarIdentidadePedido(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pedidoPertenceAoCriador(pedido, user) {
  if (PERFIL !== "representante") return true;
  if (!pedido || !user?.uid) return false;

  // O representante só vê pedidos com autoria explicitamente comprovada.
  return pedido.criadoPor === user.uid;
}

function renderPedidos() {
   const renderPedidosToken = Date.now() + Math.random();
  window.__renderPedidosToken = renderPedidosToken;
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Pedidos</h2>

    ${["representante", "admin"].includes(PERFIL) ? `
   <div class="bg-white p-4 rounded shadow mb-4">
      <button id="btn-abrir-modal-pedido" type="button" class="w-full md:w-auto text-white p-2 rounded" style="background-color: #E67E22;">+ Novo Pedido</button>
      <div id="modal-pedido" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 p-0 md:p-4">
        <div class="bg-white w-full md:max-w-2xl md:mx-auto md:mt-12 rounded-t-2xl md:rounded-xl p-4 md:p-6 max-h-[92vh] overflow-y-auto absolute bottom-0 left-0 right-0 md:static space-y-2">
          <h3 class="text-lg font-bold mb-2">Novo Pedido</h3>
          <select id="p-cliente" class="border p-2 w-full"></select>
           <div id="p-itens" class="space-y-2">
            <div class="pedido-item grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <select id="p-produto" class="pedido-produto border p-2 w-full md:col-span-7"></select>
              <input id="p-qtd" type="text" class="pedido-qtd border p-2 w-full md:col-span-4" placeholder="Quantidade">
              <button type="button" class="btn-remover-produto hidden bg-red-600 text-white p-2 rounded md:col-span-1">×</button>
            </div>
          </div>
          <button id="btn-adicionar-produto" type="button" class="border border-blue-600 text-blue-700 p-2 rounded w-full">+ Adicionar outro produto</button>
          <select id="p-prazo" class="border p-2 w-full" required>
            <option value="" selected disabled>Prazo de pagamento *</option>
            <option value="À vista">À vista</option>
            <option value="10 dias">10 dias</option>
            <option value="15 dias">15 dias</option>
            <option value="30 dias">30 dias</option>
            <option value="30/60 dias">30/60 dias</option>
          </select>
           <input id="p-responsavel" type="text" class="border p-2 w-full" placeholder="Representante/responsável">
          <input id="p-obs" type="text" class="border p-2 w-full" placeholder="Observações (opcional)">
          <p id="msg-enviando-pedido" class="hidden text-center text-sm font-semibold text-blue-700">ENVIANDO SEU PEDIDO...</p>
          <button id="btn-pedido" class="bg-blue-600 text-white p-2 rounded w-full">Enviar Pedido</button>
          <button id="btn-cancelar-modal-pedido" type="button" class="bg-gray-400 text-white p-2 rounded w-full">Cancelar</button>
        </div>
      </div>
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

if (!lista) {
  console.error("❌ lista-pedidos não encontrado");
  return;
}
  const inputQtd = document.getElementById("p-qtd");
   const inputResponsavel = document.getElementById("p-responsavel");
  if (inputResponsavel) inputResponsavel.value = REPRESENTANTE_ATUAL || "";

function formatarInputQuantidadePedido(input) {
  input?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");

     if (!v) {
      e.target.value = "";
      return;
    }

   e.target.value = Number(v).toLocaleString("pt-BR");
  });
}

formatarInputQuantidadePedido(inputQtd);

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
  if (["representante", "admin"].includes(PERFIL)) {
  const modalPedido = document.getElementById("modal-pedido");
  document.getElementById("btn-abrir-modal-pedido")?.addEventListener("click", () => {
    modalPedido?.classList.remove("hidden");
  });
  document.getElementById("btn-cancelar-modal-pedido")?.addEventListener("click", () => {
    modalPedido?.classList.add("hidden");
  });
}
  
waitForAuth().then(async user => {

  if ($cliente && $produto) {
      // CLIENTES
      let cliQuery = db.collection("clientes");
      if (PERFIL === "representante") {
        cliQuery = cliQuery.where("userId", "==", user.uid);
      }
       const cliSnap = await cliQuery.orderBy("nome").get();
      $cliente.innerHTML = `<option value="">Selecione cliente</option>`;
      cliSnap.forEach(doc => {
        const opt = document.createElement("option");
        opt.value = doc.data().nome;
        opt.textContent = doc.data().nome;
        opt.dataset.id = doc.id;
        $cliente.appendChild(opt);
      });

    // PRODUTOS
      const prodSnap = await db.collection("produtos").get();
$produto.innerHTML = `<option value="">Selecione produto</option>`;

        // lista e controle de duplicados
      const listaProdutos = [];
      const nomesUnicos = new Set();
       
      prodSnap.forEach(doc => {
        const d = doc.data();

       if (!d.nome || d.nome.trim() === "") return;
   const nomeNormalizado = d.nome.trim().toLowerCase();
        if (nomesUnicos.has(nomeNormalizado)) return;

       nomesUnicos.add(nomeNormalizado);
        listaProdutos.push(d.nome);
      });

// ordena
      listaProdutos.sort((a, b) => a.localeCompare(b, "pt-BR"));

      function preencherSelectProduto(select) {
      if (!select) return;
      const valorAtual = select.value;
      select.innerHTML = `<option value="">Selecione produto</option>`;
      listaProdutos.forEach(nome => {
        const opt = document.createElement("option");
        opt.value = nome;
        opt.textContent = nome;
      select.appendChild(opt);
      });
      if (valorAtual) select.value = valorAtual;
    }

     }

    function adicionarLinhaProduto() {
      const containerItens = document.getElementById("p-itens");
      const primeiraLinha = containerItens?.querySelector(".pedido-item");
      if (!containerItens || !primeiraLinha) return;

      const novaLinha = primeiraLinha.cloneNode(true);
      novaLinha.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      const selectProduto = novaLinha.querySelector(".pedido-produto");
      const inputQuantidade = novaLinha.querySelector(".pedido-qtd");
      preencherSelectProduto(selectProduto);
      if (inputQuantidade) inputQuantidade.value = "";
      formatarInputQuantidadePedido(inputQuantidade);
      novaLinha.querySelector(".btn-remover-produto")?.addEventListener("click", () => {
        novaLinha.remove();
        atualizarBotoesRemoverProduto();
      });
      containerItens.appendChild(novaLinha);
      atualizarBotoesRemoverProduto();
    }

    preencherSelectProduto($produto);
    document.querySelector("#p-itens .btn-remover-produto")?.addEventListener("click", (e) => {
      e.currentTarget.closest(".pedido-item")?.remove();
      atualizarBotoesRemoverProduto();
    });
    atualizarBotoesRemoverProduto();
    document.getElementById("btn-adicionar-produto")?.addEventListener("click", adicionarLinhaProduto);

    function atualizarBotoesRemoverProduto() {
      const linhas = document.querySelectorAll("#p-itens .pedido-item");
      linhas.forEach((linha) => {
        linha.querySelector(".btn-remover-produto")?.classList.toggle("hidden", linhas.length === 1);
      });
    }
  
  // CRIAR PEDIDO
  let pedidoEmEnvio = false;
  document.getElementById("btn-pedido")?.addEventListener("click", async () => {

     if (pedidoEmEnvio) return;

    const btnPedido = document.getElementById("btn-pedido");
    const btnCancelar = document.getElementById("btn-cancelar-modal-pedido");
    const msgEnviando = document.getElementById("msg-enviando-pedido");
    
    const clienteSelect = document.getElementById("p-cliente");
    const cliente = clienteSelect.value;
    const clienteDocId = clienteSelect.selectedOptions[0]?.dataset.id || "";
    const itens = Array.from(document.querySelectorAll("#p-itens .pedido-item"))
      .map((linha) => {
        const produtoNome = linha.querySelector(".pedido-produto")?.value || "";
        const valor = (linha.querySelector(".pedido-qtd")?.value || "").replace(/\./g, "");
        return { produtoNome, quantidade: parseInt(valor) || 0 };
      })
      .filter((item) => item.produtoNome && item.quantidade > 0);
    const prazo = document.getElementById("p-prazo").value;
    const obs = document.getElementById("p-obs").value;
    const responsavel = document.getElementById("p-responsavel")?.value.trim() || REPRESENTANTE_ATUAL || "Administrativo";
    const produto = itens[0]?.produtoNome || "";
    const quantidade = itens.reduce((total, item) => total + item.quantidade, 0);


    if (!prazo) {
      alert("Selecione o prazo de pagamento.");
      return;
    }

     if (!cliente || !itens.length) {
      alert("Selecione pelo menos um produto com quantidade.");
      return;
    }

    pedidoEmEnvio = true;
    try {
      if (btnPedido) {
        btnPedido.disabled = true;
        btnPedido.textContent = "Enviando...";
      }
      if (btnCancelar) btnCancelar.disabled = true;
      msgEnviando?.classList.remove("hidden");
      const user = await waitForAuth();

 const codigo = await gerarCodigoPedidoUnico();
      let clienteSnapshot = {};
      let representanteUserId = "";
      try {
       let clienteDoc = null;
        if (clienteDocId) {
          const docCliente = await db.collection("clientes").doc(clienteDocId).get();
          if (docCliente.exists) clienteDoc = docCliente.data() || {};
        }

         if (!clienteDoc) {
          let clienteQuery = db.collection("clientes").where("nome", "==", cliente).limit(1);
          if (PERFIL === "representante") {
            clienteQuery = db.collection("clientes")
              .where("userId", "==", user.uid)
              .where("nome", "==", cliente)
              .limit(1);
          }

          const clienteSnap = await clienteQuery.get();
          if (!clienteSnap.empty) clienteDoc = clienteSnap.docs[0].data() || {};
        }

        if (clienteDoc) {
          const c = clienteDoc;
          representanteUserId = c.userId || "";
          clienteSnapshot = {
            clienteCnpj: c.cnpj || "",
            clienteWhatsapp: c.whatsapp || "",
            clienteIe: c.ie || "",
            clienteEndereco: c.endereco || "",
            clienteNumero: c.numero || "",
            clienteBairro: c.bairro || "",
            clienteCidade: c.cidade || "",
            clienteUf: c.uf || ""
          };
        }
      } catch (e) {
        console.warn("Não foi possível carregar snapshot do cliente para o pedido.", e);
      }

      
      const pedidoPayload = {
        codigo,
        userId: user.uid,
        criadoPor: user.uid,
        representanteUserId,
        clienteNome: cliente,
        produtoNome: produto,
        produtosResumo: itens.map((item) => `${item.produtoNome} (${typeof formatQuantidade === "function" ? formatQuantidade(item.quantidade) : item.quantidade})`).join(", "),
        itens,
        prazoPagamento: prazo,
        observacao: obs,
        quantidade,
        representanteNome: responsavel,
        status: "pendente",
        criadoPorAdmin: PERFIL === "admin",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...clienteSnapshot
      };

     await db.collection("pedidos").add(pedidoPayload);

      const adminsSnap = await db.collection("usuarios")
        .where("perfil", "==", "admin")
        .get();

 const notifPromises = adminsSnap.docs
        .map(doc => {
          const dados = doc.data() || {};
          return dados.uid || dados.userId || doc.id;
        })
        .filter(Boolean)
        .map(adminUid => db.collection("notificacoes").add({
          userId: adminUid,
          pedidoId: codigo,
           texto: `📥 Novo pedido ${codigo} recebido de ${responsavel}`,
          lida: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }));

      await Promise.all(notifPromises);
      alert("Pedido enviado para aprovação!");
      document.getElementById("modal-pedido")?.classList.add("hidden");
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar pedido. Tente novamente.");
    } finally {
      pedidoEmEnvio = false;
      if (btnPedido) {
        btnPedido.disabled = false;
         btnPedido.textContent = "Enviar Pedido";
      }
      if (btnCancelar) btnCancelar.disabled = false;
      msgEnviando?.classList.add("hidden");
    }
  });

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
          if (!pedidoPertenceAoCriador(p, user)) return;
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
            item.className = "bg-white p-3 rounded shadow cursor-pointer";
            
  item.innerHTML = `      
  <div style="font-size:12px; color:#666;">
    Pedido: <b>${p.codigo || "-"}</b>
  </div>

  <b>${p.clienteNome}</b> - ${typeof formatarItensPedidoTexto === "function" ? formatarItensPedidoTexto(p) : `${p.produtoNome} (${formatQuantidade(p.quantidade)})`}<br>
  
  <div style="font-size:12px; color:#555;">
    Representante: ${p.representanteNome || "não informado"}
  </div>

  <span style="color:${corStatus}; font-weight:bold">
    ${p.status}
  </span>

  ${PERFIL === "admin" ? `
  <div class="mt-2 space-x-2">
  
  ${PERFIL === "admin" && p.status === "aprovado" ? `
  <button data-id="${p.id}" class="btn-excluir bg-red-800 text-white px-2 py-1 rounded">
    Excluir
  </button>
` : ""}

    ${p.status === "pendente" ? `
      <button data-id="${p.id}" class="btn-aprovar bg-green-600 text-white px-2 py-1 rounded">
        Aprovar
      </button>

      <button data-id="${p.id}" class="btn-cancelar bg-red-600 text-white px-2 py-1 rounded">
        Cancelar
      </button>
    ` : ""}

    <button data-id="${p.id}" class="btn-editar bg-blue-600 text-white px-2 py-1 rounded">
      Editar
    </button>

  </div>
` : ""}
`;
const btnAprovar = item.querySelector(".btn-aprovar");
const btnCancelar = item.querySelector(".btn-cancelar");
            
const btnExcluir = item.querySelector(".btn-excluir");

item.addEventListener("click", () => {
if (typeof window.abrirModalDetalhesPedido === "function") {
    window.abrirModalDetalhesPedido(p);
    return;
  }

  console.error("Função abrirModalDetalhesPedido não está disponível.");
  const prazoFallback = (p.prazoPagamento || p.data || "-");
  alert(
    `Pedido: ${p.codigo || "-"}
` +
    `Cliente: ${p.clienteNome || "-"}
` +
    `Produtos: ${typeof formatarItensPedidoTexto === "function" ? formatarItensPedidoTexto(p) : (p.produtoNome || "-")}
` +
     `Quantidade total: ${formatQuantidade(p.quantidade || 0)}
` +
    `Prazo: ${prazoFallback}
` +
    `Observação: ${p.observacao || "-"}`
  );
});


if (btnExcluir) {
  btnExcluir.addEventListener("click", (e) => {
    e.stopPropagation();
    excluirPedidoCompleto(p.id);
  });
}

const btnEditar = item.querySelector(".btn-editar");

if (btnEditar) {
  btnEditar.addEventListener("click", async (e) => {
    e.stopPropagation();
    editarPedidoAprovado(p.id);
  });
}

if (btnAprovar) {
  btnAprovar.addEventListener("click", async (e) => {
    e.stopPropagation();
    aprovarPedido(p.id, e.target);
  });
}

if (btnCancelar) {
  btnCancelar.addEventListener("click", async (e) => {
    e.stopPropagation();
    cancelarPedido(p.id, e.target);
  });
}
            container.appendChild(item);
          });

          lista.appendChild(header);
          lista.appendChild(container);
               });

      }); // fecha onSnapshot
}); //
  
}
