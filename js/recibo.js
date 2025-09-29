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

    // ===== LOGO (já ficou bom) =====
    try {
      const logo = await fetch("img/logo.png").then(r => r.blob()).then(b => new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(b);
      }));
      doc.addImage(logo, "PNG", 20, 10, 30, 30);
    } catch {}

    // ===== CABEÇALHO (mantido) =====
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
    doc.setFontSize(18);
    doc.text("RECIBO", 105, 65, { align: "center" });

    // ===== CORPO PROFISSIONAL =====
    const hoje = new Date().toLocaleDateString("pt-BR");
    let y = 90;

    // Cliente
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Recebemos de: ${cliente}`, 20, y);
    y += 20;

    // Texto introdutório
    doc.text("A quantia de:", 20, y);
    y += 10;

    // Valor em reais destacado
    const valorTexto = `${valorMoeda}`;
    const larguraValor = doc.getTextWidth(valorTexto) + 10;
    doc.setFillColor(255, 204, 153); // laranja forte
    doc.rect(20, y - 7, larguraValor, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(valorTexto, 24, y);

    y += 18;

    // Valor por extenso destacado
    const extensoTexto = valorExtenso;
    const larguraExt = doc.getTextWidth(extensoTexto) + 10;
    doc.setFillColor(255, 229, 204); // laranja claro
    doc.rect(20, y - 7, larguraExt, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(extensoTexto, 24, y);

    y += 25;

    // Referência
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Referente a: ${ref || "_________________________________________"}`, 20, y);

    y += 15;
    doc.text(`Data: ${hoje}`, 20, y);

    // ===== ASSINATURA =====
    y += 40;
    doc.line(70, y, 140, y);
    doc.setFontSize(10);
    doc.text("Cerâmica Fortes LTDA.", 105, y + 6, { align: "center" });

    doc.save(`recibo-${cliente}.pdf`);
  });
}
