document.getElementById("enviar").addEventListener("click", async () => {
  const msg = document.getElementById("mensagem").value;
  const file = document.getElementById("arquivo").files[0];
  if (!file || !msg) {
    alert("Por favor, selecione um arquivo e digite uma mensagem.");
    return;
  }

  const text = await file.text();
  const numbers = text.split(/\r?\n/).filter(n => n.trim());
  
  const res = await fetch("https://agendamento-app-fwls.onrender.com/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numbers, message: msg })
  });
  const result = await res.json();

  const relatorio = document.getElementById("relatorio");
  relatorio.innerHTML = "";
  result.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.number}: ${r.status}`;
    li.className = r.status === "success" ? "ok" : "fail";
    relatorio.appendChild(li);
  });
});
