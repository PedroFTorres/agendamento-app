function renderRecibo() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Recibo</h2>
    <form id="recibo-form" class="bg-white p-4 rounded shadow space-y-3">
      <input id="recibo-cliente" class="border p-2 rounded w-full" placeholder="Nome do pagador" required>
      <input id="recibo-valor" type="number" step="0.01" class="border p-2 rounded w-full" placeholder="Valor (R$)" required>
      <input id="recibo-ref" class="border p-2 rounded w-full" placeholder="Referência (motivo do pagamento)">
      <button class="bg-green-600 text-white p-2 rounded w-full">Gerar Recibo (PDF)</button>
    </form>
  `;

  document.getElementById("recibo-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const cliente = document.getElementById("recibo-cliente").value.trim();
    const valorNum = parseFloat(document.getElementById("recibo-valor").value);
    const ref = document.getElementById("recibo-ref").value.trim();
    const hoje = new Date().toLocaleDateString("pt-BR");

    if (!cliente || isNaN(valorNum)) {
      alert("Preencha o nome e um valor válido.");
      return;
    }

    const valorMoeda = valorNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorExtenso = numeroParaExtensoBRL(valorNum);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== CABEÇALHO =====
    try {
      const logo = document.createElement("img");
      logo.src = "img/logo.png";
      doc.addImage(logo, "PNG", 20, 10, 30, 30);
    } catch {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CERÂMICA FORTES LTDA.", 105, 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000 – Cx. Postal 26", 105, 26, { align: "center" });
    doc.text("Fone: (99) 3118-3700 | Fax: (99) 3118-3701", 105, 31, { align: "center" });
    doc.text("E-mail: fortes@fortes.com.br   www.fortes.com.br", 105, 36, { align: "center" });
    doc.text("CNPJ: 06.849.988/0001-44 – I.E: 12.095.413-3", 105, 41, { align: "center" });

    doc.line(20, 48, 190, 48);

    // ===== TÍTULO =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RECIBO (R$)", 105, 60, { align: "center" });

    let y = 80;

    // ===== VALOR =====
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Valor do Recibo (R$):", 20, y);
    doc.rect(80, y - 7, 110, 10); // Caixa para valor
    doc.text(valorMoeda, 85, y);

    y += 15;

    // ===== VALOR POR EXTENSO =====
    const extensoTexto = valorExtenso;
    const larguraExt = doc.getTextWidth(extensoTexto) + 6;
    doc.setFillColor(255, 229, 204); // fundo laranja claro
    doc.rect(80, y - 7, larguraExt, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(extensoTexto, 83, y);

    y += 20;

    // ===== REFERÊNCIA =====
    doc.setFont("helvetica", "bold");
    doc.text("Referência:", 20, y);
    doc.rect(20, y + 3, 170, 20);
    doc.setFont("helvetica", "normal");
    doc.text(ref || "", 25, y + 15);

    y += 35;

    // ===== PAGADOR =====
    doc.setFont("helvetica", "bold");
    doc.text("Recebemos de:", 20, y);
    doc.rect(65, y - 7, 125, 10);
    doc.setFont("helvetica", "normal");
    doc.text(cliente, 70, y);

    y += 20;

    // ===== FAVORECIDO =====
    doc.setFont("helvetica", "bold");
    doc.text("Favorecido:", 20, y);
    doc.rect(55, y - 7, 135, 10);
    doc.setFont("helvetica", "normal");
    doc.text("CERÂMICA FORTES LTDA.", 60, y);

    y += 20;

    // ===== DATA =====
    doc.setFont("helvetica", "bold");
    doc.text("Data:", 20, y);
    doc.rect(35, y - 7, 50, 10);
    doc.setFont("helvetica", "normal");
    doc.text(hoje, 40, y);

    // ===== ASSINATURA =====
    y += 40;
    doc.line(70, y, 140, y);
    doc.setFontSize(10);
    doc.text("Assinatura do Favorecido", 105, y + 6, { align: "center" });

    doc.save(`recibo-${cliente}.pdf`);
  });
}
