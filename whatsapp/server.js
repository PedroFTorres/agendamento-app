import express from "express";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let sock;
const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);
};

start();

app.post("/send", async (req, res) => {
  const { numbers, message } = req.body;
  const results = [];
  for (const number of numbers) {
    try {
      await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
      results.push({ number, status: "success" });
    } catch {
      results.push({ number, status: "failed" });
    }
  }
  res.json(results);
});

app.listen(3000, () => console.log("Servidor WhatsApp rodando na porta 3000"));
