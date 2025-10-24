const INSTANCE_ID = "instance147478"; // sua instância UltraMsg
const TOKEN = "c4j1m6wyghzhvhrd"; // seu token UltraMsg

document.getElementById("enviar").addEventListener("click", async () => {
  const msgModelo = document.getElementById("mensagem").value.trim();
  const file = document.getElementById("arquivo").files[0];
  const relatorio = document.getElementById("relatorio");
  const barra = document.getElementById("barra");

  if (!file || !msgModelo) {
    alert("Selecione o arquivo CSV e digite a mensagem.");
    return;
  }

  const csv = await file.text();
  const linhas = csv.split(/\r?\n/).filter(l => l.trim());
  const contatos = linhas.map(l => {
    const [nome, telefone] = l.split(",").map(t => t.trim());
    return { nome, telefone };
  });

  relatorio.innerHTML = "";
  let enviados = 0;

  for (const contato of contatos) {
    const msg = msgModelo.replace(/{{nome}}/gi, contato.nome);
    const url = `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`;
    const body = { token: TOKEN, to: contato.telefone, body: msg };

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();

      const li = document.createElement("li");
      if (data.sent) {
        li.className = "ok";
        li.textContent = `${contato.nome} (${contato.telefone}) ✅ Mensagem enviada.`;
      } else {
        li.className = "fail";
        li.textContent = `${contato.nome} (${contato.telefone}) ❌ Falhou.`;
      }
      relatorio.appendChild(li);
    } catch (e) {
      const li = document.createElement("li");
      li.className = "fail";
      li.textContent = `${contato.nome} (${contato.telefone}) ⚠️ Erro.`;
      relatorio.appendChild(li);
    }

    enviados++;
    barra.style.width = `${(enviados / contatos.length) * 100}%`;
    await new Promise(res => setTimeout(res, 800)); // pequena pausa entre envios
  }
});
