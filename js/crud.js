// CRUD básico para clientes, reps e produtos
const pageContent = document.getElementById("page-content");

function renderForm(type) {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Gerenciar ${type}</h2>
    <form id="${type}-form" class="space-y-2 mb-4">
      <input id="${type}-name" placeholder="Nome" class="border p-2 rounded w-full" required />
      <button class="bg-blue-600 text-white p-2 rounded">Salvar</button>
    </form>
    <ul id="${type}-list" class="space-y-2"></ul>
  `;

  const form = document.getElementById(`${type}-form`);
  const list = document.getElementById(`${type}-list`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById(`${type}-name`).value;
    await db.collection(type).add({ name, userId: auth.currentUser.uid });
    form.reset();
    loadItems(type, list);
  });

  loadItems(type, list);
}

async function loadItems(type, list) {
  const snap = await db.collection(type).where("userId", "==", auth.currentUser.uid).get();
  list.innerHTML = "";
  snap.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = doc.data().name;
    list.appendChild(li);
  });
}

document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    renderForm(btn.dataset.page);
  });
});