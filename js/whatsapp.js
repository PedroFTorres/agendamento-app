// whatsapp.js
export function renderWhatsapp() {
import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function waitForAuth() {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => {
      if (u) { unsub(); resolve(u); }
    });
  });
}

// ============ TELA WHATSAPP ============
export function renderWhatsapp() {
  const pageContent = document.getElementById("page-content");

  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4 text-orange-700">Envio WhatsApp 📲</h2>
    <p class="mb-2 text-sm text-gray-700">Selecione os clientes (com opt-in) e envie mensagens personalizadas.</p>

    <div id="lista-clientes" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">Carregando...</div>

    <div class="bg-white p-4 rounded shadow mt-4">
      <h3 class="font-semibold mb-2 text-gray-700">Mensagem personalizada</h3>
      <textarea id="mensagem" class="border p-2 rounded w-full" rows="4" placeholder="Ex: Olá {{nome}}, seu pedido está pronto para retirada."></textarea>
      <button id="btnEnviar" class="bg-orange-600 text-white px-4 py-2 rounded mt-3 hover:bg-orange-700">Enviar WhatsApp</button>
      <div id="status" class="mt-2 text-sm font-medium"></div>
    </div>
  `;

  const listaDiv = document.getElementById("lista-clientes");
  const btnEnviar = document.getElementById("btnEnviar");
  const statusDiv = document.getElementById("status");

  carregarClientes(listaDiv);

  btnEnviar.addEventListener("click", () => enviarWhatsApp(listaDiv, statusDiv));
}

// ============ CARREGAR CLIENTES ============
async function carregarClientes(listaDiv) {
  const user = await waitForAuth();
  const snap = await getDocs(collection(db, "clientes"));
  const clientes = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(c => c.userId === user.uid && c.whatsapp && c.optInWhatsApp);

  if (!clientes.length) {
    listaDiv.innerHTML = `<p class="text-red-600 col-span-full">Nenhum cliente com opt-in para WhatsApp encontrado.</p>`;
    return;
  }

  listaDiv.innerHTML = "";
  clientes.forEach(c => {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded shadow border hover:shadow-lg transition";
    card.innerHTML = `
      <label class="flex flex-col space-y-1">
        <input type="checkbox" value="${c.whatsapp}" class="mr-2">
        <span class="font-semibold text-gray-800">${c.nome}</span>
        <span class="text-sm text-gray-600">📞 ${c.whatsapp}</span>
        ${c.representante ? `<span class="text-xs text-gray-500">Rep: ${c.representante}</span>` : ""}
      </label>
    `;
    listaDiv.appendChild(card);
  });
}

// ============ PERSONALIZAR TEXTO ============
function substituirVariaveis(template, cliente) {
  return template
    .replace(/{{\s*nome\s*}}/gi, cliente.nome || "")
    .replace(/{{\s*representante\s*}}/gi, cliente.representante || "")
    .replace(/{{\s*telefone\s*}}/gi, cliente.whatsapp || "");
}

// ============ ENVIO ============
async function enviarWhatsApp(listaDiv, statusDiv) {
  const mensagemBase = document.getElementById("mensagem").value.trim();
  if (!mensagemBase) return alert("Digite uma mensagem antes de enviar.");

  const checkboxes = listaDiv.querySelectorAll("input[type=checkbox]:checked");
  if (!checkboxes.length) return alert("Selecione pelo menos um cliente.");

  statusDiv.textContent = "Iniciando envio...";

  let count = 0;
  for (const checkbox of checkboxes) {
    const numero = checkbox.value.replace(/\D/g, "");
    const nome = checkbox.parentElement.querySelector("span.font-semibold").textContent;
    const repElem = checkbox.parentElement.querySelector("span.text-xs");
    const representante = repElem ? repElem.textContent.replace("Rep:", "").trim() : "";

    const cliente = { nome, representante, whatsapp: numero };
    const mensagem = substituirVariaveis(mensagemBase, cliente);

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
    count++;
    statusDiv.textContent = `📤 Enviando (${count}/${checkboxes.length})...`;
    await new Promise(r => setTimeout(r, 2500)); // delay 2.5s entre envios
  }

  statusDiv.textContent = `✅ Envio concluído (${count} mensagens abertas).`;
}
