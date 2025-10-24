/***** CONFIGURAÇÃO ULTRAMSG *****/
const INSTANCE_ID = "instance147478";      // <<< troque aqui
const API_TOKEN   = "c4j1m6wyghzhvhrd";    // <<< troque aqui (demonstração)
const API_URL     = "https://api.ultramsg.com";

/***** ESTADO *****/
let conversas = [];          // lista de chats
let chatAtual = null;        // {id, name, number}
let cacheMsgs = {};          // { chatId: [mensagens...] }
let pollingChats = null;
let pollingMsgs  = null;

/***** HELPERS *****/
const $ = (s) => document.querySelector(s);
const el = (t, cls) => { const e=document.createElement(t); if(cls) e.className=cls; return e; };
const soDigits = (v) => (v||"").toString().replace(/\D/g,"");

/***** API ULTRAMSG (uso básico) *****/
// Lista de chats (conversas recentes)
async function apiListarChats() {
  // UltraMsg: GET /{instance}/chats?token=...&page=1
  const url = `${API_URL}/${INSTANCE_ID}/chats?token=${API_TOKEN}&page=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao listar chats');
  return res.json(); // esperado: { chats: [{id, name, lastMessage, ...}], ... }
}

// Mensagens de um chat
async function apiListarMensagens(chatId, limit=50) {
  // UltraMsg: GET /{instance}/messages?token=...&chatId=...&limit=50
  const url = `${API_URL}/${INSTANCE_ID}/messages?token=${API_TOKEN}&chatId=${encodeURIComponent(chatId)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao listar mensagens');
  return res.json(); // esperado: { messages: [{id, from, to, body, fromMe, timestamp, ...}], ... }
}

// Enviar texto
async function apiEnviarTexto(toNumber, body) {
  const url = `${API_URL}/${INSTANCE_ID}/messages/chat`;
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ token: API_TOKEN, to: soDigits(toNumber), body })
  });
  const data = await res.json();
  return data; // {sent:true/false, ...}
}

/***** UI – CONVERSAS *****/
async function carregarConversas() {
  try {
    const data = await apiListarChats();
    conversas = data.chats || data || []; // adapta a resposta
    renderConversas();
  } catch(e) {
    console.warn(e);
  }
}

function renderConversas(filtro="") {
  const ul = $("#listaConversas");
  ul.innerHTML = "";
  const q = filtro.trim().toLowerCase();

  (conversas||[])
    .filter(c => {
      const alvo = (c.name || c.id || c.chatId || "").toLowerCase();
      return !q || alvo.includes(q);
    })
    .forEach(c => {
      const li = el("li");
      const meta = el("div","chat-meta");
      const titulo = el("div","chat-title");
      const sub = el("div","chat-sub");

      const id = c.id || c.chatId || c.number || c.jid || c.phone || "";
      const name = c.name || id;
      const last = c.lastMessage?.body || c.lastMessage || c.lastText || "";

      titulo.textContent = name;
      sub.textContent = last;

      meta.appendChild(titulo);
      meta.appendChild(sub);
      li.appendChild(meta);

      if (c.unreadCount > 0) {
        const b = el("span","badge");
        b.textContent = c.unreadCount;
        li.appendChild(b);
      }

      li.addEventListener("click", () => abrirChat({ id, name, number: soDigits(id) }));
      ul.appendChild(li);
    });
}

/***** UI – CHAT *****/
async function abrirChat(chat) {
  chatAtual = chat;
  $("#chatTitulo").textContent = chat.name || chat.number;
  $("#chatSub").textContent = chat.number ? `+${chat.number}` : (chat.id || "");
  $("#mensagens").innerHTML = "";

  clearInterval(pollingMsgs);
  await carregarMensagens(chat.id);
  pollingMsgs = setInterval(() => carregarMensagens(chat.id, true), 5000);
}

async function carregarMensagens(chatId, incremental=false) {
  try {
    const data = await apiListarMensagens(chatId, 60);
    const msgs = data.messages || data || [];
    const arr = (cacheMsgs[chatId] = incremental ? mergePorId(cacheMsgs[chatId]||[], msgs) : msgs);
    renderMensagens(arr);
  } catch(e) {
    console.warn(e);
  }
}

function mergePorId(orig, nov) {
  const mapa = new Map((orig||[]).map(m => [m.id||m._id||m.key?.id, m]));
  for (const m of (nov||[])) mapa.set(m.id||m._id||m.key?.id, m);
  return Array.from(mapa.values()).sort((a,b)=> (a.timestamp||a.t||0)-(b.timestamp||b.t||0));
}

function renderMensagens(msgs) {
  const box = $("#mensagens");
  box.innerHTML = "";

  (msgs||[]).forEach(m => {
    const bubble = el("div","bubble");
    const body = m.body || m.text || m.message || "";
    const me = m.fromMe === true || m.author === "me" || /^me$/i.test(m.senderName||"");
    if (me) bubble.classList.add("me");
    bubble.textContent = body;

    const meta = el("span","meta");
    const ts = m.timestamp || m.t || Date.now()/1000;
    const dt = new Date(ts*1000);
    meta.textContent = dt.toLocaleString();
    bubble.appendChild(meta);

    box.appendChild(bubble);
  });

  box.scrollTop = box.scrollHeight;
}

/***** ENVIAR MENSAGEM ÚNICA *****/
$("#enviarMsg").addEventListener("click", async() => {
  const texto = $("#texto").value.trim();
  if (!texto) return;
  if (!chatAtual) { alert("Selecione ou inicie um chat."); return; }

  try {
    const r = await apiEnviarTexto(chatAtual.number || chatAtual.id, texto);
    if (r.sent) {
      // adiciona imediatamente no UI
      const local = { id: "local-"+Math.random(), body:texto, fromMe:true, timestamp: Math.floor(Date.now()/1000) };
      cacheMsgs[chatAtual.id] = mergePorId(cacheMsgs[chatAtual.id]||[], [local]);
      renderMensagens(cacheMsgs[chatAtual.id]);
      $("#texto").value = "";
    } else {
      alert("Falha ao enviar.");
    }
  } catch(e) {
    alert("Erro de conexão ao enviar.");
  }
});

/***** INICIAR NOVO CHAT *****/
$("#btnNovoChat").addEventListener("click", () => {
  const n = soDigits($("#novoNumero").value);
  if (!n) return;
  abrirChat({ id: n, name: n, number: n });
  $("#novoNumero").value = "";
});

/***** BUSCA *****/
$("#busca").addEventListener("input", (e)=> renderConversas(e.target.value));

/***** POLLING DE CONVERSAS *****/
async function startPolling() {
  await carregarConversas();
  clearInterval(pollingChats);
  pollingChats = setInterval(carregarConversas, 8000);
}

/***** ENVIO EM MASSA *****/
const drawer   = $("#drawer");
const abrirBtn = $("#abrirMassa");
const fecharBtn= $("#fecharMassa");

abrirBtn.addEventListener("click", ()=> drawer.style.display="flex");
fecharBtn.addEventListener("click", ()=> drawer.style.display="none");

$("#btnEnviarMassa").addEventListener("click", async () => {
  const msg = $("#mensagemMassa").value.trim();
  const file = $("#arquivoCSV").files[0];
  if (!file || !msg) { alert("Selecione um CSV e digite a mensagem."); return; }

  const text = await file.text();
  const numeros = text.split(/\r?\n/).map(soDigits).filter(Boolean);

  const relatorio = $("#relatorio");
  const progBox = $("#progressoBox");
  const barra = $("#barra");
  const contador = $("#contador");

  relatorio.innerHTML = "";
  progBox.style.display = "block";
  barra.style.width = "0%";
  contador.textContent = `0 de ${numeros.length} enviados`;

  let enviados = 0;

  for (const to of numeros) {
    try {
      const r = await apiEnviarTexto(to, msg);
      const li = el("li", r.sent ? "ok" : "fail");
      li.textContent = `${to}: ${r.sent ? "✅ Enviado" : "❌ Falhou"}`;
      relatorio.appendChild(li);
    } catch {
      const li = el("li","fail");
      li.textContent = `${to}: ⚠️ Erro de conexão`;
      relatorio.appendChild(li);
    }
    enviados++;
    const pct = Math.round((enviados/numeros.length)*100);
    barra.style.width = pct+"%";
    contador.textContent = `${enviados} de ${numeros.length} enviados`;
  }
});

/***** BOOT *****/
startPolling();

/***** BUSCAR NOVAS MENSAGENS DO WEBHOOK *****/
async function atualizarInbox() {
  try {
    const res = await fetch("https://whatsapp-webhook-xxxxx.onrender.com/mensagens");
    const data = await res.json();
    // aqui você pode exibir as novas mensagens na lateral esquerda do chat
    console.log("Mensagens recebidas:", data);
  } catch (err) {
    console.warn("Erro ao buscar webhook:", err);
  }
}

// atualiza a cada 5s
setInterval(atualizarInbox, 5000);

