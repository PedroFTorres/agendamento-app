async function aprovarPedido(id) {
  const data = prompt("Informe a data (YYYY-MM-DD)");
  if (!data) return;

  const doc = await db.collection("pedidos").doc(id).get();
  const p = doc.data();

  await db.collection("agendamentos").add({
    userId: p.userId,
    clienteNome: p.clienteNome,
    produtoNome: p.produtoNome,
    quantidade: p.quantidade,
    representanteNome: p.representanteNome,
    data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("pedidos").doc(id).update({
    status: "aprovado"
  });

  alert("Pedido aprovado!");
}

async function cancelarPedido(id) {
  const motivo = prompt("Motivo do cancelamento:");
  if (!motivo) return;

  await db.collection("pedidos").doc(id).update({
    status: "cancelado",
    motivoCancelamento: motivo
  });

  alert("Pedido cancelado!");
}
