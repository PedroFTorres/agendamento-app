function renderRecibo() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Recibo</h2>
    <form id="recibo-form" class="bg-white p-4 rounded shadow space-y-3">
      <input id="recibo-cliente" class="border p-2 rounded w-full" placeholder="Nome do cliente" required>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input id="recibo-valor" type="number" step="0.01" class="border p-2 rounded w-full" placeholder="Valor (R$)" required>
        <input id="recibo-ref" class="border p-2 rounded w-full" placeholder="Referente a (opcional)">
      </div>
      <button class="bg-green-600 text-white p-2 rounded w-full">Gerar Recibo (PDF)</button>
    </form>
  `;

  document.getElementById("recibo-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const cliente = document.getElementById("recibo-cliente").value.trim();
    const valorNum = parseFloat(document.getElementById("recibo-valor").value);
    const ref = document.getElementById("recibo-ref").value.trim();

    if (!cliente || isNaN(valorNum)) {
      alert("Preencha o nome e um valor válido.");
      return;
    }

    const valorMoeda = valorNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorExtenso = numeroParaExtensoBRL(valorNum);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== LOGO CENTRAL =====
    try {
      const logo = await fetch("img/logo.png").then(r => r.blob()).then(b => new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(b);
      }));
      doc.addImage(logo, "PNG", 90, 10, 30, 30); // Centralizado
    } catch {}

    // ===== CABEÇALHO =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CERÂMICA FORTES LTDA.", 105, 50, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000 – Cx. Postal 26", 105, 56, { align: "center" });
    doc.text("Fone: (99) 3118-3700 | Fax: (99) 3118-3701", 105, 61, { align: "center" });
    doc.text("E-mail: fortes@fortes.com.br   www.fortes.com.br", 105, 66, { align: "center" });
    doc.text("CNPJ: 06.849.988/0001-44 – I.E: 12.095.413-3", 105, 71, { align: "center" });

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, 75, 190, 75);

    // ===== TÍTULO =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RECIBO", 105, 90, { align: "center" });
    doc.line(85, 93, 125, 93);

    // ===== CORPO =====
    const hoje = new Date().toLocaleDateString("pt-BR");
    let y = 115;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Recebemos de: ${cliente}`, 20, y);
    y += 15;

    // Valor em negrito + cor laranja
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 102, 0); // Laranja
    doc.text(`A importância de: ${valorMoeda}`, 20, y);
    y += 12;

    // Valor por extenso em itálico + cor laranja
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(255, 102, 0); // Laranja
    doc.text(`(${valorExtenso})`, 20, y);
    y += 20;

    // Volta para preto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Referente a: ${ref || "_________________________________________"}`, 20, y);
    y += 15;

    doc.text(`Data: ${hoje}`, 20, y);

    // ===== ASSINATURA =====
    y += 40;
    doc.setLineWidth(0.3);
    doc.line(70, y, 140, y);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Cerâmica Fortes LTDA.", 105, y + 6, { align: "center" });

    doc.save(`recibo-${cliente}.pdf`);
  });
}
