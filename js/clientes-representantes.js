// === VINCULAR LISTA DE REPRESENTANTES NO CADASTRO DE CLIENTES ===
document.addEventListener("DOMContentLoaded", () => {
  // Espera o Firebase estar pronto
  waitForAuth().then(user => {
    // Verifica se existe o campo de representante no formulário de cliente
    const repField = document.getElementById("cliente-representante");
    if (!repField) return; // sai se o campo não existir

    // Se for um input de texto, substitui por um select
    if (repField.tagName.toLowerCase() === "input") {
      const select = document.createElement("select");
      select.id = "cliente-representante";
      select.className = "border p-2 rounded w-full";
      select.required = true;
      select.innerHTML = `<option value="">Selecione o representante</option>`;
      repField.parentNode.replaceChild(select, repField);
    }

    const sel = document.getElementById("cliente-representante");

    // Carrega representantes da coleção
    db.collection("representantes")
      .orderBy("nome")
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          sel.innerHTML = `<option value="">Nenhum representante cadastrado</option>`;
          return;
        }
        snapshot.forEach(doc => {
          const d = doc.data();
          const opt = document.createElement("option");
          opt.value = d.nome;
          opt.textContent = d.nome;
          sel.appendChild(opt);
        });
      })
      .catch(err => {
        console.error("Erro ao carregar representantes:", err);
      });
  });
});
