const INSTANCE_ID = "instance147478"; // seu ID da UltraMsg
const API_TOKEN = "c4j1m6wyghzhvhrd"; // seu token da UltraMsg
const API_URL = "https://api.ultramsg.com";

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
  relatorio.innerHTML = "<li>📤 Enviando mensagens...</li>";

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
    } catch (err) {
      const li = document.createElement("li");
      li.textContent = `${number}: ⚠️ Erro de conexão`;
      li.className = "fail";
      relatorio.appendChild(li);
    }
  }
});
