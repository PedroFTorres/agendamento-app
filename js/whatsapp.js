// whatsapp.js — versão com integração WhatsApp Cloud API (Meta)

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

  // Garante que o usuário está logado
  const user = await waitForAuth();

  // Carrega lista de clientes com WhatsApp
  db.collection("clientes")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      list.innerHTML = "";

      if (snap.empty) {
        list.innerHTML = `<li class="text-gray-500">Nenhum cliente cadastrado.</li>`;
        return;
      }

      snap.forEach(doc => {
        const d = doc.data();
        const tel = d.whatsapp ? `55${d.whatsapp.replace(/\D/g, "")}` : "";

        const li = document.createElement("li");
        li.className = "p-2 bg-white rounded shadow flex justify-between items-center";
        li.innerHTML = `
          <div>
            <div class="font-semibold">${d.nome || "—"}</div>
            <div class="text-sm text-gray-500">WhatsApp: ${d.whatsapp || "—"}</div>
          </div>
          <div class="space-x-2">
            ${
              tel
                ? `<button data-num="${tel}" class="bg-blue-600 text-white px-2 py-1 rounded btn-msg">Enviar Mensagem</button>`
                : ""
            }
          </div>
        `;
        list.appendChild(li);
      });

      // Enviar mensagem via WhatsApp Cloud API
      list.querySelectorAll(".btn-msg").forEach(btn => {
        btn.addEventListener("click", async () => {
          const num = btn.dataset.num;
          const msg = prompt("Digite a mensagem para enviar via WhatsApp API:");
          if (!msg) return;

          try {
            // Chama a Cloud Function no Firebase
            const fn = firebase
              .app()
              .functions("southamerica-east1")
              .httpsCallable("sendWhatsAppMessage");

            // Executa a função e aguarda a resposta
            await fn({ to: num, text: msg });

            alert("✅ Mensagem enviada com sucesso via WhatsApp Cloud API!");
          } catch (err) {
            console.error("Erro ao enviar mensagem:", err);
            alert("❌ Erro ao enviar mensagem. Verifique o console para detalhes.");
          }
        });
      });
    });

  // Filtro de pesquisa por nome ou número
  searchInput.addEventListener("input", () => {
    const termo = searchInput.value.toLowerCase();
    list.querySelectorAll("li").forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(termo) ? "" : "none";
    });
  });
}
