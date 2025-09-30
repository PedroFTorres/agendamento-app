// whatsapp.js
async function renderWhatsapp() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">WhatsApp</h2>
    <div class="bg-white p-4 rounded shadow space-y-4">
      <input type="text" id="whats-search" placeholder="Pesquisar cliente..." 
             class="border p-2 rounded w-full">
      <ul id="whats-list" class="space-y-2"></ul>
    </div>
  `;

  const list = document.getElementById("whats-list");
  const searchInput = document.getElementById("whats-search");

  const user = await waitForAuth();
  db.collection("clientes")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      list.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data();
        const tel = d.whatsapp ? `55${d.whatsapp.replace(/\D/g,"")}` : "";
        const li = document.createElement("li");
        li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
        li.innerHTML = `
          <div>
            <div class="font-semibold">${d.nome || "—"}</div>
            <div class="text-sm text-gray-500">WhatsApp: ${d.whatsapp || "—"}</div>
          </div>
          <div class="space-x-2">
            ${tel ? `<a href="https://wa.me/${tel}" target="_blank"
                      class="bg-green-600 text-white px-2 py-1 rounded">Abrir</a>` : ""}
            ${tel ? `<button data-num="${tel}" 
                      class="bg-blue-600 text-white px-2 py-1 rounded btn-msg">Mensagem</button>` : ""}
          </div>
        `;
        list.appendChild(li);
      });

      // Botão enviar mensagem rápida
      list.querySelectorAll(".btn-msg").forEach(btn => {
        btn.addEventListener("click", () => {
          const num = btn.dataset.num;
          const msg = prompt("Digite a mensagem:");
          if (msg) {
            window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
          }
        });
      });
    });

  // Filtro de pesquisa
  searchInput.addEventListener("input", () => {
    const termo = searchInput.value.toLowerCase();
    list.querySelectorAll("li").forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(termo) ? "" : "none";
    });
  });
}
