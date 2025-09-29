// ================== RECIBO ==================
function numeroParaExtenso(valor) {
  const extenso = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);

  const partes = extenso.replace("R$", "").trim().split(",");
  let reais = partes[0].trim();
  let centavos = partes[1] || "00";

  return `${reais} reais e ${centavos} centavos`;
}

function renderRecibo() {
  pageContent.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Recibo</h2>
    <form id="recibo-form" class="bg-white p-4 rounded shadow space-y-3">
      <input id="recibo-cliente" class="border p-2 rounded w-full" placeholder="Nome do cliente" required>
      <input id="recibo-valor" type="number" step="0.01" class="border p-2 rounded w-full" placeholder="Valor (R$)" required>
      <button class="bg-green-600 text-white p-2 rounded w-full">Gerar Recibo (PDF)</button>
    </form>
  `;

  document.getElementById("recibo-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const cliente = document.getElementById("recibo-cliente").value.trim();
    const valor = parseFloat(document.getElementById("recibo-valor").value);

    if (!cliente || !valor) {
      alert("Preencha todos os campos!");
      return;
    }

    const valorFormatado = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorExtenso = numeroParaExtenso(valor);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== LOGO =====
    try {
      const logo = await fetch("img/logo.png").then(r => r.blob()).then(b => {
        return new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(b);
        });
      });
      doc.addImage(logo, "PNG", 14, 10, 30, 30);
    } catch {
      console.warn("Logo não encontrada em img/logo.png");
    }

    // ===== CABEÇALHO EMPRESA =====
    doc.setFontSize(14);
    doc.text("CERÂMICA FORTES LTDA.", 50, 20);
    doc.setFontSize(9);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000 – Cx. Postal 26", 50, 26);
    doc.text("Fone: (99) 3118-3700 Fax: (99) 3118-3701", 50, 31);
    doc.text("E-mail: fortes@fortes.com.br   www.fortes.com.br", 50, 36);
    doc.text("CNPJ: 06.849.988/0001-44   I.E: 12.095.413-3", 50, 41);

    // ===== TÍTULO =====
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO", 105, 60, { align: "center" });

    // ===== CORPO =====
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const hoje = new Date().toLocaleDateString("pt-BR");

    doc.text(`Recebemos de: ${cliente}`, 20, 80);
    doc.text(`A importância de: ${valorFormatado} (${valorExtenso})`, 20, 90);
    doc.text(`Referente a: _________________________________________`, 20, 100);
    doc.text(`Data: ${hoje}`, 20, 110);

    // ===== ASSINATURA =====
    doc.line(60, 140, 150, 140);
    doc.text("Assinatura", 105, 145, { align: "center" });

    doc.save(\`recibo-\${cliente}.pdf\`);
  });
}
