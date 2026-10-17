// Código usado pelo app e pelo editor de cartas (escrever.html).
(function () {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = {
    de(buf) {
      const b = new Uint8Array(buf);
      let s = "";
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    },
    para(str) {
      const s = atob(str);
      const b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      return b;
    },
  };

  // "05/03/2024", "5 de março" etc. viram só letras e números minúsculos, sem acento
  function normalizar(t) {
    return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  async function derivar(resposta, saltB64, iter) {
    const base = await crypto.subtle.importKey("raw", enc.encode(normalizar(resposta)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64.para(saltB64), iterations: iter, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }
  async function exportar(chave) {
    return b64.de(await crypto.subtle.exportKey("raw", chave));
  }
  async function importar(raw) {
    return crypto.subtle.importKey("raw", b64.para(raw), "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  async function cifrar(obj, chave) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, enc.encode(JSON.stringify(obj)));
    return { iv: b64.de(iv), dados: b64.de(dados) };
  }
  async function decifrar(pacote, chave) {
    const txt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.para(pacote.iv) }, chave, b64.para(pacote.dados));
    return JSON.parse(dec.decode(txt));
  }
  function novoSalt() {
    return b64.de(crypto.getRandomValues(new Uint8Array(16)));
  }

  const pad = (n) => String(n).padStart(2, "0");
  function fmtData(s) {
    const [y, m, d] = s.split("-");
    return d + "/" + m;
  }
  function fmtHora(h) {
    if (!h) return "";
    const [hh, mm] = h.split(":");
    return Number(hh) + "h" + (mm && mm !== "00" ? mm : "");
  }

  const TIPOS = [
    { tipo: "inicio", rotulo: "Na primeira vez que ela abrir o app" },
    { tipo: "data", rotulo: "Numa data (e hora)" },
    { tipo: "sequencia", rotulo: "Dias SEGUIDOS de estudo" },
    { tipo: "dias", rotulo: "Dias de estudo no total" },
    { tipo: "erros", rotulo: "Erros anotados no caderno" },
    { tipo: "revisoes", rotulo: "Revisões de erros feitas" },
    { tipo: "simulados", rotulo: "Simulados registrados" },
    { tipo: "redacoes", rotulo: "Redações escritas" },
  ];

  function descrever(c) {
    switch (c && c.tipo) {
      case "inicio": return "Abre na primeira vez que você entrar";
      case "data": return "Abre em " + fmtData(c.data) + (c.hora && c.hora !== "00:00" ? " às " + fmtHora(c.hora) : "");
      case "sequencia": return `Abre com ${c.n} dias seguidos de estudo`;
      case "dias": return `Abre com ${c.n} dias de estudo`;
      case "erros": return `Abre com ${c.n} erros anotados no caderno`;
      case "revisoes": return `Abre com ${c.n} revisões feitas`;
      case "simulados": return c.n == 1 ? "Abre quando você registrar o 1º simulado" : `Abre com ${c.n} simulados registrados`;
      case "redacoes": return `Abre com ${c.n} redações escritas`;
      default: return "Surpresa";
    }
  }

  window.Comum = { b64, normalizar, derivar, exportar, importar, cifrar, decifrar, novoSalt, ITER: 310000, TIPOS, descrever, fmtData, fmtHora, pad };
})();
