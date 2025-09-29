function renderRecibo() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Recibo</h2>
    <form id="recibo-form" class="bg-white p-4 rounded shadow space-y-3">
      <input id="recibo-cliente" class="border p-2 rounded w-full" placeholder="Nome do pagador" required>
      <input id="recibo-valor" type="number" step="0.01" class="border p-2 rounded w-full" placeholder="Valor (R$)" required>
      <select id="recibo-ref" class="border p-2 rounded w-full">
        <option value="Referente a pagamento de material Cerâmico à vista.">Referente a pagamento de material Cerâmico à vista.</option>
        <option value="Referente a pagamento de material Cerâmico à prazo.">Referente a pagamento de material Cerâmico à prazo.</option>
      </select>
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

    // ===== DIMENSÕES =====
    const margemX = 20;
    const larguraCaixa = 170;
    const alturaCaixa = 130; // ocupa meia folha
    const inicioY = 20;

    // Desenha a caixa principal
    doc.setDrawColor(0);
    doc.rect(margemX, inicioY, larguraCaixa, alturaCaixa);

    let y = inicioY + 10;

    // ===== CABEÇALHO =====
    try {
      const logo = document.createElement("img");
      logo.src = "img/logo.png";
      doc.addImage(logo, "PNG", margemX + 5, y, 20, 20);
    } catch {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CERÂMICA FORTES LTDA.", margemX + 90, y + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000", margemX + 90, y + 10, { align: "center" });
    doc.text("Fone: (99) 3118-3700 | Fax: (99) 3118-3701", margemX + 90, y + 15, { align: "center" });
    doc.text("E-mail: fortes@fortes.com.br  www.fortes.com.br", margemX + 90, y + 20, { align: "center" });
    doc.text("CNPJ: 06.849.988/0001-44 – I.E: 12.095.413-3", margemX + 90, y + 25, { align: "center" });

    y += 35;

    // ===== VALOR =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Valor do Recibo (R$):", margemX + 5, y);

    const valorTexto = valorMoeda;
    const larguraValor = doc.getTextWidth(valorTexto) + 8;
    doc.setFillColor(255, 204, 153);
    doc.rect(margemX + 60, y - 5, larguraValor, 10, "F");
    doc.text(valorTexto, margemX + 64, y);

    y += 12;

    // ===== EXTENSO =====
    const extensoTexto = valorExtenso;
    const larguraExt = doc.getTextWidth(extensoTexto) + 8;
    doc.setFillColor(255, 229, 204);
    doc.rect(margemX + 60, y - 5, larguraExt, 10, "F");
    doc.setFontSize(9);
    doc.text(extensoTexto, margemX + 64, y);

    y += 15;

    // ===== REFERÊNCIA =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Referência:", margemX + 5, y);
    doc.rect(margemX + 30, y - 5, 130, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(ref, margemX + 34, y + 5);

    y += 25;

    // ===== PAGADOR =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Recebemos de:", margemX + 5, y);
    doc.rect(margemX + 35, y - 5, 125, 10);
    doc.setFont("helvetica", "normal");
    doc.text(cliente, margemX + 38, y);

    y += 15;

    // ===== FAVORECIDO =====
    doc.setFont("helvetica", "bold");
    doc.text("Favorecido:", margemX + 5, y);
    doc.rect(margemX + 30, y - 5, 130, 10);
    doc.setFont("helvetica", "normal");
    doc.text("CERÂMICA FORTES LTDA.", margemX + 34, y);

    y += 15;

    // ===== DATA =====
    doc.setFont("helvetica", "bold");
    doc.text("Data:", margemX + 5, y);
    doc.rect(margemX + 20, y - 5, 40, 10);
    doc.setFont("helvetica", "normal");
    doc.text(hoje, margemX + 24, y);

    // ===== ASSINATURA =====
    y += 25;
    doc.line(margemX + 50, y, margemX + 120, y);
    doc.setFontSize(8);
    doc.text("Assinatura do Favorecido", margemX + 85, y + 5, { align: "center" });

    doc.save(`recibo-${cliente}.pdf`);
  });
}
