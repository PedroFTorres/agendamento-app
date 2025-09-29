// ================== Conversor número → extenso (BRL) ==================
function numeroParaExtensoBRL(valor) {
  valor = Number(valor || 0);

  let inteiro = Math.floor(valor);
  let cent = Math.round((valor - inteiro) * 100);
  if (cent === 100) { inteiro += 1; cent = 0; }

  if (inteiro === 0 && cent === 0) return "zero real";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dezenas = ["", "", "vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const centenas = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

  function trioParaExtenso(n) {
    n = n % 1000;
    if (n === 0) return "";

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    let partes = [];
    if (n === 100) return "cem";
    if (c > 0) partes.push(centenas[c]);

    if (d === 1) {
      partes.push(especiais[u]);
    } else {
      if (d > 1) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }

    return partes.join(" e ");
  }

  const escalasSing = ["", "mil", "milhão", "bilhão", "trilhão"];
  const escalasPlural = ["", "mil", "milhões", "bilhões", "trilhões"];

  function inteiroParaExtenso(n) {
    if (n === 0) return "";

    const grupos = [];
    while (n > 0) {
      grupos.push(n % 1000);
      n = Math.floor(n / 1000);
    }

    const partes = [];
    for (let idx = grupos.length - 1; idx >= 0; idx--) {
      const g = grupos[idx];
      if (g === 0) continue;

      let ext = trioParaExtenso(g);
      const singular = g === 1;

      if (idx > 0) {
        if (idx === 1) {
          ext = singular && ext === "um" ? "mil" : `${ext} mil`;
        } else {
          ext += ` ${singular ? escalasSing[idx] : escalasPlural[idx]}`;
        }
      }
      partes.push(ext);
    }

    return partes.length > 1
      ? partes.slice(0, -1).join(", ") + " e " + partes.slice(-1)
      : partes[0];
  }

  const parteInteira = inteiroParaExtenso(inteiro);
  const rotuloReal = inteiro === 1 ? "real" : "reais";

  let resultado = parteInteira ? `${parteInteira} ${rotuloReal}` : "";

  if (cent > 0) {
    const centavosExt = trioParaExtenso(cent);
    const rotuloCent = cent === 1 ? "centavo" : "centavos";
    resultado = resultado
      ? `${resultado} e ${centavosExt} ${rotuloCent}`
      : `${centavosExt} ${rotuloCent}`;
  }

  return resultado;
}

// ================== RENDER RECIBO ==================
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

  document.getElementById("recibo-form").addEventListener("submit", async (e) => {
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
    const alturaCaixa = 130;
    const inicioY = 20;
    doc.rect(margemX, inicioY, larguraCaixa, alturaCaixa);

    let y = inicioY + 15;

    // ===== LOGO E CABEÇALHO =====
    try {
      const logo = await fetch("img/logo.png")
        .then(r => r.blob())
        .then(b => new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(b);
        }));
      doc.addImage(logo, "PNG", margemX + 5, y - 10, 20, 20);
    } catch {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CERÂMICA FORTES LTDA.", margemX + 90, y, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("BR 316 KM 05 S/N – Timon(MA) – CEP 65.630-000", margemX + 90, y + 5, { align: "center" });
    doc.text("Fone: (99) 3118-3700 | Fax: (99) 3118-3701", margemX + 90, y + 10, { align: "center" });
    doc.text("E-mail: fortes@fortes.com.br  www.fortes.com.br", margemX + 90, y + 15, { align: "center" });
    doc.text("CNPJ: 06.849.988/0001-44 – I.E: 12.095.413-3", margemX + 90, y + 20, { align: "center" });

    y += 30;

    // ===== VALOR NUMÉRICO =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Valor do Recibo (R$):", margemX + 5, y);

    const larguraValor = doc.getTextWidth(valorMoeda) + 8;
    doc.setFillColor(255, 204, 153);
    doc.rect(margemX + 60, y - 5, larguraValor, 10, "F");
    doc.text(valorMoeda, margemX + 64, y);

    y += 12;

    // ===== VALOR POR EXTENSO =====
    const larguraExt = doc.getTextWidth(valorExtenso) + 8;
    doc.setFillColor(255, 229, 204);
    doc.rect(margemX + 60, y - 5, larguraExt, 10, "F");
    doc.setFontSize(9);
    doc.text(valorExtenso, margemX + 64, y);

    y += 18;

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
doc.setFont("helvetica", "normal");
doc.text(hoje, margemX + 30, y); // apenas texto, sem caixa



    // ===== ASSINATURA =====
    y += 25;
    doc.line(margemX + 50, y, margemX + 120, y);
    doc.setFontSize(8);
    doc.text("Assinatura do Favorecido", margemX + 85, y + 5, { align: "center" });

    doc.save(`recibo-${cliente}.pdf`);
  });
}
