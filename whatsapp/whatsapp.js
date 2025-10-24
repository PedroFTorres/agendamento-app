const INSTANCE_ID = "instanceXXXX"; // 🔹 substitua aqui
const API_TOKEN = "seu_token_aqui"; // 🔹 substitua aqui
const API_URL = "https://api.ultramsg.com";

document.getElementById("abrirWhatsApp").addEventListener("click", () => {
  window.open("https://web.whatsapp.com", "_blank");
});

document.getElementById("enviar").addEventListener("click", async () => {
  const msg = document.getElementById("mensagem").value.trim();
  const file = document.getElementById("arquivo").files[0];
  if (!file || !msg) {
    alert("Selecione um arquivo e digite uma mensagem.");
    return;
  }

  const text = await file.text();
  const numbers = text.split(/\r?\n/).filter(n => n.trim());
  const relatorio = document.getElementById("relatorio");
  const progresso = document.getElementById("progresso");
  const barra = document.getElementById("barra");
  const contador = document.getElementById("contador");

  relatorio.innerHTML = "";
  progresso.style.display = "block";
  barra.style.width = "0%";
  contador.textContent = `0 de ${numbers.length} enviados`;

  let enviados = 0;
  for (const number of numbers) {
    const formatted = number.replace(/\D/g, "");
    try {
      const res = await fetch(`${API_URL}/${INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: API_TOKEN,
          to: formatted,
          body: msg
        })
      });
      const data = await res.json();
      const li = document.createElement("li");
      li.textContent = `${formatted}: ${data.sent ? "✅ Enviado" : "❌ Falhou"}`;
      li.className = data.sent ? "ok" : "fail";
      relatorio.appendChild(li);
    } catch {
      const li = document.createElement("li");
      li.textContent = `${number}: ⚠️ Erro de conexão`;
      li.className = "fail";
      relatorio.appendChild(li);
    }

    enviados++;
    const progressoPct = Math.round((enviados / numbers.length) * 100);
    barra.style.width = `${progressoPct}%`;
    contador.textContent = `${enviados} de ${numbers.length} enviados`;
  }
});

