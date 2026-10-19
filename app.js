/* Missão ENEM — app da Lívia */
(function () {
  "use strict";

  const C = window.CONFIG;
  const AREAS = window.AREAS;
  const TOPICOS = window.TOPICOS;
  const TOP = Object.fromEntries(TOPICOS.map((t) => [t.id, t]));
  const { descrever, fmtData, fmtHora, pad } = window.Comum;
  const D1 = C.prova1;
  const D2 = C.prova2;
  const KEY = "missao-enem-v1";
  const INTERVALOS = [1, 2, 4, 7, 12];
  const INEP_PROVAS = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos";
  const app = document.getElementById("app");

  // ---------- datas ----------
  const PARAMS = new URLSearchParams(location.search);
  const HOJE_FIXO = PARAMS.get("hoje"); // só para testes: ?hoje=2026-11-07
  const iso = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  const hoje = () => HOJE_FIXO || iso(new Date());
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDias = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const diff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
  const diaSemana = (s) => parseISO(s).getDay();
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const horaAgora = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const instanteProva = (d) => new Date(d + "T13:30:00-03:00");

  function fase(d) {
    if (d < D1) return "pre1";
    if (d === D1) return "prova1";
    if (d < D2) return "entre";
    if (d === D2) return "prova2";
    return "fim";
  }

  // ---------- util ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

  const ICO = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    engrenagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  };

  // ---------- estado ----------
  function padrao() {
    return {
      v: 1,
      perfil: { nome: C.nome, curso: "", meta: "", fracas: [] },
      dias: {},
      erros: [],
      simulados: [],
      redacoes: [],
      contadores: { erros: 0, revisoes: 0 },
      melhorSeq: 0,
      checklist: {},
      local: "",
      cartas: { chave: null, liberadas: {}, lidas: {} },
      push: null,
      desafios: {},   // dia -> { acertos, total, rodadas }
      qstats: {},     // questão -> { v: vistas, a: acertos, u: último dia, e: errou da última vez }
      protetores: 0,
      protegidos: {}, // dias salvos por um protetor
      criado: hoje(),
    };
  }
  function carregar() {
    const base = padrao();
    try {
      const salvo = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!salvo) return base;
      for (const k of Object.keys(salvo)) {
        if (salvo[k] === undefined) continue;
        base[k] = base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) ? Object.assign(base[k], salvo[k]) : salvo[k];
      }
    } catch (e) { /* começa do zero */ }
    return base;
  }
  let S = carregar();

  function salvar(opts) {
    S.melhorSeq = Math.max(S.melhorSeq || 0, seqAtual());
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast("Não consegui salvar no aparelho. Faça uma cópia em Ajustes."); }
    if (!opts || !opts.semCartas) checarCartas();
  }

  function dia(d) {
    if (!S.dias[d]) S.dias[d] = { feitas: {}, trocas: {} };
    const x = S.dias[d];
    x.feitas = x.feitas || {};
    x.trocas = x.trocas || {};
    return x;
  }
  const estudou = (d) => { const x = S.dias[d]; return !!x && (!!x.atividade || Object.values(x.feitas || {}).some(Boolean)); };
  function marcarAtividade() { dia(hoje()).atividade = true; }

  // ---------- foguinho (sequência estilo Duolingo) ----------
  // O foguinho do dia acende quando ela completa o desafio de 3 minutos.
  const aceso = (d) => !!(S.desafios[d] || S.protegidos[d]);
  function seqAtual() {
    let d = hoje();
    if (!aceso(d)) d = addDias(d, -1);
    let n = 0;
    while (aceso(d)) { n++; d = addDias(d, -1); }
    return n;
  }
  const diasEstudados = () => Object.keys(S.desafios).length;
  function aplicarProtetor() {
    // perdeu só ontem e tem protetor: ele salva a sequência sozinho
    const ontem = addDias(hoje(), -1);
    if (!aceso(ontem) && (S.protetores || 0) > 0 && aceso(addDias(ontem, -1))) {
      S.protegidos[ontem] = true;
      S.protetores--;
      salvar({ semCartas: true });
      setTimeout(() => toast("Seu protetor 🧊 salvou a sequência de ontem!"), 600);
    }
  }

  // ---------- plano do dia ----------
  function prioridade(t) {
    const todos = S.erros.filter((e) => e.topico === t.id);
    const ativos = todos.filter((e) => !e.dominado).length;
    let p = Math.pow(t.peso, 1.6) * (1 + 0.5 * ativos + 0.15 * todos.length);
    if ((S.perfil.fracas || []).includes(t.area)) p *= 1.35;
    if (S.diagFraca === t.area) p *= 1.25;
    return p;
  }
  function historico(d, janela) {
    // tópicos e áreas que apareceram nos planos dos dias anteriores
    const topicos = {}, areas = {};
    for (const [k, v] of Object.entries(S.dias)) {
      if (k >= d || !v.plano) continue;
      const recente = diff(k, d) <= janela;
      for (const t of v.plano) {
        if (!t.topico) continue;
        topicos[t.topico] = topicos[t.topico] || { total: 0, recente: 0 };
        topicos[t.topico].total++;
        if (recente) { topicos[t.topico].recente++; areas[t.area] = (areas[t.area] || 0) + 1; }
      }
    }
    return { topicos, areas };
  }
  function escolherTopico(d, areas, sal, excluir) {
    const h = historico(d, 4);
    let melhor = null, melhorNota = -1;
    for (const t of TOPICOS) {
      if (!areas.includes(t.area) || excluir.includes(t.id)) continue;
      const ht = h.topicos[t.id] || { total: 0, recente: 0 };
      const jitter = 0.7 + 0.6 * hash(d + "|" + t.id + "|" + sal);
      const nota = (prioridade(t) * jitter) / (1 + 2 * ht.recente + 0.4 * ht.total) / (1 + 0.35 * (h.areas[t.area] || 0));
      if (nota > melhorNota) { melhorNota = nota; melhor = t; }
    }
    return melhor;
  }
  function tarefaEstudo(id, t, areas) {
    return {
      id, tipo: "estudo", topico: t.id, area: t.area, areas,
      titulo: t.nome,
      det: `Foco: ${t.foco}. 30 a 40 min: revise o conteúdo e faça umas 10 questões do ENEM sobre isso.`,
      link: "https://www.google.com/search?q=" + encodeURIComponent("questões ENEM " + t.nome),
      linkTxt: "Achar questões",
    };
  }

  function gerarPlano(d) {
    const f = fase(d);
    const dw = diaSemana(d);
    const ate1 = diff(d, D1), ate2 = diff(d, D2);
    const t = [];

    if (f === "prova1" || f === "prova2") {
      t.push({ id: "chk", tipo: "livre", titulo: "Conferir o checklist do dia", det: "Documento original com foto e caneta preta de tubo transparente. Portões fecham às 13h (Brasília).", ir: "#prova", irTxt: "Abrir checklist" });
      t.push({ id: "carta", tipo: "livre", titulo: "Ler a carta de hoje 💌", det: "Ela abriu hoje cedo.", ir: "#cartas", irTxt: "Ver cartas" });
      t.push(f === "prova1"
        ? { id: "estrat", tipo: "livre", titulo: "Decidir a ordem antes de entrar", det: "90 questões + redação em 5h30. Reserve uns 80 min pra redação e resolva primeiro o que você domina." }
        : { id: "estrat", tipo: "livre", titulo: "Começar pela área que você domina", det: "90 questões em 5h: dá uns 3 min por questão. Não deixe nada em branco." });
      return t;
    }
    if (f === "fim") {
      return [{ id: "fim", tipo: "livre", titulo: "Descansar. Você conseguiu! 🎉", det: "O gabarito oficial sai até o 10º dia útil depois da prova." }];
    }

    const vespera = (f === "pre1" && ate1 === 1) || (f === "entre" && ate2 === 1);
    const antevespera = (f === "pre1" && ate1 === 2) || (f === "entre" && ate2 === 2);

    if (vespera) {
      t.push({ id: "separar", tipo: "livre", titulo: "Separar documento, caneta preta transparente, água e lanche", ir: "#prova", irTxt: "Ver checklist" });
      t.push({ id: "local", tipo: "livre", titulo: "Conferir o local de prova e o caminho", det: "Saia com folga: os portões fecham às 13h em ponto." });
      t.push({ id: "leve", tipo: "livre", titulo: "Revisão leve, só se quiser", det: "Passe o olho no caderno de erros. Nada de conteúdo novo hoje." });
      t.push({ id: "dormir", tipo: "livre", titulo: "Dormir cedo 😴", det: "Descanso também é estudo." });
      return t;
    }

    // simulados no horário real
    if (f === "pre1" && dw === 0 && ate1 >= 7) {
      const primeiro = Math.floor(ate1 / 7) % 2 === 1;
      t.push({
        id: "sim", tipo: "simulado",
        titulo: primeiro ? "Simulado do 1º dia no horário real" : "Simulado do 2º dia no horário real",
        det: primeiro
          ? "13h30 às 19h: Linguagens + Humanas + Redação, com uma prova antiga do INEP. Depois registre os acertos no Raio-X."
          : "13h30 às 18h30: Natureza + Matemática, com uma prova antiga do INEP. Depois registre os acertos no Raio-X.",
        ir: "#simulado", irTxt: "Fazer no app (dá pra pausar)",
        link: INEP_PROVAS, linkTxt: "Provas do INEP",
      });
      return t;
    }
    if (f === "entre" && (ate2 === 5 || ate2 === 3)) {
      const mt = ate2 === 3;
      t.push({
        id: "sim", tipo: "simulado",
        titulo: mt ? "Mini-simulado: 45 questões de Matemática" : "Mini-simulado: 45 questões de Natureza",
        det: "2h30 cronometradas, com uma prova antiga do INEP. Depois anote os erros no caderno.",
        ir: "#simulado", irTxt: "Fazer no app",
        link: INEP_PROVAS, linkTxt: "Provas do INEP",
      });
      return t;
    }

    const areasA = f === "entre" ? ["mt"] : ["mt", "cn"];
    const areasB = f === "entre" ? ["cn"] : ["lc", "ch"];
    const a = escolherTopico(d, areasA, 0, []);
    t.push(tarefaEstudo("A", a, areasA));
    if (!antevespera) {
      const b = escolherTopico(d, areasB, 0, [a.id]);
      t.push(tarefaEstudo("B", b, areasB));
    }

    return t;
  }

  function planoDe(d) {
    const x = dia(d);
    if (!x.plano) { x.plano = gerarPlano(d); salvar({ semCartas: true }); }
    return x.plano;
  }

  // ---------- caderno de erros / revisão ----------
  function limiteArea(area) {
    return (AREAS[area] || {}).dia === 2 ? addDias(D2, -1) : addDias(D1, -1);
  }
  function agendar(area, dias) {
    const amanha = addDias(hoje(), 1);
    let prox = addDias(hoje(), dias);
    const lim = limiteArea(area);
    if (prox > lim) prox = lim < amanha ? amanha : lim;
    return prox;
  }
  const paraRevisar = () => S.erros.filter((e) => !e.dominado && e.proxima <= hoje()).sort((a, b) => (a.proxima < b.proxima ? -1 : 1));
  const nomeTopico = (e) => (TOP[e.topico] ? TOP[e.topico].nome : e.assuntoLivre || "Outro assunto");
  const MOTIVOS = { conteudo: "Não sabia o conteúdo", atencao: "Falta de atenção", tempo: "Faltou tempo", chute: "Chutei" };

  function promptExplicar(e) {
    return `Estou estudando para o ENEM. Errei uma questão de ${nomeTopico(e)} (${AREAS[e.area].nome}).` +
      (e.questao ? ` A questão era: ${e.questao}.` : "") +
      ` O que eu anotei para lembrar: ${e.licao}.` +
      ` Me explica esse conteúdo de um jeito simples, com um exemplo no estilo ENEM e um macete para eu não errar de novo.`;
  }

  // ---------- cartas ----------
  let PACOTE = null; // arquivo cifrado
  let CARTAS = null; // cartas decifradas
  let cartasCarregando = true;
  let filaNovas = [];

  async function carregarCartas() {
    try {
      const r = await fetch("cartas.enc.json", { cache: "no-cache" });
      if (r.ok) PACOTE = await r.json();
    } catch (e) { /* sem cartas ainda */ }
    if (PACOTE && S.cartas.chave) {
      try {
        const chave = await Comum.importar(S.cartas.chave);
        CARTAS = (await Comum.decifrar(PACOTE, chave)).cartas || [];
      } catch (e) {
        S.cartas.chave = null; // cartas recriadas com outra resposta
        salvar({ semCartas: true });
      }
    }
    if (PACOTE && !CARTAS && PACOTE.auto) {
      // sem pergunta secreta: destranca sozinho
      try {
        const chave = await Comum.derivar(PACOTE.auto, PACOTE.salt, PACOTE.iter);
        CARTAS = (await Comum.decifrar(PACOTE, chave)).cartas || [];
        S.cartas.chave = await Comum.exportar(chave);
        salvar({ semCartas: true });
      } catch (e) { /* arquivo corrompido: a aba Cartas mostra a pergunta */ }
    }
    cartasCarregando = false;
    checarCartas();
    render();
  }

  function progresso(c) {
    const cont = (atual, alvo) => ({ ok: atual >= alvo, atual: Math.min(atual, alvo), alvo });
    switch (c.tipo) {
      case "inicio": return { ok: true };
      case "data": return { ok: hoje() > c.data || (hoje() === c.data && horaAgora() >= (c.hora || "00:00")) };
      case "sequencia": return cont(Math.max(S.melhorSeq || 0, seqAtual()), c.n);
      case "dias": return cont(diasEstudados(), c.n);
      case "erros": return cont(Math.max(S.contadores.erros || 0, S.erros.length), c.n);
      case "revisoes": return cont(S.contadores.revisoes || 0, c.n);
      case "simulados": return cont(S.simulados.length, c.n);
      case "redacoes": return cont(S.redacoes.length, c.n);
      default: return { ok: false };
    }
  }
  function checarCartas() {
    if (!CARTAS) return;
    let mudou = false;
    for (const c of CARTAS) {
      if (S.cartas.liberadas[c.id]) continue;
      if (progresso(c.cond).ok) {
        S.cartas.liberadas[c.id] = new Date().toISOString();
        filaNovas.push(c.id);
        mudou = true;
      }
    }
    if (mudou) {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
      setTimeout(mostrarNovaCarta, 350);
    }
  }
  function mostrarNovaCarta() {
    if (document.querySelector(".modal")) return;
    const id = filaNovas.shift();
    if (!id) return;
    const c = CARTAS.find((x) => x.id === id);
    if (!c || S.cartas.lidas[id]) return mostrarNovaCarta();
    confete();
    abrirModal(`
      <div class="envelope-anim" aria-hidden="true">💌</div>
      <h2 style="text-align:center">Carta nova!</h2>
      <p class="muted" style="text-align:center">${esc(C.autor)} deixou uma coisa pra você.</p>
      <div class="linha-btns"><button class="btn" data-acao="abrir-carta" data-id="${esc(id)}">Abrir agora</button>
      <button class="btn ghost" data-acao="fechar-modal">Depois</button></div>`);
  }

  // ---------- telas ----------
  function saudacao() {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }
  function topo(titulo, voltar) {
    if (voltar) {
      return `<div class="topo"><a class="icone-btn" href="${voltar}" aria-label="Voltar">${ICO.voltar}</a><div class="topo-txt"><h1>${titulo}</h1></div></div>`;
    }
    return `<div class="topo"><div class="topo-txt"><div class="eyebrow">Missão ENEM 2026</div><h1>${titulo}</h1></div></div>`;
  }

  function cartaoProximaCarta() {
    if (cartasCarregando) return "";
    if (PACOTE && !CARTAS) {
      return `<div class="card"><div class="eyebrow">Tem coisa escondida aqui</div><h3>💌 ${esc(C.autor)} deixou cartas pra você</h3>
        <p class="muted small">Pra abrir, responda uma perguntinha que só você sabe.</p>
        <a class="btn full" href="#cartas">Responder</a></div>`;
    }
    if (!CARTAS) return "";
    const naoLidas = CARTAS.filter((c) => S.cartas.liberadas[c.id] && !S.cartas.lidas[c.id]);
    if (naoLidas.length) {
      return `<div class="card"><h3>💌 ${plural(naoLidas.length, "carta nova", "cartas novas")} pra ler</h3><a class="btn full" href="#cartas">Abrir</a></div>`;
    }
    const trancadas = CARTAS.filter((c) => !S.cartas.liberadas[c.id] && c.cond.tipo !== "data");
    if (!trancadas.length) return "";
    trancadas.sort((a, b) => { const pa = progresso(a.cond), pb = progresso(b.cond); return (pb.atual / pb.alvo || 0) - (pa.atual / pa.alvo || 0); });
    const c = trancadas[0], p = progresso(c.cond);
    return `<div class="card"><div class="eyebrow">Próxima carta 🔒</div><p style="margin:4px 0 6px;font-weight:800">${esc(descrever(c.cond))}</p>
      ${p.alvo ? `<div class="barrinha"><i style="width:${(100 * p.atual) / p.alvo}%"></i></div><div class="small muted" style="margin-top:4px">${p.atual} de ${p.alvo}</div>` : ""}</div>`;
  }

  function avisoInstalar() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone || S.ocultarInstalar) return "";
    return `<div class="aviso"><b>Instale o app no celular:</b> ${ios
      ? "no Safari, toque em <b>Compartilhar</b> (quadrado com seta) → <b>Adicionar à Tela de Início</b>."
      : "no menu do navegador, toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>."}
      <div style="margin-top:8px"><button class="btn mini" data-acao="ocultar-instalar">Já instalei / depois</button></div></div>`;
  }

  function faixaSemana() {
    // segunda a domingo da semana atual
    const d = hoje();
    const seg = addDias(d, -((diaSemana(d) + 6) % 7));
    const letras = ["S", "T", "Q", "Q", "S", "S", "D"];
    return `<div class="semana">${letras.map((l, i) => {
      const k = addDias(seg, i);
      const est = S.desafios[k] ? "aceso" : S.protegidos[k] ? "protegido" : "";
      return `<div class="dia-sem ${est}${k === d ? " hoje" : ""}${k > d ? " futuro" : ""}"><span>${l}</span><i>${S.desafios[k] ? "🔥" : S.protegidos[k] ? "🧊" : ""}</i></div>`;
    }).join("")}</div>`;
  }

  function cartaoFogo(seq) {
    const d = hoje();
    const ok = !!S.desafios[d];
    const titulo = ok
      ? `${plural(seq, "dia", "dias")} de foguinho! 🔥`
      : seq ? `Não deixa apagar: ${plural(seq, "dia", "dias")} seguidos` : "Acenda seu foguinho de hoje";
    const sub = ok
      ? "Aceso por hoje. Volta amanhã pra manter a sequência."
      : "3 minutos de questões rápidas ou 3 questões reais do ENEM acendem o foguinho do dia.";
    return `<div class="card fogo-card">
      <div class="fogo-topo"><div class="chama${ok ? " acesa" : ""}" aria-hidden="true">🔥</div>
        <div><h3>${titulo}</h3><p class="small muted" style="margin:0">${sub}</p></div></div>
      ${faixaSemana()}
      <div class="linha-btns" style="margin-top:0">
        <a class="btn${ok ? " ghost" : ""}" href="#desafio">⚡ Rápidas (3 min)</a>
        <a class="btn ghost" href="#enem">📝 3 do ENEM real</a>
      </div>
      <a class="btn ghost full" href="#livre" style="margin-top:10px">♾️ Treino livre: quantas quiser</a>
      <div class="small muted fogo-rodape"><span>Recorde: ${plural(Math.max(S.melhorSeq || 0, seq), "dia", "dias")}</span><span>Protetores: ${"🧊".repeat(S.protetores || 0) || "nenhum"}</span></div>
    </div>`;
  }

  // ----- Desafio de 3 minutos -----
  const DURACAO = (PARAMS.get("rapido") ? 12 : 180) * 1000; // ?rapido=1 só para testes
  let DES = null;
  let timerDes = null;

  function rodizioAreas() {
    // ordem das matérias na rodada; as que ela marcou como difíceis aparecem mais
    if (fase(hoje()) === "entre") return ["mt", "cn"]; // entre as provas, só o que falta
    const r = ["mt", "ch", "cn", "lc", "mt", "cn", "ch", "lc"];
    if (S.diagFraca) r.splice(Math.floor(Math.random() * r.length), 0, S.diagFraca);
    for (const a of (S.perfil.fracas || []).filter((x) => x !== "red")) r.splice(Math.floor(Math.random() * r.length), 0, a);
    const ini = Math.floor(Math.random() * r.length);
    return r.slice(ini).concat(r.slice(0, ini));
  }
  function proximaQuestao(usadas, areaAlvo) {
    const Q = window.QUESTOES || [];
    const d = hoje();
    const doPlano = new Set(planoDe(d).filter((t) => t.topico).map((t) => t.topico));
    const temNaArea = Q.some((q) => TOP[q.t] && TOP[q.t].area === areaAlvo && !usadas.has(q.id));
    let melhor = null, nota = -1;
    for (const q of Q) {
      const t = TOP[q.t];
      if (!t || t.area === "red" || usadas.has(q.id)) continue;
      if (temNaArea && t.area !== areaAlvo) continue;
      const st = S.qstats[q.id];
      let p = Math.pow(t.peso, 1.2) * ((S.perfil.fracas || []).includes(t.area) ? 1.3 : 1);
      if (doPlano.has(q.t)) p *= 1.5;
      if (!st) p *= 1.6;
      else if (st.e) p *= diff(st.u, d) >= 1 ? 3 : 0.2; // errou: volta a partir do dia seguinte
      else p *= diff(st.u, d) < 4 ? 0.05 : 0.5;         // acertou: espaça
      p *= 0.6 + 0.8 * Math.random();
      if (p > nota) { nota = p; melhor = q; }
    }
    return melhor;
  }

  function iniciarDesafio() {
    DES = { usadas: new Set(), q: null, resp: null, resta: DURACAO, ultimo: Date.now(), acertos: 0, total: 0, erradas: [], anotadas: {}, fim: false, rodizio: rodizioAreas() };
    DES.q = proximaQuestao(DES.usadas, DES.rodizio[0]);
    if (!DES.q) { DES = null; toast("O banco de questões ainda não carregou."); return; }
    DES.usadas.add(DES.q.id);
    clearInterval(timerDes);
    timerDes = setInterval(tickDesafio, 250);
    render();
  }
  function tickDesafio() {
    if (!DES || DES.fim) { clearInterval(timerDes); timerDes = null; return; }
    const agora = Date.now();
    const dt = Math.min(agora - DES.ultimo, 1000); // app em segundo plano não conta
    DES.ultimo = agora;
    if (DES.resp !== null) return; // relógio pausa enquanto ela lê a explicação
    DES.resta -= dt;
    if (DES.resta <= 0) { terminarDesafio(); return; }
    const barra = document.getElementById("des-barra");
    const txt = document.getElementById("des-tempo");
    if (barra) barra.style.width = (100 * DES.resta) / DURACAO + "%";
    if (txt) { const s = Math.ceil(DES.resta / 1000); txt.textContent = Math.floor(s / 60) + ":" + pad(s % 60); }
  }
  function responderQuestao(i) {
    if (!DES || DES.resp !== null) return;
    const q = DES.q;
    const ok = i === q.c;
    DES.resp = i;
    DES.total++;
    if (ok) DES.acertos++; else { DES.erradas.push(q); DES.anotadas[q.id] = anotarQuestao(q); }
    registrarResposta({ fonte: "rapida", area: TOP[q.t].area, t: q.t, ok });
    const st = S.qstats[q.id] || { v: 0, a: 0 };
    st.v++; if (ok) st.a++;
    st.u = hoje(); st.e = !ok;
    S.qstats[q.id] = st;
    salvar({ semCartas: true });
    render();
  }
  function continuarDesafio() {
    if (!DES) return;
    if (DES.resta <= 0) return terminarDesafio();
    const alvo = DES.rodizio[DES.total % DES.rodizio.length];
    let q = proximaQuestao(DES.usadas, alvo);
    if (!q) { DES.usadas = new Set([DES.q.id]); q = proximaQuestao(DES.usadas, alvo); }
    DES.q = q; DES.resp = null; DES.ultimo = Date.now();
    DES.usadas.add(q.id);
    render();
  }
  function terminarDesafio() {
    if (!DES || DES.fim) return;
    DES.fim = true;
    clearInterval(timerDes); timerDes = null;
    Object.assign(DES, acenderFoguinho(DES.acertos, DES.total));
    render();
    confete();
  }
  // ----- Diagnóstico: a cada 30 respostas mostra onde ela tem mais dificuldade -----
  const DIAG_A_CADA = 30;
  function dificuldade(q) {
    // parâmetro b da TRI (quanto maior, mais difícil); só existe para questões oficiais
    const P = ((window.TRI_PARAMS || {})[q.year] || {})[q._area] || {};
    const par = P[q.index] || P[q.index + "-" + (S.perfil.lingua || "ingles")];
    return par ? par[1] : null;
  }
  function registrarResposta(r) {
    S.respostas = S.respostas || [];
    S.respostas.push(Object.assign({ d: hoje() }, r));
    if (S.respostas.length > 600) S.respostas.splice(0, S.respostas.length - 600);
    S.diagTotal = (S.diagTotal || 0) + 1;
    if (S.diagTotal - (S.diagUltimo || 0) >= DIAG_A_CADA) S.diagPendente = true;
  }
  function calcularDiagnostico(lista) {
    const por = {};
    for (const r of lista) {
      por[r.area] = por[r.area] || { n: 0, ok: 0 };
      por[r.area].n++; if (r.ok) por[r.area].ok++;
    }
    const areas = Object.entries(por).filter(([, v]) => v.n >= 3).map(([a, v]) => ({ a, n: v.n, ok: v.ok, pct: Math.round((100 * v.ok) / v.n) })).sort((x, y) => x.pct - y.pct);
    const assuntos = {};
    for (const r of lista) if (r.t && !r.ok) assuntos[r.t] = (assuntos[r.t] || 0) + 1;
    const piores = Object.entries(assuntos).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([t, n]) => ({ t, n }));
    const faceis = lista.filter((r) => r.b != null && r.b < 1 && !r.ok).length;
    const tempos = lista.filter((r) => r.seg).map((r) => r.seg);
    const ritmo = tempos.length >= 3 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
    const total = lista.length, certas = lista.filter((r) => r.ok).length;
    return { areas, piores, faceis, ritmo, total, certas, pior: areas[0] && areas[0].pct < 70 ? areas[0].a : null };
  }
  function htmlDiagnostico(dg, titulo) {
    if (!dg.total) return `<p class="muted">Responda algumas questões que o diagnóstico aparece aqui.</p>`;
    const dicas = [];
    if (dg.pior) dicas.push(`<b>${AREAS[dg.pior].nome}</b> é onde você mais está errando agora. O plano do dia vai puxar mais essa área.`);
    if (dg.piores.length) dicas.push(`Assuntos que mais apareceram nos erros: ${dg.piores.map((x) => `<b>${esc(TOP[x.t] ? TOP[x.t].nome : x.t)}</b> (${x.n})`).join(", ")}.`);
    if (dg.faceis >= 2) dicas.push(`Você errou <b>${dg.faceis} questões consideradas fáceis</b> pela TRI. Na nota elas pesam muito: pode ser pressa ou falta de atenção, lê o enunciado até o fim.`);
    if (dg.ritmo != null) dicas.push(dg.ritmo > 210 ? `Seu ritmo nas questões reais está em <b>${Math.floor(dg.ritmo / 60)}min${pad(dg.ritmo % 60)}</b> por questão. Na prova o ideal é uns 3 min: pule as difíceis e volte depois.` : `Seu ritmo nas questões reais está ótimo: <b>${Math.floor(dg.ritmo / 60)}min${pad(dg.ritmo % 60)}</b> por questão.`);
    if (!dicas.length) dicas.push("Tudo equilibrado! Continua no ritmo que está dando certo. 💪");
    return `${titulo ? `<h2 style="text-align:center">${titulo}</h2>` : ""}
      <p style="text-align:center;font-size:18px;margin:4px 0 12px"><b>${dg.certas}</b> de <b>${dg.total}</b> certas (${Math.round((100 * dg.certas) / dg.total)}%)</p>
      ${dg.areas.map((x) => `<div class="small" style="margin-bottom:8px"><b>${AREAS[x.a].nome}</b>: ${x.ok} de ${x.n} (${x.pct}%)
        <div class="barrinha"><i style="width:${x.pct}%;background:${AREAS[x.a].cor}"></i></div></div>`).join("")}
      <ul class="dicas" style="padding-left:20px;margin:12px 0 0">${dicas.map((d) => `<li>${d}</li>`).join("")}</ul>`;
  }
  function mostrarDiagnostico() {
    if (!S.diagPendente || document.querySelector(".modal")) return;
    const lista = (S.respostas || []).slice(-DIAG_A_CADA);
    const dg = calcularDiagnostico(lista);
    S.diagPendente = false;
    S.diagUltimo = S.diagTotal;
    S.diagFraca = dg.pior;
    salvar({ semCartas: true });
    abrirModal(`<div class="envelope-anim" aria-hidden="true">🩺</div>
      ${htmlDiagnostico(dg, "Seu raio-x das últimas 30")}
      <div class="linha-btns">${dg.pior ? `<button class="btn" data-acao="fechar-modal-ir" data-href="#livre/enem-${dg.pior}">Treinar ${AREAS[dg.pior].nome}</button>` : ""}<button class="btn ghost" data-acao="fechar-modal">Fechar</button></div>`);
  }

  // registra a rodada do dia; a primeira do dia acende o foguinho
  function acenderFoguinho(acertos, total) {
    const d = hoje();
    const primeiro = !S.desafios[d];
    const reg = S.desafios[d] || { acertos: 0, total: 0, rodadas: 0 };
    reg.acertos += acertos; reg.total += total; reg.rodadas++;
    S.desafios[d] = reg;
    let ganhouProtetor = false;
    const seq = seqAtual();
    if (primeiro && seq > 0 && seq % 7 === 0 && (S.protetores || 0) < 2) {
      S.protetores = (S.protetores || 0) + 1;
      ganhouProtetor = true;
    }
    salvar();
    return { primeiro, ganhouProtetor };
  }

  // ----- ENEM de verdade: provas 2009–2023 (API pública api.enem.dev) -----
  const API_ENEM = "https://api.enem.dev/v1/exams";
  const ANOS = Array.from({ length: 11 }, (_, k) => 2015 + k); // 2015 a 2025 (2024 e 2025 vêm dos PDFs do INEP, ver provas/recentes.js)
  if (window.TRI_PARAMS && window.TRI_RECENTES) Object.assign(window.TRI_PARAMS, window.TRI_RECENTES);
  const POR_RODADA = 3;
  let EN = null;
  let enemArea = "mix";
  let timerEnem = null;

  // A área sai do número da questão (a API às vezes erra a disciplina).
  // Até 2016: 1-45 Humanas, 46-90 Natureza, 91-135 Linguagens. De 2017 em diante: 1-45 Linguagens, 46-90 Humanas, 91-135 Natureza.
  function faixaEnem(area, ano) {
    const novo = ano >= 2017;
    const ini = { lc: novo ? 1 : 91, ch: novo ? 46 : 1, cn: novo ? 91 : 46, mt: 136 }[area];
    return [ini, ini + 44];
  }
  function areaDaQuestao(ano, i) {
    return ["lc", "ch", "cn", "mt"].find((a) => { const [x, y] = faixaEnem(a, ano); return i >= x && i <= y; });
  }
  const ehLingua = (ano, i) => (ano >= 2017 ? i <= 5 : i >= 91 && i <= 95);
  function sortearEnem(area, evitar) {
    S.enem = S.enem || { vistas: {} };
    for (let k = 0; k < 60; k++) {
      const ano = ANOS[Math.floor(Math.random() * ANOS.length)];
      const [a, b] = faixaEnem(area, ano);
      const i = a + Math.floor(Math.random() * (b - a + 1));
      const k2 = ano + "-" + i;
      if (S.enem.vistas[k2] || k2 === evitar) continue;
      return { ano, i };
    }
    return null;
  }
  async function buscarEnem(ano, i) {
    const recentes = (window.PROVAS_RECENTES || {})[ano];
    if (recentes) {
      // 2024 e 2025: a questão é a imagem recortada do caderno oficial
      const lg = ehLingua(ano, i) ? S.perfil.lingua || "ingles" : null;
      const m = recentes[lg ? i + "-" + lg : String(i)];
      if (!m || !m.g) throw new Error("incompleta");
      return {
        year: ano, index: i, _area: areaDaQuestao(ano, i), _img: m.img, _txt: m.txt || null,
        context: "", files: [], alternativesIntroduction: "", correctAlternative: m.g,
        alternatives: ["A", "B", "C", "D", "E"].map((l) => ({ letter: l, text: "" })),
      };
    }
    let url = `${API_ENEM}/${ano}/questions/${i}`;
    if (ehLingua(ano, i)) url += "?language=" + (ano === 2011 ? "espanhol" : S.perfil.lingua || "ingles");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const q = await r.json();
      if (!Array.isArray(q.alternatives) || q.alternatives.length < 2 || !q.correctAlternative) throw new Error("incompleta");
      q._area = areaDaQuestao(ano, i);
      return q;
    } finally { clearTimeout(to); }
  }
  async function proximaEnem(area, evitar) {
    for (let t = 0; t < 4; t++) {
      const s = sortearEnem(area, evitar);
      if (!s) return null;
      try { return await buscarEnem(s.ano, s.i); }
      catch (e) { if (String(e).includes("429")) await new Promise((r) => setTimeout(r, 2500)); }
    }
    throw new Error("sem conexão");
  }
  const chaveEnem = (q) => q.year + "-" + q.index;

  // markdown simples da API: imagens, negrito, itálico e parágrafos
  function md(txt) {
    if (!txt) return "";
    let h = esc(String(txt).replace(/[​‌‍]/g, ""));
    h = h.replace(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g, '<img class="enem-img" src="$1" alt="" loading="lazy">');
    h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/g, "$1<i>$2</i>");
    return h.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  }
  function htmlQuestaoEnem(q, resp, acao, marcada) {
    const area = AREAS[q._area] || AREAS.lc;
    const ctx = q.context || "";
    const extras = (q.files || []).filter((f) => /^https:\/\//.test(f) && !ctx.includes(f)).map((f) => `<img class="enem-img" src="${esc(f)}" alt="" loading="lazy">`).join("");
    const alts = q.alternatives.map((a) => {
      let cls = "";
      if (resp) cls = a.letter === q.correctAlternative ? " certa" : a.letter === resp ? " errada-alt" : " apagada";
      else if (marcada === a.letter) cls = " marcada";
      const corpo = a.file && /^https:\/\//.test(a.file) ? `<img class="enem-img" src="${esc(a.file)}" alt="Alternativa ${a.letter}" loading="lazy">` : esc((a.text || "").replace(/[​‌‍]/g, ""));
      return `<button class="alt${cls}" ${acao ? `data-acao="${acao}" data-l="${a.letter}"` : ""} ${resp || !acao ? "disabled" : ""}><span class="letra">${a.letter}</span><span>${corpo}</span></button>`;
    }).join("");
    if (q._img) {
      return `<div class="card enem-q">
        <div style="margin-bottom:8px"><span class="chip" style="color:${area.cor}">${area.curto}</span><span class="small muted">ENEM ${q.year} · questão ${q.index}</span></div>
        ${q._txt ? `<details class="texto-base" open><summary>Texto-base desta questão</summary><img class="prova-img" src="${esc(q._txt)}" alt="Texto-base" loading="lazy"></details>` : ""}
        <img class="prova-img" src="${esc(q._img)}" alt="Questão ${q.index} do ENEM ${q.year}">
        <div class="alts alts-letras">${alts}</div>
      </div>`;
    }
    return `<div class="card enem-q">
      <div style="margin-bottom:8px"><span class="chip" style="color:${area.cor}">${area.curto}</span><span class="small muted">ENEM ${q.year} · questão ${q.index}</span></div>
      <div class="enem-texto">${md(ctx)}${extras}</div>
      <div class="pergunta enem-enunciado">${md(q.alternativesIntroduction)}</div>
      <div class="alts">${alts}</div>
    </div>`;
  }
  function promptEnem(q) {
    if (q._img) return `Estou estudando para o ENEM. Me explica a questão ${q.index} do ENEM ${q.year} (caderno azul), passo a passo e de um jeito simples, e me dá um macete para questões parecidas. O gabarito oficial é ${q.correctAlternative}. Se precisar, eu te mando a foto da questão.`;
    const alts = q.alternatives.map((a) => `${a.letter}) ${a.text || "[imagem]"}`).join(" ");
    const txt = `${q.context || ""} ${q.alternativesIntroduction || ""}`.replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagem]").replace(/\s+/g, " ").trim();
    return `Estou estudando para o ENEM. Me explica a questão ${q.index} do ENEM ${q.year}, passo a passo e de um jeito simples, e me dá um macete para questões parecidas. Enunciado: ${txt.slice(0, 1400)} Alternativas: ${alts.slice(0, 600)} Gabarito oficial: ${q.correctAlternative}.`;
  }

  async function carregarEnem() {
    const en = EN;
    en.carregando = true; en.erro = null; en.resp = null;
    render();
    try {
      const area = en.rod[en.feitos % en.rod.length];
      let q = null;
      if (en.prox && en.proxArea === area) q = await en.prox.catch(() => null);
      if (!q) q = await proximaEnem(area);
      if (EN !== en) return;
      if (!q) throw new Error("acabaram");
      en.q = q;
      en.inicio = Date.now();
      en.carregando = false;
      // já deixa a próxima a caminho
      const pa = en.rod[(en.feitos + 1) % en.rod.length];
      en.proxArea = pa;
      en.prox = proximaEnem(pa, chaveEnem(q));
      en.prox.catch(() => {});
    } catch (e) {
      if (EN !== en) return;
      en.carregando = false;
      en.erro = "Não consegui buscar a questão. Confere a internet e tenta de novo.";
    }
    if (EN === en && location.hash.startsWith("#enem")) render();
  }
  function iniciarEnem() {
    const rod = enemArea === "mix" ? rodizioAreas().filter((a) => a !== "red") : [enemArea];
    EN = { rod, feitos: 0, acertos: 0, q: null, resp: null, erradas: [], anotadas: {}, fim: false };
    clearInterval(timerEnem);
    timerEnem = setInterval(tickEnem, 1000);
    carregarEnem();
  }
  function tickEnem() {
    const el = document.getElementById("en-tempo");
    if (!EN || !el || EN.resp || EN.carregando) return;
    const s = Math.floor((Date.now() - EN.inicio) / 1000);
    el.textContent = Math.floor(s / 60) + ":" + pad(s % 60);
    el.classList.toggle("passou", s > 180);
  }
  function responderEnem(letra) {
    const q = EN && EN.q;
    if (!q || EN.resp) return;
    EN.resp = letra;
    EN.tempo = Math.round((Date.now() - EN.inicio) / 1000);
    const ok = letra === q.correctAlternative;
    EN.feitos++;
    if (ok) EN.acertos++; else { EN.erradas.push(q); EN.anotadas[chaveEnem(q)] = anotarEnem(q); }
    registrarResposta({ fonte: "enem", area: q._area, ok, b: dificuldade(q), seg: EN.tempo });
    S.enem = S.enem || { vistas: {} };
    S.enem.vistas[chaveEnem(q)] = { ok, d: hoje(), a: q._area, t: EN.tempo };
    salvar({ semCartas: true });
    render();
  }
  function continuarEnem() {
    if (EN.feitos > 0 && EN.feitos % POR_RODADA === 0 && !EN.fim) {
      EN.fim = true;
      clearInterval(timerEnem); timerEnem = null;
      Object.assign(EN, acenderFoguinho(EN.acertos, EN.feitos));
      render();
      confete();
      return;
    }
    carregarEnem();
  }
  function anotarEnem(q) {
    const ja = S.erros.find((e) => !e.dominado && e.ref && e.ref.ano === q.year && e.ref.i === q.index);
    if (ja) return ja.id;
    const id = uid();
    const certa = q.alternatives.find((a) => a.letter === q.correctAlternative) || {};
    const enun = `${q.alternativesIntroduction || ""}`.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    S.erros.push({
      id, data: hoje(), caixa: 0, proxima: agendar(q._area, 1), dominado: false,
      area: q._area, topico: "outro", assuntoLivre: `ENEM ${q.year} · questão ${q.index}`,
      questao: enun.slice(0, 220), motivo: "",
      licao: `Resposta ${q.correctAlternative}: ${(certa.text || "ver a imagem da alternativa").slice(0, 160)}`,
      ref: { ano: q.year, i: q.index },
    });
    S.contadores.erros = (S.contadores.erros || 0) + 1;
    salvar();
    return id;
  }
  function statsEnem() {
    const v = Object.values((S.enem && S.enem.vistas) || {});
    const por = {};
    for (const x of v) { por[x.a] = por[x.a] || { n: 0, ok: 0 }; por[x.a].n++; if (x.ok) por[x.a].ok++; }
    return { n: v.length, ok: v.filter((x) => x.ok).length, por };
  }

  function telaEnem(arg) {
    if (!EN) {
      if (arg && arg !== argAplicado && AREAS[arg] && arg !== "red") { argAplicado = arg; enemArea = arg; }
      const st = statsEnem();
      const chips = [["mix", "Misturado"], ["mt", "Matemática"], ["cn", "Natureza"], ["ch", "Humanas"], ["lc", "Linguagens"]]
        .map(([k, n]) => `<button class="opcao" data-acao="enem-area" data-area="${k}" aria-pressed="${enemArea === k}">${n}</button>`).join("");
      const ok = !!S.desafios[hoje()];
      return `${topo("ENEM de verdade", "#hoje")}
        <div class="card">
          <p>Questões reais das provas do ENEM de <b>2015 a 2023</b>, com o gabarito oficial. Responda <b>3</b> pra ${ok ? "treinar (o foguinho de hoje já está aceso)" : "acender o foguinho de hoje 🔥"}.</p>
          <p class="small muted">Tente fazer cada uma em até 3 minutos, o ritmo da prova. O relógio aparece no topo.</p>
          <label class="campo"><span>Área</span></label>
          <div class="opcoes" style="margin:-6px 0 14px">${chips}</div>
          <button class="btn full" data-acao="enem-iniciar">Começar</button>
          <p class="small muted" style="margin:10px 0 0">Precisa de internet. As questões vêm do acervo público <a href="https://enem.dev" target="_blank" rel="noopener">enem.dev</a>.</p>
        </div>
        ${st.n ? `<div class="card"><div class="eyebrow">Seu histórico</div>
          <p style="margin:6px 0 10px"><b>${st.n}</b> questões reais respondidas · <b>${Math.round((100 * st.ok) / st.n)}%</b> de acerto</p>
          ${["mt", "cn", "ch", "lc"].filter((a) => st.por[a]).map((a) => `<div class="small" style="margin-bottom:6px">${AREAS[a].nome}: ${st.por[a].ok}/${st.por[a].n}
            <div class="barrinha"><i style="width:${(100 * st.por[a].ok) / st.por[a].n}%;background:${AREAS[a].cor}"></i></div></div>`).join("")}
        </div>` : ""}`;
    }
    if (EN.fim) {
      const seq = seqAtual();
      return `
        <div class="card" style="text-align:center;margin-top:10px">
          <div class="chama acesa explode" aria-hidden="true">🔥</div>
          <h2>${EN.primeiro ? "Foguinho aceso!" : "Mais uma rodada feita!"}</h2>
          <p style="font-size:20px;margin:6px 0 2px"><b>${plural(seq, "dia", "dias")}</b> ${seq === 1 ? "de foguinho" : "seguidos"}</p>
          <p class="muted">${EN.acertos} de ${EN.feitos} questões reais do ENEM certas</p>
          ${EN.ganhouProtetor ? `<p class="aviso" style="margin:12px 0"><b>Ganhou um protetor 🧊</b> Se um dia você não conseguir estudar, ele salva a sequência sozinho.</p>` : ""}
          ${faixaSemana()}
        </div>
        <div class="linha-btns"><button class="btn" data-acao="enem-sair">Voltar pro plano</button><button class="btn ghost" data-acao="enem-mais">Mais 3</button></div>`;
    }
    const topoEn = `<div class="des-topo">
        <button class="icone-btn" data-acao="enem-sair" aria-label="Sair">✕</button>
        <div class="small muted">Questão ${EN.resp ? ((EN.feitos - 1) % POR_RODADA) + 1 : (EN.feitos % POR_RODADA) + 1} de ${POR_RODADA} · ${EN.acertos} certas</div>
        <b id="en-tempo" class="mono">0:00</b>
      </div>`;
    if (EN.carregando) return `${topoEn}<div class="card vazio"><div class="grande">📝</div>Buscando uma questão do ENEM…</div>`;
    if (EN.erro) return `${topoEn}<div class="card vazio"><div class="grande">📡</div><p>${esc(EN.erro)}</p><button class="btn" data-acao="enem-tentar">Tentar de novo</button></div>`;
    const q = EN.q;
    const certo = EN.resp === q.correctAlternative;
    const ultima = EN.feitos > 0 && EN.feitos % POR_RODADA === 0;
    return `${topoEn}
      ${htmlQuestaoEnem(q, EN.resp, "enem-responder")}
      ${EN.resp ? `<div class="feedback ${certo ? "ok" : "nao"}">
        <b>${certo ? "Acertou! 🎉" : "A certa é a " + q.correctAlternative}</b>
        <p class="small">Você levou ${Math.floor(EN.tempo / 60)}:${pad(EN.tempo % 60)}${EN.tempo > 180 ? " (passou dos 3 min, tudo bem: é treino)" : ""}.</p>
        <div class="linha-btns">
          <a class="btn ghost" href="https://chatgpt.com/?q=${encodeURIComponent(promptEnem(q))}" target="_blank" rel="noopener">Explicar</a>
          ${certo ? "" : EN.anotadas[chaveEnem(q)] ? `<span class="small" style="font-weight:800">📒 Foi pro caderno de erros</span><button class="btn mini" data-acao="enem-desfazer">Desfazer</button>` : `<button class="btn ghost" data-acao="enem-anotar">Anotar no caderno</button>`}
          <button class="btn" data-acao="enem-continuar">${ultima ? "Ver resultado" : "Próxima"}</button>
        </div>
      </div>` : ""}`;
  }

  // ----- Treino livre: sem rodadas e sem relógio, até ela cansar -----
  let LV = null;
  let livreFonte = "enem";
  let livreArea = "mix";
  let argAplicado = null; // o atalho da URL vale só uma vez, depois manda o que ela tocar

  function iniciarLivre() {
    const rod = livreArea === "mix" ? rodizioAreas() : [livreArea];
    LV = { fonte: livreFonte, rod, feitos: 0, acertos: 0, q: null, resp: null, usadas: new Set(), anotadas: {}, acendeu: false, fim: false };
    carregarLivre();
  }
  async function carregarLivre() {
    const lv = LV;
    const area = lv.rod[lv.feitos % lv.rod.length];
    lv.resp = null;
    lv.erro = null;
    if (lv.fonte === "rapidas") {
      let q = proximaQuestao(lv.usadas, area);
      if (!q) { lv.usadas = new Set(); q = proximaQuestao(lv.usadas, area); }
      lv.q = q;
      if (q) lv.usadas.add(q.id);
      render();
      return;
    }
    lv.carregando = true;
    render();
    try {
      let q = null;
      if (lv.prox && lv.proxArea === area) q = await lv.prox.catch(() => null);
      if (!q) q = await proximaEnem(area);
      if (LV !== lv) return;
      if (!q) throw new Error("acabaram");
      lv.q = q;
      lv.carregando = false;
      const pa = lv.rod[(lv.feitos + 1) % lv.rod.length];
      lv.proxArea = pa;
      lv.prox = proximaEnem(pa, chaveEnem(q));
      lv.prox.catch(() => {});
    } catch (e) {
      if (LV !== lv) return;
      lv.carregando = false;
      lv.erro = "Não consegui buscar a questão. Confere a internet e tenta de novo.";
    }
    if (LV === lv && location.hash.startsWith("#livre")) render();
  }
  function responderLivre(resp) {
    const lv = LV, q = lv && lv.q;
    if (!q || lv.resp !== null) return;
    lv.resp = resp;
    lv.feitos++;
    let ok;
    if (lv.fonte === "rapidas") {
      ok = resp === q.c;
      const st = S.qstats[q.id] || { v: 0, a: 0 };
      st.v++; if (ok) st.a++; st.u = hoje(); st.e = !ok;
      S.qstats[q.id] = st;
      if (!ok) lv.anotadas[q.id] = anotarQuestao(q);
    } else {
      ok = resp === q.correctAlternative;
      S.enem = S.enem || { vistas: {} };
      S.enem.vistas[chaveEnem(q)] = { ok, d: hoje(), a: q._area };
      if (!ok) lv.anotadas[chaveEnem(q)] = anotarEnem(q);
    }
    if (ok) lv.acertos++;
    registrarResposta(lv.fonte === "rapidas" ? { fonte: "rapida", area: TOP[q.t].area, t: q.t, ok } : { fonte: "enem", area: q._area, ok, b: dificuldade(q) });
    // as 3 primeiras do dia já acendem o foguinho
    if (lv.feitos === 3 && !lv.acendeu) {
      lv.acendeu = true;
      if (!S.desafios[hoje()]) {
        acenderFoguinho(lv.acertos, lv.feitos);
        confete();
        setTimeout(() => toast("🔥 Foguinho aceso! Continua quanto quiser."), 300);
      }
    }
    salvar({ semCartas: true });
    render();
  }

  function telaLivre(arg) {
    if (!LV) {
      if (arg && arg !== argAplicado) {
        argAplicado = arg;
        const [f, a] = arg.split("-");
        if (f === "enem" || f === "rapidas") livreFonte = f;
        if (a === "mix" || (AREAS[a] && a !== "red")) livreArea = a;
      }
      const chipsF = [["enem", "📝 ENEM real (2015–2023)"], ["rapidas", "⚡ Rápidas, com explicação"]]
        .map(([k, n]) => `<button class="opcao" data-acao="livre-fonte" data-f="${k}" aria-pressed="${livreFonte === k}">${n}</button>`).join("");
      const chipsA = [["mix", "Misturado"], ["mt", "Matemática"], ["cn", "Natureza"], ["ch", "Humanas"], ["lc", "Linguagens"]]
        .map(([k, n]) => `<button class="opcao" data-acao="livre-area" data-area="${k}" aria-pressed="${livreArea === k}">${n}</button>`).join("");
      return `${topo("Treino livre", "#hoje")}
        <div class="card">
          <p>Sem relógio e sem rodada: responde quantas quiser e para quando cansar. As 3 primeiras do dia já acendem o foguinho 🔥</p>
          <label class="campo"><span>Questões</span></label>
          <div class="opcoes" style="margin:-6px 0 14px">${chipsF}</div>
          <label class="campo"><span>Área</span></label>
          <div class="opcoes" style="margin:-6px 0 14px">${chipsA}</div>
          <button class="btn full" data-acao="livre-iniciar">Começar</button>
          <p class="small muted" style="margin:10px 0 0">Errou? Vai sozinha pro caderno de erros. ${livreFonte === "enem" ? "As questões do ENEM real precisam de internet." : ""}</p>
        </div>`;
    }
    if (LV.fim) {
      const pct = LV.feitos ? Math.round((100 * LV.acertos) / LV.feitos) : 0;
      const cad = Object.values(LV.anotadas).filter(Boolean).length;
      return `<div class="card" style="text-align:center;margin-top:10px">
          <div class="chama${S.desafios[hoje()] ? " acesa" : ""}" style="font-size:72px" aria-hidden="true">🔥</div>
          <h2>Treino feito!</h2>
          <p style="font-size:20px;margin:6px 0 2px"><b>${LV.feitos}</b> ${LV.feitos === 1 ? "questão" : "questões"} · <b>${LV.acertos}</b> certas (${pct}%)</p>
          ${cad ? `<p class="muted">${plural(cad, "foi pro caderno", "foram pro caderno")} pra revisar.</p>` : ""}
          ${faixaSemana()}
        </div>
        <div class="linha-btns"><button class="btn" data-acao="livre-sair">Voltar pro plano</button><button class="btn ghost" data-acao="livre-continuar-treino">Continuar treinando</button></div>`;
    }
    const topoLv = `<div class="des-topo">
        <button class="icone-btn" data-acao="livre-encerrar" aria-label="Encerrar treino">✕</button>
        <div class="small muted">${LV.feitos} feitas · ${LV.acertos} certas</div>
        <button class="btn mini" data-acao="livre-encerrar">Encerrar</button>
      </div>`;
    if (LV.carregando) return `${topoLv}<div class="card vazio"><div class="grande">📝</div>Buscando uma questão do ENEM…</div>`;
    if (LV.erro) return `${topoLv}<div class="card vazio"><div class="grande">📡</div><p>${esc(LV.erro)}</p><button class="btn" data-acao="livre-tentar">Tentar de novo</button></div>`;
    const q = LV.q;
    if (!q) return `${topoLv}<div class="card vazio">Sem questões dessa área agora.</div>`;
    const respondida = LV.resp !== null;
    let corpo, certo, chave, explicacao;
    if (LV.fonte === "rapidas") {
      const t = TOP[q.t], area = AREAS[t.area];
      certo = LV.resp === q.c; chave = q.id;
      corpo = `<div class="card">
        <div><span class="chip" style="color:${area.cor}">${area.curto}</span><span class="small muted">${esc(t.nome)}</span></div>
        <p class="pergunta">${esc(q.q)}</p>
        <div class="alts">${q.a.map((alt, i) => {
          let cls = "";
          if (respondida) cls = i === q.c ? " certa" : i === LV.resp ? " errada-alt" : " apagada";
          return `<button class="alt${cls}" data-acao="livre-responder" data-r="${i}" ${respondida ? "disabled" : ""}><span class="letra">${"ABCDE"[i]}</span><span>${esc(alt)}</span></button>`;
        }).join("")}</div></div>`;
      explicacao = `<p>${esc(q.e)}</p>`;
    } else {
      certo = LV.resp === q.correctAlternative; chave = chaveEnem(q);
      corpo = htmlQuestaoEnem(q, respondida ? LV.resp : null, "livre-responder");
      explicacao = `<div class="linha-btns" style="margin-top:6px"><a class="btn mini" href="https://chatgpt.com/?q=${encodeURIComponent(promptEnem(q))}" target="_blank" rel="noopener">Pedir explicação</a></div>`;
    }
    return `${topoLv}${corpo}
      ${respondida ? `<div class="feedback ${certo ? "ok" : "nao"}">
        <b>${certo ? "Isso! 🎉" : "A certa é a " + (LV.fonte === "rapidas" ? "ABCDE"[q.c] : q.correctAlternative)}</b>
        ${explicacao}
        <div class="linha-btns">
          ${certo ? "" : LV.anotadas[chave] ? `<span class="small" style="font-weight:800">📒 Foi pro caderno de erros</span><button class="btn mini" data-acao="livre-desfazer">Desfazer</button>` : `<button class="btn ghost" data-acao="livre-anotar">Anotar no caderno</button>`}
          <button class="btn" data-acao="livre-proxima">Próxima</button>
        </div>
      </div>` : ""}`;
  }

  // ----- Simulado completo (prova real) com pausa e nota pela TRI -----
  const TIPOS_SIM = {
    d1: { nome: "1º dia", desc: "Linguagens + Humanas · 90 questões", areas: ["lc", "ch"] },
    d2: { nome: "2º dia", desc: "Natureza + Matemática · 90 questões", areas: ["cn", "mt"] },
    lc: { nome: "Só Linguagens", desc: "45 questões", areas: ["lc"] },
    ch: { nome: "Só Humanas", desc: "45 questões", areas: ["ch"] },
    cn: { nome: "Só Natureza", desc: "45 questões", areas: ["cn"] },
    mt: { nome: "Só Matemática", desc: "45 questões", areas: ["mt"] },
  };
  const ANOS_SIM = ANOS.slice().reverse();
  let SIM = null; // id do simulado aberto na tela
  let simAno = 2025, simTipo = "d1", simMapa = false, simCarregando = false, simErro = null, simNovas = 0;
  const SIMQ = {}; // questões já baixadas: "ano-i"
  let timerSim = null, simUltimo = 0, simUltimoSalvo = 0, simPrefetch = false;

  const fmtTempo = (ms) => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + "h" + pad(m % 60); };
  function criarSimulado(ano, tipo) {
    const ordem = [];
    for (const a of TIPOS_SIM[tipo].areas) { const [x, y] = faixaEnem(a, ano); for (let i = x; i <= y; i++) ordem.push(i); }
    S.sims = S.sims || {};
    const id = ano + "-" + tipo;
    S.sims[id] = { id, ano, tipo, ordem, pos: 0, resp: {}, gab: {}, anuladas: {}, tempo: 0, inicio: hoje(), fim: null, lingua: S.perfil.lingua || "ingles" };
    salvar({ semCartas: true });
    return id;
  }
  async function questaoSim(sim, pos) {
    const i = sim.ordem[pos], k = sim.ano + "-" + i;
    if (SIMQ[k]) return SIMQ[k];
    const q = await buscarEnem(sim.ano, i);
    SIMQ[k] = q;
    sim.gab[i] = q.correctAlternative;
    return q;
  }
  function abrirSim(id) {
    SIM = id; simMapa = false; simNovas = 0;
    simUltimo = Date.now();
    clearInterval(timerSim);
    timerSim = setInterval(tickSim, 1000);
    carregarSim();
  }
  function carregarSim() {
    const sim = S.sims[SIM];
    if (!sim || sim.fim) return render();
    const i = sim.ordem[sim.pos];
    if (SIMQ[sim.ano + "-" + i] || sim.anuladas[i]) { simCarregando = false; render(); prefetchSim(sim); return; }
    simCarregando = true; simErro = null;
    render();
    questaoSim(sim, sim.pos).then(() => {
      simCarregando = false;
      salvar({ semCartas: true });
      if (SIM === sim.id) { render(); prefetchSim(sim); }
    }).catch((e) => {
      simCarregando = false;
      // a questão não existe no acervo (anulada ou incompleta): fica de fora da nota
      if (/404|incompleta/.test(String(e))) { sim.anuladas[i] = true; salvar({ semCartas: true }); }
      else simErro = "Não consegui buscar a questão. Confere a internet e tenta de novo.";
      if (SIM === sim.id) render();
    });
  }
  async function prefetchSim(sim) {
    if (simPrefetch) return;
    simPrefetch = true;
    try {
      for (const p of [sim.pos + 1, sim.pos + 2]) {
        const i = sim.ordem[p];
        if (i === undefined || SIMQ[sim.ano + "-" + i] || sim.anuladas[i]) continue;
        try { await questaoSim(sim, p); } catch (e) { /* tenta de novo quando ela chegar lá */ }
      }
    } finally { simPrefetch = false; }
  }
  function tickSim() {
    const sim = SIM && S.sims[SIM];
    if (!sim || sim.fim) { clearInterval(timerSim); timerSim = null; return; }
    const agora = Date.now();
    const dt = Math.min(agora - simUltimo, 2000); // app em segundo plano não conta
    simUltimo = agora;
    if (document.hidden) return;
    sim.tempo += dt;
    const el = document.getElementById("sim-tempo");
    if (el) el.textContent = fmtTempo(sim.tempo);
    if (agora - simUltimoSalvo > 15000) { simUltimoSalvo = agora; salvar({ semCartas: true }); }
  }
  function pausarSim() {
    clearInterval(timerSim); timerSim = null;
    SIM = null;
    salvar({ semCartas: true });
  }

  // TRI: θ por EAP (priori normal padrão, logística de 3 parâmetros, D = 1) e a escala de cada área
  function notaTRI(ano, area, itens, lingua) {
    const P = (window.TRI_PARAMS || {})[ano], E = (window.TRI_ESCALA || {})[area];
    if (!P || !P[area] || !E) return null;
    const Q = [], logL = [];
    for (let t = -5; t <= 6.0001; t += 0.025) { Q.push(t); logL.push(-t * t / 2); }
    let usados = 0;
    for (const [i, ok] of itens) {
      const par = P[area][i] || P[area][i + "-" + lingua];
      if (!par) continue;
      usados++;
      const [a, b, c] = par;
      for (let j = 0; j < Q.length; j++) {
        let p = c + (1 - c) / (1 + Math.exp(-a * (Q[j] - b)));
        p = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
        logL[j] += ok ? Math.log(p) : Math.log(1 - p);
      }
    }
    if (usados < 10) return null;
    const mx = Math.max(...logL);
    let s = 0, sq = 0;
    for (let j = 0; j < Q.length; j++) { const w = Math.exp(logL[j] - mx); s += w; sq += Q[j] * w; }
    return Math.round((E[0] * (sq / s) + E[1]) * 10) / 10;
  }
  if (PARAMS.get("debug")) window.__notaTRI = notaTRI; // só para testes
  function resultadoSim(sim) {
    const por = {};
    for (const i of sim.ordem) {
      if (sim.anuladas[i]) continue;
      const a = areaDaQuestao(sim.ano, i);
      por[a] = por[a] || { itens: [], acertos: 0, total: 0, respondidas: 0 };
      const r = sim.resp[i];
      const ok = !!r && r === sim.gab[i];
      por[a].itens.push([i, ok]);
      por[a].total++;
      if (r) por[a].respondidas++;
      if (ok) por[a].acertos++;
    }
    for (const a of Object.keys(por)) por[a].tri = notaTRI(sim.ano, a, por[a].itens, sim.lingua);
    return por;
  }
  function finalizarSim() {
    const sim = S.sims[SIM];
    if (!sim) return;
    const faltam = sim.ordem.filter((i) => !sim.anuladas[i] && !sim.resp[i]).length;
    if (!confirm(faltam ? `Ainda tem ${faltam} sem resposta (contam como erro, igual na prova). Finalizar mesmo?` : "Finalizar o simulado e ver a nota?")) return;
    sim.fim = hoje();
    const res = resultadoSim(sim);
    const reg = { id: uid(), data: hoje(), lc: null, ch: null, cn: null, mt: null, tri: {}, ano: sim.ano, tipo: sim.tipo, origem: "app" };
    for (const [a, r] of Object.entries(res)) { reg[a] = r.acertos; if (r.tri != null) reg.tri[a] = r.tri; }
    for (const i of sim.ordem) {
      if (!sim.resp[i] || sim.anuladas[i]) continue;
      const area = areaDaQuestao(sim.ano, i);
      registrarResposta({ fonte: "sim", area, ok: sim.resp[i] === sim.gab[i], b: dificuldade({ year: sim.ano, index: i, _area: area }) });
    }
    S.simulados.push(reg);
    sim.registro = reg.id;
    clearInterval(timerSim); timerSim = null;
    salvar();
    render();
    confete();
  }
  function anotarRef(ano, i, letra) {
    if (S.erros.some((e) => !e.dominado && e.ref && e.ref.ano === ano && e.ref.i === i)) return false;
    const area = areaDaQuestao(ano, i);
    S.erros.push({
      id: uid(), data: hoje(), caixa: 0, proxima: agendar(area, 1), dominado: false,
      area, topico: "outro", assuntoLivre: `ENEM ${ano} · questão ${i}`, questao: "Do simulado", motivo: "",
      licao: `Resposta ${letra}. Toque em "Ver questão" pra rever.`, ref: { ano, i },
    });
    S.contadores.erros = (S.contadores.erros || 0) + 1;
    return true;
  }

  function telaSimulado() {
    const sim = SIM && S.sims[SIM];
    if (!sim) {
      const sims = Object.values(S.sims || {});
      const andamento = sims.filter((x) => !x.fim);
      const feitos = sims.filter((x) => x.fim).reverse();
      const atual = (S.sims || {})[simAno + "-" + simTipo];
      const chipsAno = ANOS_SIM.map((a) => `<button class="opcao" data-acao="sim-ano" data-ano="${a}" aria-pressed="${simAno === a}">${a}</button>`).join("");
      const chipsTipo = Object.entries(TIPOS_SIM).map(([k, t]) => `<button class="opcao" data-acao="sim-tipo" data-tipo="${k}" aria-pressed="${simTipo === k}">${t.nome}</button>`).join("");
      const linha = (x) => {
        const res = x.fim ? resultadoSim(x) : null;
        const resp = x.ordem.filter((i) => x.resp[i]).length;
        return `<div class="topico"><div><div class="nome">ENEM ${x.ano} · ${TIPOS_SIM[x.tipo].nome}</div>
          <div class="meta">${x.fim ? Object.entries(res).map(([a, r]) => `${AREAS[a].curto} ${r.tri != null ? `<b>${Math.round(r.tri)}</b>` : `${r.acertos}/${r.total}`}`).join(" · ") : `${resp} de ${x.ordem.length} respondidas · ${fmtTempo(x.tempo)}`}</div></div>
          <button class="btn mini" data-acao="sim-abrir" data-id="${x.id}">${x.fim ? "Ver" : "Continuar"}</button></div>`;
      };
      return `${topo("Simulado", "#hoje")}
        ${andamento.length ? `<div class="card"><div class="eyebrow">Em andamento</div><div class="topicos" style="margin-top:8px">${andamento.map(linha).join("")}</div></div>` : ""}
        <div class="card">
          <div class="eyebrow">Novo simulado</div>
          <p style="margin-top:6px">Prova real do ENEM, igual ao dia da prova: o gabarito só aparece no final. <b>Pode pausar quando quiser</b> e continuar depois, até em outro dia. A nota sai pela <b>TRI</b>, com os parâmetros oficiais do INEP.</p>
          <label class="campo"><span>Prova</span></label>
          <div class="opcoes" style="margin:-6px 0 14px">${chipsAno}</div>
          <label class="campo"><span>O que fazer</span></label>
          <div class="opcoes" style="margin:-6px 0 6px">${chipsTipo}</div>
          <p class="small muted" style="margin:0 0 12px">${TIPOS_SIM[simTipo].desc}${simTipo === "d1" ? " (sem redação)" : ""}. Na prova de verdade: ${simTipo === "d1" ? "5h30 com a redação" : simTipo === "d2" ? "5h" : "~2h30"}.</p>
          ${atual && !atual.fim
            ? `<button class="btn full" data-acao="sim-abrir" data-id="${atual.id}">Continuar de onde parou</button>`
            : atual ? `<div class="linha-btns"><button class="btn" data-acao="sim-abrir" data-id="${atual.id}">Ver resultado</button><button class="btn ghost" data-acao="sim-refazer">Refazer</button></div>`
            : `<button class="btn full" data-acao="sim-comecar">Começar</button>`}
          <p class="small muted" style="margin:10px 0 0">Precisa de internet pra carregar as questões.</p>
        </div>
        ${feitos.length ? `<div class="card"><div class="eyebrow">Feitos</div><div class="topicos" style="margin-top:8px">${feitos.map(linha).join("")}</div></div>` : ""}`;
    }

    if (sim.fim) {
      const res = resultadoSim(sim);
      const erradas = sim.ordem.filter((i) => sim.resp[i] && sim.gab[i] && sim.resp[i] !== sim.gab[i]);
      const notas = Object.values(res).map((r) => r.tri).filter((n) => n != null);
      const media = notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
      return `${topo(`ENEM ${sim.ano} · ${TIPOS_SIM[sim.tipo].nome}`, "#simulado")}
        <div class="card" style="text-align:center">
          <div class="eyebrow">Nota pela TRI</div>
          ${media != null ? `<div class="contagem" style="display:block"><div class="num">${media}</div><div class="muted">${notas.length > 1 ? "média das áreas" : AREAS[Object.keys(res)[0]].nome} · ${fmtTempo(sim.tempo)} de prova</div></div>` : ""}
        </div>
        <div class="card">${Object.entries(res).map(([a, r]) => `
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--linha)">
            <span><span class="chip" style="color:${AREAS[a].cor}">${AREAS[a].curto}</span>${AREAS[a].nome}<br><span class="small muted">${r.acertos} de ${r.total} certas${r.respondidas < r.total ? ` · ${r.total - r.respondidas} em branco` : ""}</span></span>
            <b style="font-family:'Alfa Slab One',serif;font-size:26px">${r.tri != null ? Math.round(r.tri) : "–"}</b>
          </div>`).join("")}
          <p class="small muted" style="margin:10px 0 0">Calculada com os parâmetros oficiais de cada questão (microdados do INEP) e o mesmo método da nota do ENEM. Por isso acertar questão fácil vale mais do que acertar difícil no chute.</p>
        </div>
        ${erradas.length ? `<div class="card"><div class="eyebrow">${plural(erradas.length, "questão errada", "questões erradas")}</div>
          <div class="t-acoes" style="margin-top:8px">${erradas.slice(0, 60).map((i) => `<a class="btn mini" href="#enem-ver/${sim.ano}-${i}">Q${i}</a>`).join("")}</div>
          <div class="linha-btns"><button class="btn" data-acao="sim-erros">Mandar os erros pro caderno</button></div></div>` : ""}
        <div class="linha-btns"><a class="btn ghost" href="#simulado" data-acao="sim-lista">Voltar</a></div>`;
    }

    const total = sim.ordem.length, i = sim.ordem[sim.pos];
    const respondidas = sim.ordem.filter((x) => sim.resp[x]).length;
    const ultimo = sim.pos === total - 1;
    const topoSim = `<div class="des-topo">
        <button class="icone-btn" data-acao="sim-pausar" aria-label="Pausar">⏸</button>
        <div class="small muted">Questão ${sim.pos + 1} de ${total} · ${respondidas} respondidas</div>
        <b id="sim-tempo" class="mono">${fmtTempo(sim.tempo)}</b>
      </div>`;
    const nav = `<div class="linha-btns sim-nav">
        <button class="btn ghost" data-acao="sim-ir" data-d="-1" ${sim.pos === 0 ? "disabled" : ""}>← Anterior</button>
        <button class="btn ghost" data-acao="sim-mapa">${simMapa ? "Fechar mapa" : "Mapa"}</button>
        ${ultimo ? `<button class="btn" data-acao="sim-finalizar">Finalizar</button>` : `<button class="btn" data-acao="sim-ir" data-d="1">Próxima →</button>`}
      </div>
      ${simMapa ? `<div class="card"><div class="mapa">${sim.ordem.map((x, p) => `<button class="${sim.resp[x] ? "resp" : ""}${p === sim.pos ? " atual" : ""}${sim.anuladas[x] ? " anulada" : ""}" data-acao="sim-pular" data-p="${p}">${x}</button>`).join("")}</div>
        <div class="linha-btns"><button class="btn" data-acao="sim-finalizar">Finalizar simulado</button></div></div>` : ""}`;
    let corpo;
    if (sim.anuladas[i]) corpo = `<div class="card vazio"><div class="grande">🚫</div>A questão ${i} não está no acervo (foi anulada ou está incompleta). Ela fica de fora da nota.</div>`;
    else if (simErro) corpo = `<div class="card vazio"><div class="grande">📡</div><p>${esc(simErro)}</p><button class="btn" data-acao="sim-tentar">Tentar de novo</button></div>`;
    else if (simCarregando || !SIMQ[sim.ano + "-" + i]) corpo = `<div class="card vazio"><div class="grande">📝</div>Carregando a questão ${i}…</div>`;
    else corpo = htmlQuestaoEnem(SIMQ[sim.ano + "-" + i], null, "sim-marcar", sim.resp[i]);
    return `${topoSim}${simMapa ? nav : ""}${corpo}${simMapa ? "" : nav}`;
  }

  // ver de novo uma questão real que foi pro caderno
  let VER = null;
  function telaEnemVer(arg) {
    const [ano, i] = (arg || "").split("-").map(Number);
    if (!VER || VER.k !== arg) {
      VER = { k: arg, q: null, erro: null };
      buscarEnem(ano, i).then((q) => { if (VER && VER.k === arg) { VER.q = q; render(); } })
        .catch(() => { if (VER && VER.k === arg) { VER.erro = true; render(); } });
    }
    const corpo = VER.erro ? `<div class="card vazio">Não consegui carregar. Confere a internet.</div>`
      : !VER.q ? `<div class="card vazio">Carregando…</div>`
      : htmlQuestaoEnem(VER.q, VER.q.correctAlternative, null) +
        `<div class="linha-btns"><a class="btn" href="https://chatgpt.com/?q=${encodeURIComponent(promptEnem(VER.q))}" target="_blank" rel="noopener">Pedir explicação</a></div>`;
    return `${topo(`ENEM ${ano} · Q${i}`, "#erros")}${corpo}`;
  }
  function anotarQuestao(q) {
    const ja = S.erros.find((e) => !e.dominado && e.qid === q.id);
    if (ja) return ja.id;
    const id = uid();
    S.erros.push({
      id, qid: q.id, data: hoje(), caixa: 0, proxima: agendar(TOP[q.t].area, 1), dominado: false,
      area: TOP[q.t].area, topico: q.t, assuntoLivre: "", questao: q.q, motivo: "", licao: q.e,
    });
    S.contadores.erros = (S.contadores.erros || 0) + 1;
    salvar();
    return id;
  }
  // errou: vai sozinho pro caderno; "Desfazer" tira de lá
  function desfazerAnotacao(mapa, chave) {
    S.erros = S.erros.filter((e) => e.id !== mapa[chave]);
    mapa[chave] = false;
    salvar({ semCartas: true });
  }

  function telaDesafio() {
    if (!DES) {
      const ok = !!S.desafios[hoje()];
      return `${topo("Desafio de 3 min", "#hoje")}
        <div class="card" style="text-align:center">
          <div class="chama${ok ? " acesa" : ""}" style="font-size:84px" aria-hidden="true">🔥</div>
          <h2>${ok ? "Rodada extra" : "Acenda o foguinho de hoje"}</h2>
          <p>Questões rápidas no estilo ENEM, com a explicação na hora. O relógio pausa enquanto você lê a explicação.</p>
          <p class="small muted">Complete os 3 minutos pra ${ok ? "treinar mais (o foguinho de hoje já está aceso)" : "acender o foguinho"}. Errou? Ela vai sozinha pro caderno de erros e volta na revisão.</p>
          <button class="btn full" data-acao="des-iniciar">Começar</button>
        </div>`;
    }
    if (DES.fim) {
      const seq = seqAtual();
      return `
        <div class="card fim-desafio" style="text-align:center;margin-top:10px">
          <div class="chama acesa explode" aria-hidden="true">🔥</div>
          <h2>${DES.primeiro ? "Foguinho aceso!" : "Mais uma rodada feita!"}</h2>
          <p style="font-size:20px;margin:6px 0 2px"><b>${plural(seq, "dia", "dias")}</b> ${seq === 1 ? "de foguinho" : "seguidos"}</p>
          <p class="muted">${DES.acertos} de ${DES.total} certas nesta rodada</p>
          ${DES.ganhouProtetor ? `<p class="aviso" style="margin:12px 0"><b>Ganhou um protetor 🧊</b> Se um dia você não conseguir estudar, ele salva a sequência sozinho.</p>` : ""}
          ${faixaSemana()}
        </div>
        ${DES.erradas.length ? `<div class="card"><div class="eyebrow">Pra não errar de novo</div>
          ${DES.erradas.map((q) => `<div class="errada"><div class="small"><b>${esc(q.q)}</b></div>
            <div class="small" style="margin:4px 0 6px">✔ ${esc(q.a[q.c])}. ${esc(q.e)}</div>
            ${DES.anotadas[q.id] ? `<span class="small" style="color:var(--verde);font-weight:800">✓ No caderno</span>` : `<button class="btn mini" data-acao="des-anotar" data-id="${esc(q.id)}">Anotar no caderno</button>`}</div>`).join("")}
        </div>` : ""}
        <div class="linha-btns"><a class="btn" href="#hoje" data-acao="des-sair-fim">Voltar pro plano</a><button class="btn ghost" data-acao="des-iniciar">Mais 3 min</button></div>`;
    }
    const q = DES.q, t = TOP[q.t], area = AREAS[t.area];
    const s = Math.ceil(DES.resta / 1000);
    const certo = DES.resp === q.c;
    return `
      <div class="des-topo">
        <button class="icone-btn" data-acao="des-sair" aria-label="Sair do desafio">✕</button>
        <div class="des-trilho"><i id="des-barra" style="width:${(100 * DES.resta) / DURACAO}%"></i></div>
        <b id="des-tempo" class="mono">${Math.floor(s / 60)}:${pad(s % 60)}</b>
      </div>
      <div class="small muted" style="margin:0 0 8px">${DES.acertos} certas · ${DES.total} respondidas</div>
      <div class="card">
        <div><span class="chip" style="color:${area.cor}">${area.curto}</span><span class="small muted">${esc(t.nome)}</span></div>
        <p class="pergunta">${esc(q.q)}</p>
        <div class="alts">${q.a.map((alt, i) => {
          let cls = "";
          if (DES.resp !== null) cls = i === q.c ? " certa" : i === DES.resp ? " errada-alt" : " apagada";
          return `<button class="alt${cls}" data-acao="des-responder" data-i="${i}" ${DES.resp !== null ? "disabled" : ""}><span class="letra">${"ABCDE"[i]}</span><span>${esc(alt)}</span></button>`;
        }).join("")}</div>
      </div>
      ${DES.resp !== null ? `<div class="feedback ${certo ? "ok" : "nao"}">
        <b>${certo ? "Isso! 🎉" : "Quase! A certa é a " + "ABCDE"[q.c]}</b>
        <p>${esc(q.e)}</p>
        <div class="linha-btns">${certo ? "" : (DES.anotadas[q.id] ? `<span class="small" style="font-weight:800">📒 Foi pro caderno de erros</span><button class="btn mini" data-acao="des-desfazer" data-id="${esc(q.id)}">Desfazer</button>` : `<button class="btn ghost" data-acao="des-anotar" data-id="${esc(q.id)}">Anotar no caderno</button>`)}
          <button class="btn" data-acao="des-continuar">${DES.resta <= 0 ? "Ver resultado" : "Continuar"}</button></div>
      </div>` : ""}`;
  }

  function telaHoje() {
    const d = hoje();
    const f = fase(d);
    const plano = planoDe(d);
    const x = dia(d);
    const seq = seqAtual();
    const alvo = f === "pre1" || f === "prova1" ? D1 : D2;
    const falta = diff(d, alvo);
    const verso = window.VERSOS[Math.floor(hash(d) * window.VERSOS.length)];
    const rev = paraRevisar().length;
    const revisouHoje = !!x.revisou;

    let contagem;
    if (f === "fim") contagem = `<div class="num" style="font-size:44px">Acabou! 🎉</div><div class="muted">Orgulho de você.</div>`;
    else if (falta === 0) contagem = `<div class="num" style="font-size:52px">É hoje!</div><div class="muted">${f === "prova1" ? "1º dia: Linguagens, Humanas e Redação" : "2º dia: Natureza e Matemática"}</div>`;
    else contagem = `<div class="num">${falta}<small> ${falta === 1 ? "dia" : "dias"}</small></div><div class="muted">pro ${alvo === D1 ? "1º dia do ENEM (08/11)" : "2º dia do ENEM (15/11)"}</div>`;

    const itens = plano.map((t) => {
      const feita = !!x.feitas[t.id];
      const area = t.area ? `<span class="chip" style="color:${AREAS[t.area].cor}">${AREAS[t.area].curto}</span>` : "";
      const acoes = [];
      if (t.ir) acoes.push(`<a class="btn mini" href="${t.ir}">${esc(t.irTxt || "Abrir")}</a>`);
      if (t.link) acoes.push(`<a class="btn mini" href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.linkTxt || "Abrir")}</a>`);
      if (t.tipo === "estudo" && t.area !== "red") acoes.push(`<a class="btn mini" href="#livre/enem-${t.area}">ENEM real de ${AREAS[t.area].nome}</a>`);
      if (t.tipo === "estudo" && !feita) acoes.push(`<button class="btn mini" data-acao="trocar" data-id="${t.id}">Trocar assunto</button>`);
      return `<li class="tarefa${feita ? " feita" : ""}">
        <button class="check" data-acao="marcar" data-id="${t.id}" aria-pressed="${feita}" aria-label="Marcar como feito: ${esc(t.titulo)}">${ICO.check}</button>
        <div><div class="t-tit">${area}${esc(t.titulo)}</div>${t.det ? `<div class="t-det">${esc(t.det)}</div>` : ""}${acoes.length ? `<div class="t-acoes">${acoes.join("")}</div>` : ""}</div></li>`;
    });
    if (rev > 0 || revisouHoje) {
      const feita = rev === 0;
      itens.unshift(`<li class="tarefa${feita ? " feita" : ""}">
        <span class="check" aria-hidden="true">${ICO.check}</span>
        <div><div class="t-tit">${feita ? "Revisão do caderno de erros feita" : `Revisar ${plural(rev, "erro", "erros")} do caderno`}</div>
        <div class="t-det">${feita ? "Amanhã tem mais." : "5 minutinhos: ver a questão, lembrar a lição, conferir."}</div>
        ${feita ? "" : `<div class="t-acoes"><a class="btn mini" href="#revisar">Revisar agora</a></div>`}</div></li>`);
    }

    return `
      ${avisoInstalar()}
      <div class="topo">
        <button class="retrato" data-acao="trocar-foto" aria-label="Trocar foto">${S.foto ? `<img src="${S.foto}" alt="">` : esc((S.perfil.nome || C.nome).charAt(0))}</button>
        <div class="topo-txt"><div class="eyebrow">${SEMANA[diaSemana(d)]}, ${fmtData(d)}</div><h1>${saudacao()}, <em>${esc(S.perfil.nome || C.nome)}</em></h1></div>
        <a class="icone-btn" href="#ajustes" aria-label="Ajustes">${ICO.engrenagem}</a>
      </div>
      ${f === "fim" ? "" : cartaoFogo(seq)}
      <div class="card">
        <div class="contagem"><div>${contagem}</div></div>
        <div class="verso">${esc(verso)}</div>
      </div>
      <div class="card">
        <div class="eyebrow">Plano de hoje</div>
        <h3 style="margin-top:2px">${f === "pre1" || f === "entre" ? "Bora, um passo de cada vez" : "Hoje é diferente"}</h3>
        <ul class="tarefas">${itens.join("")}</ul>
        <div class="linha-btns"><a class="btn" href="#novo-erro">+ Anotar erro</a><a class="btn ghost" href="#simulado">📝 Simulado</a>${rev ? `<a class="btn ghost" href="#revisar">Revisar (${rev})</a>` : ""}</div>
      </div>
      ${cartaoProximaCarta()}
      <input type="file" accept="image/*" id="foto-input" class="hide">`;
  }

  // ----- Erros -----
  let filtroArea = "todas";
  function telaErros() {
    const rev = paraRevisar().length;
    const lista = S.erros.filter((e) => filtroArea === "todas" || e.area === filtroArea).slice().reverse();
    const chips = ["todas", "lc", "ch", "cn", "mt"].map((a) =>
      `<button class="opcao" data-acao="filtro-area" data-area="${a}" aria-pressed="${filtroArea === a}">${a === "todas" ? "Todas" : AREAS[a].nome}</button>`).join("");
    const itens = lista.map((e) => `
      <div class="card flat" style="padding:12px 14px">
        <div class="t-tit"><span class="chip" style="color:${AREAS[e.area].cor}">${AREAS[e.area].curto}</span>${esc(nomeTopico(e))}</div>
        ${e.questao ? `<div class="t-det">${esc(e.questao)}</div>` : ""}
        <div style="margin-top:6px"><b>Lição:</b> ${esc(e.licao)}</div>
        <div class="small muted" style="margin-top:4px">${e.motivo ? esc(MOTIVOS[e.motivo]) + " · " : ""}${e.dominado ? "✅ Dominado" : "Próxima revisão: " + (e.proxima <= hoje() ? "hoje" : fmtData(e.proxima))}</div>
        <div class="t-acoes">
          <a class="btn mini" href="https://chatgpt.com/?q=${encodeURIComponent(promptExplicar(e))}" target="_blank" rel="noopener">Explicar (ChatGPT)</a>
          <a class="btn mini" href="https://claude.ai/new?q=${encodeURIComponent(promptExplicar(e))}" target="_blank" rel="noopener">Explicar (Claude)</a>
          ${e.ref ? `<a class="btn mini" href="#enem-ver/${e.ref.ano}-${e.ref.i}">Ver questão</a>` : ""}
          <a class="btn mini" href="#novo-erro/${e.id}">Editar</a>
        </div>
      </div>`).join("");
    return `
      ${topo("Caderno de erros")}
      <p class="muted">Cada questão errada vira uma lição. O app te mostra de novo em 1, 2, 4, 7 e 12 dias, sempre antes do dia da prova daquela área.</p>
      <div class="linha-btns" style="margin-bottom:16px"><a class="btn" href="#novo-erro">+ Anotar erro</a><a class="btn ghost${rev ? "" : " "}" href="#revisar" ${rev ? "" : 'aria-disabled="true"'}>Revisar (${rev})</a></div>
      <div class="abas-area">${chips}</div>
      ${itens || `<div class="vazio"><div class="grande">📒</div>Nenhum erro anotado${filtroArea === "todas" ? " ainda. Errou uma questão? Anota aqui e o app cuida de te lembrar." : " nessa área."}</div>`}`;
  }

  function opcoesTopico(area, sel) {
    const ts = TOPICOS.filter((t) => t.area === area).sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome));
    return ts.map((t) => `<option value="${t.id}"${t.id === sel ? " selected" : ""}>${esc((t.sub ? t.sub + " · " : "") + t.nome)}</option>`).join("") +
      `<option value="outro"${sel === "outro" ? " selected" : ""}>Outro assunto…</option>`;
  }
  function telaNovoErro(id) {
    const e = id ? S.erros.find((x) => x.id === id) : null;
    const area = e ? e.area : "mt";
    const chipsArea = ["lc", "ch", "cn", "mt"].map((a) =>
      `<button type="button" class="opcao" data-acao="form-area" data-area="${a}" aria-pressed="${a === area}">${AREAS[a].nome}</button>`).join("");
    const chipsMotivo = Object.entries(MOTIVOS).map(([k, v]) =>
      `<button type="button" class="opcao" data-acao="form-motivo" data-motivo="${k}" aria-pressed="${e && e.motivo === k}">${v}</button>`).join("");
    return `
      ${topo(e ? "Editar erro" : "Anotar erro", "#erros")}
      <form class="card" id="form-erro" data-id="${e ? e.id : ""}" data-area="${area}" data-motivo="${e && e.motivo ? e.motivo : ""}">
        <label class="campo"><span>Área</span></label>
        <div class="opcoes" style="margin:-6px 0 14px">${chipsArea}</div>
        <label class="campo"><span>Assunto</span>
          <select id="f-topico">${opcoesTopico(area, e ? e.topico : "")}</select></label>
        <label class="campo ${e && e.topico === "outro" ? "" : "hide"}" id="campo-livre"><span>Qual assunto?</span>
          <input type="text" id="f-livre" value="${e ? esc(e.assuntoLivre || "") : ""}" placeholder="ex: Movimentos de vanguarda"></label>
        <label class="campo"><span>Qual era a questão? <span class="muted">(opcional)</span></span>
          <textarea id="f-questao" placeholder="ex: ENEM 2022, questão 140. Gráfico do consumo de energia de uma casa.">${e ? esc(e.questao || "") : ""}</textarea></label>
        <label class="campo"><span>Por que errou?</span></label>
        <div class="opcoes" style="margin:-6px 0 14px">${chipsMotivo}</div>
        <label class="campo"><span>O que você precisa lembrar</span>
          <textarea id="f-licao" required placeholder="ex: kWh = potência em kW × horas. Divide os watts por 1000!">${e ? esc(e.licao) : ""}</textarea></label>
        <button class="btn full" type="submit">${e ? "Salvar" : "Guardar no caderno"}</button>
        ${e ? `<div class="linha-btns"><button type="button" class="btn ghost" data-acao="apagar-erro" data-id="${e.id}">Apagar</button></div>` : ""}
      </form>`;
  }

  let REV = null;
  function telaRevisar() {
    if (!REV) REV = { fila: paraRevisar().map((e) => e.id), mostrando: false, feitos: 0 };
    const id = REV.fila[0];
    const e = id && S.erros.find((x) => x.id === id);
    if (!e) {
      const fez = REV.feitos;
      REV = null;
      return `${topo("Revisão", "#erros")}
        <div class="card vazio"><div class="grande">${fez ? "💪" : "✨"}</div>
        <h3>${fez ? `Revisão feita! ${plural(fez, "erro revisado", "erros revisados")}.` : "Nada pra revisar agora."}</h3>
        <p>${fez ? "Os que você lembrou voltam daqui a uns dias. Os que esqueceu voltam amanhã." : "Anote erros no caderno e eles aparecem aqui no dia certo."}</p>
        <a class="btn" href="#hoje">Voltar pro plano</a></div>`;
    }
    return `
      ${topo("Revisão", "#erros")}
      <div class="small muted" style="margin-bottom:8px">${REV.fila.length} pra revisar</div>
      <div class="card flash">
        <div><span class="chip" style="color:${AREAS[e.area].cor}">${AREAS[e.area].nome}</span></div>
        <div class="frente" style="margin-top:10px">${esc(nomeTopico(e))}</div>
        ${e.questao ? `<p class="muted" style="margin-top:6px">${esc(e.questao)}</p>` : ""}
        ${REV.mostrando
          ? `<div class="verso-card"><div class="eyebrow">A lição</div><div class="licao">${esc(e.licao)}</div></div>
             <div class="linha-btns"><button class="btn ghost" data-acao="rev-esqueci">Esqueci 😬</button><button class="btn verde" data-acao="rev-lembrei">Lembrei 💪</button></div>`
          : `<p class="small muted" style="margin-top:14px">Tenta lembrar qual era a lição antes de virar.</p>
             <button class="btn full" data-acao="rev-mostrar" style="margin-top:6px">Mostrar a lição</button>`}
      </div>`;
  }

  // ----- Raio-X -----
  let areaRaiox = "mt";
  let formAberto = null;
  function grafico() {
    const sims = S.simulados.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
    if (!sims.length) return `<div class="vazio small">Registre os acertos de cada simulado pra ver sua evolução aqui.</div>`;
    const W = 600, H = 230, L = 34, R = 14, T = 12, B = 30;
    const x = (i) => (sims.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (sims.length - 1));
    const y = (v) => T + (1 - v / 45) * (H - T - B);
    let svg = "";
    for (const v of [0, 15, 30, 45]) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linha)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--tinta-fraca)">${v}</text>`;
    sims.forEach((s, i) => { svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--tinta-fraca)">${fmtData(s.data)}</text>`; });
    for (const a of ["lc", "ch", "cn", "mt"]) {
      const pts = sims.map((s, i) => (s[a] === "" || s[a] == null ? null : [x(i), y(Number(s[a]))])).filter(Boolean);
      if (!pts.length) continue;
      if (pts.length > 1) svg += `<polyline fill="none" stroke="${AREAS[a].cor}" stroke-width="3" stroke-linejoin="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
      for (const p of pts) svg += `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${AREAS[a].cor}" stroke="var(--papel-2)" stroke-width="2"/>`;
    }
    const ult = sims[sims.length - 1];
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Acertos por área em cada simulado">${svg}</svg>
      <div class="legenda">${["lc", "ch", "cn", "mt"].map((a) => `<span><i style="background:${AREAS[a].cor}"></i>${AREAS[a].nome}${ult[a] !== "" && ult[a] != null ? `: <b>${ult[a]}</b>/45` : ""}</span>`).join("")}</div>`;
  }
  function telaRaiox() {
    const ranking = TOPICOS.filter((t) => t.area !== "red").map((t) => ({ t, p: prioridade(t), n: S.erros.filter((e) => e.topico === t.id).length }))
      .sort((a, b) => b.p - a.p);
    const foco = ranking.slice(0, 5);
    const maxErros = Math.max(1, ...ranking.map((r) => r.n));
    const lista = ranking.filter((r) => r.t.area === areaRaiox).map(({ t, n }) => {
      const alfa = n ? 0.18 + 0.62 * (n / maxErros) : 0;
      return `<div class="topico"><div><div class="nome">${esc(t.nome)}</div><div class="meta"><span class="pontos" aria-label="Incidência ${t.peso} de 3">${"●".repeat(t.peso)}${"○".repeat(3 - t.peso)}</span> ${t.sub ? esc(t.sub) + " · " : ""}${esc(t.foco)}</div></div>
        <div class="calor" style="background:rgba(191,43,38,${alfa.toFixed(2)})" title="Erros anotados">${n}</div></div>`;
    }).join("");
    const chips = ["mt", "cn", "ch", "lc"].map((a) => `<button class="opcao" data-acao="raiox-area" data-area="${a}" aria-pressed="${areaRaiox === a}">${AREAS[a].nome}</button>`).join("");

    return `
      ${topo("Raio-X")}
      <div class="card">
        <div class="eyebrow">Diagnóstico das últimas ${Math.min(DIAG_A_CADA, (S.respostas || []).length)} respostas</div>
        <div style="margin:8px 0 14px">${htmlDiagnostico(calcularDiagnostico((S.respostas || []).slice(-DIAG_A_CADA)))}</div>
        <p class="small muted" style="margin:0 0 12px">A cada ${DIAG_A_CADA} questões aparece um resumo automático. Faltam ${DIAG_A_CADA - (((S.diagTotal || 0) - (S.diagUltimo || 0)) % DIAG_A_CADA)} pro próximo.</p>
        <div class="eyebrow">Onde focar agora</div>
        <p class="small muted" style="margin:2px 0 10px">Junta o que mais cai no ENEM com o que você mais erra.</p>
        <ol style="margin:0;padding-left:22px">${foco.map(({ t, n }) => `<li style="margin-bottom:6px"><b>${esc(t.nome)}</b> <span class="small muted">· ${AREAS[t.area].nome}${n ? ` · ${plural(n, "erro", "erros")}` : ""}</span></li>`).join("")}</ol>
      </div>

      <div class="card">
        <div class="eyebrow">Simulados</div>
        <h3>Acertos por área (de 45)</h3>
        ${grafico()}
        ${formAberto === "sim" ? `
          <form id="form-sim" style="margin-top:14px">
            <label class="campo"><span>Data</span><input type="date" id="s-data" value="${hoje()}"></label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
              ${["lc", "ch", "cn", "mt"].map((a) => `<label class="campo"><span>${AREAS[a].nome}</span><input type="number" inputmode="numeric" min="0" max="45" id="s-${a}" placeholder="0 a 45"></label>`).join("")}
            </div>
            <p class="small muted">Deixe em branco as áreas que você não fez.</p>
            <div class="linha-btns"><button class="btn" type="submit">Salvar simulado</button><button type="button" class="btn ghost" data-acao="fechar-form">Cancelar</button></div>
          </form>` : `<div class="linha-btns"><a class="btn" href="#simulado">Fazer simulado no app</a><button class="btn ghost" data-acao="abrir-form" data-form="sim">+ Registrar feito no papel</button></div>`}
        ${S.simulados.length ? `<details style="margin-top:12px"><summary class="small">Ver/apagar simulados</summary>${S.simulados.map((s) => `<div class="small" style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--linha)"><span>${fmtData(s.data)}${s.ano ? ` · ENEM ${s.ano}` : ""} · ${["lc", "ch", "cn", "mt"].filter((a) => s[a] != null).map((a) => `${AREAS[a].curto} ${s[a]}${s.tri && s.tri[a] != null ? ` (TRI ${Math.round(s.tri[a])})` : ""}`).join(" · ")}</span><button class="btn mini" data-acao="apagar-sim" data-id="${s.id}">Apagar</button></div>`).join("")}</details>` : ""}
      </div>


      ${(() => {
        const st = statsEnem();
        return `<div class="card">
          <div class="eyebrow">Questões reais do ENEM</div>
          <h3>${st.n ? `${st.n} respondidas · ${Math.round((100 * st.ok) / st.n)}% de acerto` : "Nenhuma ainda"}</h3>
          ${["mt", "cn", "ch", "lc"].map((a) => { const x = st.por[a] || { n: 0, ok: 0 }; return `<div class="small" style="margin-bottom:6px">${AREAS[a].nome}: ${x.n ? `${x.ok}/${x.n} (${Math.round((100 * x.ok) / x.n)}%)` : "–"}
            <div class="barrinha"><i style="width:${x.n ? (100 * x.ok) / x.n : 0}%;background:${AREAS[a].cor}"></i></div></div>`; }).join("")}
          <div class="linha-btns"><a class="btn" href="#livre/enem-mix">Treinar com provas antigas</a></div>
        </div>`;
      })()}

      <div class="card">
        <div class="eyebrow">Mapa de assuntos</div>
        <p class="small muted" style="margin:2px 0 10px">● = quanto costuma cair (estimativa de provas anteriores). O quadrado mostra quantas vezes você errou.</p>
        <div class="abas-area">${chips}</div>
        <div class="topicos">${lista}</div>
      </div>`;
  }

  // ----- Cartas -----
  function telaCartas() {
    if (cartasCarregando) return `${topo("Cartas")}<div class="vazio">Carregando…</div>`;
    if (!PACOTE) {
      return `${topo("Cartas")}<div class="card vazio"><div class="grande">✍️</div><h3>${esc(C.autor)} está escrevendo umas coisas pra você…</h3><p>Volta aqui daqui a pouco.</p></div>`;
    }
    if (!CARTAS) {
      return `${topo("Cartas")}
        <form class="card" id="form-chave">
          <div class="envelope-anim" aria-hidden="true">💌</div>
          <h3 style="text-align:center">${esc(C.autor)} escondeu cartas aqui</h3>
          <p class="muted" style="text-align:center">Elas vão abrindo conforme você estuda. Pra destrancar, responda:</p>
          <label class="campo"><span>${esc(PACOTE.pergunta || "Qual a senha?")}</span>
            <input type="text" id="k-resp" autocomplete="off" autocapitalize="off" placeholder="${esc(PACOTE.dica || "")}"></label>
          <button class="btn full" type="submit">Destrancar</button>
          <p class="small muted" id="k-msg" style="margin-top:10px;text-align:center"></p>
        </form>`;
    }
    const lib = CARTAS.filter((c) => S.cartas.liberadas[c.id]).length;
    const ordem = CARTAS.slice().sort((a, b) => (!!S.cartas.liberadas[b.id] - !!S.cartas.liberadas[a.id]));
    const minis = ordem.map((c) => {
      const aberta = !!S.cartas.liberadas[c.id];
      if (aberta) {
        const nova = !S.cartas.lidas[c.id];
        return `<button class="carta-mini${nova ? " nova" : ""}" data-acao="abrir-carta" data-id="${esc(c.id)}"><span class="selo-c">${nova ? "!" : "♥"}</span><b>${esc(c.titulo || "Carta")}</b><small>${nova ? "Nova! Toque pra abrir" : "Ler de novo"}</small></button>`;
      }
      const p = progresso(c.cond);
      return `<div class="carta-mini trancada"><span class="selo-c">🔒</span><small>${esc(descrever(c.cond))}</small>${p.alvo ? `<div class="barrinha"><i style="width:${(100 * p.atual) / p.alvo}%"></i></div>` : ""}</div>`;
    }).join("");
    return `${topo("Cartas")}
      <p class="muted">${lib} de ${CARTAS.length} abertas. As outras abrem conforme você estuda (e algumas em datas especiais).</p>
      <div class="cartas">${minis}</div>`;
  }

  // ----- Prova -----
  const CHECKLIST = [
    ["doc", "Documento oficial ORIGINAL com foto", "RG, CIN, CNH, passaporte… Digital só no app oficial (CNH Digital, CIN Digital, e-Título com foto). Foto ou cópia não vale."],
    ["caneta", "Caneta esferográfica preta de tubo transparente", "Leve duas."],
    ["cartao", "Cartão de Confirmação impresso", "Não é obrigatório, mas tem o endereço e a sala."],
    ["agua", "Água em garrafa transparente", ""],
    ["lanche", "Lanche", "Caseiro em pote ou saco transparente; industrializado lacrado ou com rótulo."],
    ["remedio", "Remédios, se precisar", ""],
    ["casaco", "Um casaco", "Sala com ar-condicionado é comum."],
    ["sair", "Sair de casa com folga", "Portões abrem 12h e fecham 13h em ponto (horário de Brasília)."],
  ];
  function telaProva() {
    const d = hoje();
    const alvo = d <= D1 ? D1 : d <= D2 ? D2 : null;
    const chave = alvo === D2 ? "d2" : "d1";
    const marc = S.checklist[chave] || {};
    const dicas = [
      "<b>TRI:</b> acertar as fáceis vale mais que acertar difíceis no chute. Primeira passada: resolva o que você sabe e marque as difíceis pra voltar depois.",
      "<b>Nada em branco:</b> errar não tira ponto. Nos últimos 15 minutos, preencha tudo.",
      "<b>1º dia:</b> 90 questões + redação em 5h30. Uns 80 min pra redação (rascunho + passar a limpo) e uns 2,5 min por questão.",
      "<b>2º dia:</b> 90 questões em 5h, uns 3 min por questão. Comece pela área que você domina.",
      "<b>Cartão-resposta:</b> vá passando aos poucos, a cada bloco. Não deixe tudo pro final.",
      "<b>Celular:</b> desligado dentro do envelope porta-objetos, embaixo da carteira, a prova toda.",
    ];
    return `
      ${topo("Dia da prova")}
      ${alvo ? `<div class="card">
        <div class="eyebrow">Falta pro ${alvo === D1 ? "1º" : "2º"} dia (${fmtData(alvo)}, 13h30)</div>
        <div class="relogio" id="relogio" data-alvo="${alvo}" style="margin-top:8px">
          <div><b data-u="d">–</b><span>dias</span></div><div><b data-u="h">–</b><span>horas</span></div><div><b data-u="m">–</b><span>min</span></div><div><b data-u="s">–</b><span>seg</span></div>
        </div></div>` : `<div class="card vazio"><div class="grande">🎉</div><h3>Acabou! Agora é descansar.</h3><p>Gabarito oficial: até o 10º dia útil depois da prova. Resultado: meados de janeiro de 2027.</p></div>`}

      <div class="card">
        <h3>1º dia · domingo, 08/11</h3>
        <p>Linguagens (45) + Humanas (45) + Redação<br><span class="muted">Prova das 13h30 às 19h</span></p>
        <h3 style="margin-top:12px">2º dia · domingo, 15/11</h3>
        <p>Natureza (45) + Matemática (45)<br><span class="muted">Prova das 13h30 às 18h30</span></p>
        <p class="small muted" style="margin:0">Portões: abrem 12h, fecham 13h. Tudo no horário de Brasília: se o seu estado tem outro fuso, faça a conta.</p>
      </div>

      ${alvo ? `<div class="card">
        <div class="eyebrow">Checklist do ${chave === "d1" ? "1º" : "2º"} dia</div>
        <ul class="checklist" style="margin-top:10px">${CHECKLIST.map(([id, tit, det]) => `
          <li class="${marc[id] ? "feita" : ""}"><button class="check" data-acao="checklist" data-chave="${chave}" data-id="${id}" aria-pressed="${!!marc[id]}" aria-label="${esc(tit)}">${ICO.check}</button>
          <span><b>${esc(tit)}</b>${det ? `<br><small class="muted">${esc(det)}</small>` : ""}</span></li>`).join("")}</ul>
      </div>` : ""}

      <div class="card">
        <div class="eyebrow">Local de prova</div>
        <p class="small muted" style="margin:2px 0 8px">Está no Cartão de Confirmação, na Página do Participante (conta gov.br).</p>
        <label class="campo"><span>Endereço</span><input type="text" id="p-local" value="${esc(S.local)}" placeholder="Escola tal, rua tal, número"></label>
        <div class="linha-btns" style="margin-top:0"><button class="btn mini" data-acao="salvar-local">Salvar</button>${S.local ? `<a class="btn mini" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(S.local)}">Abrir no mapa</a>` : ""}</div>
      </div>

      <div class="card">
        <div class="eyebrow">Estratégia</div>
        <ul class="dicas" style="padding-left:20px;margin:10px 0 0">${dicas.map((x) => `<li>${x}</li>`).join("")}</ul>
      </div>`;
  }
  let timerRelogio = null;
  function tickRelogio() {
    const el = document.getElementById("relogio");
    if (!el) { clearInterval(timerRelogio); timerRelogio = null; return; }
    const ms = Math.max(0, instanteProva(el.dataset.alvo) - new Date());
    const v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
    for (const u of ["d", "h", "m", "s"]) el.querySelector(`[data-u=${u}]`).textContent = u === "d" ? v[u] : pad(v[u]);
  }

  // ----- Ajustes -----
  function telaAjustes() {
    const p = S.perfil;
    const chips = ["lc", "ch", "cn", "mt"].map((a) => `<button type="button" class="opcao" data-acao="fraca" data-area="${a}" aria-pressed="${(p.fracas || []).includes(a)}">${AREAS[a].nome}</button>`).join("");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const permissao = "Notification" in window ? Notification.permission : "indisponível";
    return `
      ${topo("Ajustes", "#hoje")}
      <form class="card" id="form-perfil">
        <div class="eyebrow">Sobre você</div>
        <label class="campo" style="margin-top:8px"><span>Nome</span><input type="text" id="a-nome" value="${esc(p.nome)}"></label>
        <label class="campo"><span>Curso dos sonhos</span><input type="text" id="a-curso" value="${esc(p.curso)}" placeholder="ex: Medicina"></label>
        <label class="campo"><span>Nota que você quer</span><input type="text" id="a-meta" value="${esc(p.meta)}" placeholder="ex: 750"></label>
        <label class="campo"><span>Língua estrangeira da prova</span></label>
        <div class="opcoes" style="margin:-6px 0 14px">${[["ingles", "Inglês"], ["espanhol", "Espanhol"]].map(([k, n]) => `<button type="button" class="opcao" data-acao="lingua" data-l="${k}" aria-pressed="${(p.lingua || "ingles") === k}">${n}</button>`).join("")}</div>
        <label class="campo"><span>Áreas em que sente mais dificuldade</span></label>
        <div class="opcoes" style="margin:-6px 0 6px">${chips}</div>
        <p class="small muted">O plano do dia puxa mais essas áreas a partir de amanhã.</p>
        <button class="btn" type="submit">Salvar</button>
      </form>

      <div class="card">
        <div class="eyebrow">Lembretes no celular</div>
        <p class="small" style="margin-top:6px">Um "bom dia" com a contagem às 6h e um lembrete às 20h. Também avisa quando chega carta nova por data.</p>
        ${!standalone ? `<p class="small"><b>Primeiro instale o app</b> (no iPhone: Compartilhar → Adicionar à Tela de Início) e abra pelo ícone.</p>` : ""}
        ${S.push && S.push.codigo ? `
          <p class="small">✅ Lembretes ativados neste celular. Agora mande este código pro ${esc(C.autor)} (é só uma vez):</p>
          <div class="codigo" id="codigo-push">${esc(S.push.codigo)}</div>
          <div class="linha-btns"><button class="btn" data-acao="enviar-codigo">Mandar pro ${esc(C.autor)}</button><button class="btn ghost" data-acao="testar-notif">Testar aviso</button></div>`
        : `<div class="linha-btns"><button class="btn" data-acao="ativar-push">Ativar lembretes</button></div>`}
        <p class="small muted" style="margin-top:8px">Permissão: ${esc(permissao)}</p>
      </div>

      <div class="card">
        <div class="eyebrow">Cópia de segurança</div>
        <p class="small" style="margin-top:6px">Tudo fica salvo no seu celular. De vez em quando, salve uma cópia (pra trocar de celular ou se apagar algo).</p>
        <div class="linha-btns"><button class="btn" data-acao="exportar">Salvar cópia</button><label class="btn ghost" style="cursor:pointer">Restaurar cópia<input type="file" accept="application/json,.json" id="importar" class="hide"></label></div>
      </div>

      <div class="card">
        <div class="eyebrow">Zona de perigo</div>
        <div class="linha-btns"><button class="btn ghost" data-acao="zerar">Apagar tudo e recomeçar</button></div>
      </div>
      <p class="small muted" style="text-align:center">Feito com carinho por ${esc(C.autor)} 💛</p>`;
  }

  // ---------- modal, toast, confete ----------
  function abrirModal(html) {
    fecharModal();
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `<div class="caixa" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener("click", (ev) => { if (ev.target === m) fecharModal(); });
    document.body.appendChild(m);
    document.body.style.overflow = "hidden";
  }
  function fecharModal() {
    document.querySelectorAll(".modal").forEach((m) => m.remove());
    document.body.style.overflow = "";
    if (filaNovas.length) setTimeout(mostrarNovaCarta, 300);
  }
  let toastTimer;
  function toast(msg) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2800);
  }
  function confete() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.getElementById("confete");
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const cores = ["#bf2b26", "#e0a02c", "#4c6b3c", "#2f5d70", "#f2e6c9"];
    const ps = Array.from({ length: 110 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 4,
      r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
      c: cores[Math.floor(Math.random() * cores.length)],
    }));
    let frames = 0;
    (function passo() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      }
      if (++frames < 150) requestAnimationFrame(passo);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }

  // ---------- lembretes (push) ----------
  const b64url = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  function chaveVapid(b64) {
    const pad64 = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad64).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function ativarPush() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios && !standalone) return toast("Primeiro instale o app na Tela de Início e abra pelo ícone.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return toast("Este navegador não aceita lembretes. No iPhone precisa do iOS 16.4 ou mais novo.");
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return toast("Sem permissão. Dá pra liberar em Ajustes do iPhone → Notificações.");
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(C.vapidPublica) });
      S.push = { codigo: "ENEM:" + b64url(JSON.stringify(sub)), em: hoje() };
      salvar();
      render();
      toast("Lembretes ativados! Agora mande o código.");
    } catch (e) {
      toast("Não deu pra ativar: " + (e && e.message ? e.message : e));
    }
  }

  // ---------- ações ----------
  const acoes = {
    marcar(el) {
      const d = hoje(), x = dia(d), id = el.dataset.id;
      const t = planoDe(d).find((k) => k.id === id);
      x.feitas[id] = !x.feitas[id];
      salvar();
      render();
      if (x.feitas[id] && planoDe(d).every((k) => x.feitas[k.id])) { confete(); toast("Plano de hoje completo! 🔥"); }
    },
    trocar(el) {
      const d = hoje(), x = dia(d), id = el.dataset.id;
      const plano = planoDe(d);
      const i = plano.findIndex((k) => k.id === id);
      if (i < 0) return;
      x.trocas[id] = (x.trocas[id] || 0) + 1;
      const outros = plano.filter((k) => k.topico && k.id !== id).map((k) => k.topico);
      const novo = escolherTopico(d, plano[i].areas, x.trocas[id], outros.concat(plano[i].topico));
      if (novo) plano[i] = tarefaEstudo(id, novo, plano[i].areas);
      salvar();
      render();
    },
    "filtro-area"(el) { filtroArea = el.dataset.area; render(); },
    "raiox-area"(el) { areaRaiox = el.dataset.area; render(); },
    "form-area"(el) {
      const f = document.getElementById("form-erro");
      f.dataset.area = el.dataset.area;
      f.querySelectorAll('[data-acao="form-area"]').forEach((b) => b.setAttribute("aria-pressed", b === el));
      document.getElementById("f-topico").innerHTML = opcoesTopico(el.dataset.area, "");
      document.getElementById("campo-livre").classList.add("hide");
    },
    "form-motivo"(el) {
      const f = document.getElementById("form-erro");
      const ativo = f.dataset.motivo === el.dataset.motivo;
      f.dataset.motivo = ativo ? "" : el.dataset.motivo;
      f.querySelectorAll('[data-acao="form-motivo"]').forEach((b) => b.setAttribute("aria-pressed", !ativo && b === el));
    },
    "apagar-erro"(el) {
      if (!confirm("Apagar este erro do caderno?")) return;
      S.erros = S.erros.filter((e) => e.id !== el.dataset.id);
      salvar();
      location.hash = "#erros";
    },
    "rev-mostrar"() { REV.mostrando = true; render(); },
    "rev-lembrei"() { responderRevisao(true); },
    "rev-esqueci"() { responderRevisao(false); },
    "abrir-form"(el) { formAberto = el.dataset.form; render(); },
    "fechar-form"() { formAberto = null; render(); },
    "apagar-sim"(el) {
      if (!confirm("Apagar este simulado?")) return;
      S.simulados = S.simulados.filter((s) => s.id !== el.dataset.id);
      salvar(); render();
    },
    "abrir-carta"(el) {
      const c = CARTAS && CARTAS.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const primeira = !S.cartas.lidas[c.id];
      S.cartas.lidas[c.id] = S.cartas.lidas[c.id] || new Date().toISOString();
      salvar({ semCartas: true });
      if (primeira) confete();
      abrirModal(`
        <div class="envelope-anim" aria-hidden="true">💌</div>
        <h2 style="text-align:center">${esc(c.titulo || "Pra você")}</h2>
        <div class="carta-aberta">${esc(c.texto)}<div class="assinatura">${esc(c.assinatura || "Com amor, " + C.autor)}</div></div>
        <div class="linha-btns"><button class="btn full" data-acao="fechar-modal">Fechar</button></div>`);
      render();
    },
    "fechar-modal"() { fecharModal(); },
    "fechar-modal-ir"(el) { fecharModal(); location.hash = el.dataset.href; },
    checklist(el) {
      const k = el.dataset.chave;
      S.checklist[k] = S.checklist[k] || {};
      S.checklist[k][el.dataset.id] = !S.checklist[k][el.dataset.id];
      salvar(); render();
    },
    "salvar-local"() { S.local = document.getElementById("p-local").value.trim(); salvar(); render(); toast("Local salvo"); },
    fraca(el) {
      const a = el.dataset.area;
      const f = S.perfil.fracas || (S.perfil.fracas = []);
      const i = f.indexOf(a);
      if (i >= 0) f.splice(i, 1); else f.push(a);
      el.setAttribute("aria-pressed", i < 0);
    },
    "des-iniciar"() { iniciarDesafio(); },
    "des-responder"(el) { responderQuestao(Number(el.dataset.i)); },
    "des-continuar"() { continuarDesafio(); },
    "des-anotar"(el) {
      const q = (window.QUESTOES || []).find((x) => x.id === el.dataset.id);
      if (!q || !DES || DES.anotadas[q.id]) return;
      DES.anotadas[q.id] = anotarQuestao(q);
      render();
      toast("Foi pro caderno. Volta amanhã na revisão.");
    },
    "des-desfazer"(el) { if (DES) { desfazerAnotacao(DES.anotadas, el.dataset.id); render(); toast("Tirei do caderno."); } },
    "enem-desfazer"() { if (EN && EN.q) { desfazerAnotacao(EN.anotadas, chaveEnem(EN.q)); render(); toast("Tirei do caderno."); } },
    "des-sair"() {
      if (DES && !DES.fim && !confirm("Se sair agora, essa rodada não conta pro foguinho. Sair mesmo?")) return;
      DES = null;
      location.hash = "#hoje";
    },
    "des-sair-fim"() { DES = null; location.hash = "#hoje"; },
    "enem-area"(el) { enemArea = el.dataset.area; render(); },
    "sim-ano"(el) { simAno = Number(el.dataset.ano); render(); },
    "sim-tipo"(el) { simTipo = el.dataset.tipo; render(); },
    "sim-comecar"() { abrirSim(criarSimulado(simAno, simTipo)); },
    "sim-refazer"() {
      if (!confirm("Começar esta prova de novo? O resultado anterior continua no gráfico do Raio-X.")) return;
      abrirSim(criarSimulado(simAno, simTipo));
    },
    "sim-abrir"(el) {
      const x = S.sims[el.dataset.id];
      if (!x) return;
      if (x.fim) { SIM = x.id; render(); window.scrollTo(0, 0); } else abrirSim(x.id);
    },
    "sim-marcar"(el) {
      const sim = S.sims[SIM], i = sim.ordem[sim.pos];
      const antes = sim.resp[i];
      if (antes === el.dataset.l) delete sim.resp[i]; else sim.resp[i] = el.dataset.l;
      if (!antes) {
        simNovas++;
        if (simNovas === 3 && !S.desafios[hoje()]) { acenderFoguinho(0, 0); confete(); setTimeout(() => toast("🔥 Foguinho aceso! Continua o simulado."), 300); }
      }
      salvar({ semCartas: true });
      render();
    },
    "sim-ir"(el) {
      const sim = S.sims[SIM];
      sim.pos = Math.max(0, Math.min(sim.ordem.length - 1, sim.pos + Number(el.dataset.d)));
      simMapa = false; simErro = null;
      carregarSim(); window.scrollTo(0, 0);
    },
    "sim-pular"(el) { const sim = S.sims[SIM]; sim.pos = Number(el.dataset.p); simMapa = false; simErro = null; carregarSim(); window.scrollTo(0, 0); },
    "sim-mapa"() { simMapa = !simMapa; render(); },
    "sim-tentar"() { simErro = null; carregarSim(); },
    "sim-finalizar"() { finalizarSim(); window.scrollTo(0, 0); },
    "sim-pausar"() { pausarSim(); toast("Simulado pausado. Continua quando quiser."); render(); window.scrollTo(0, 0); },
    "sim-lista"() { SIM = null; render(); window.scrollTo(0, 0); },
    "sim-erros"() {
      const sim = S.sims[SIM];
      const n = sim.ordem.filter((i) => sim.resp[i] && sim.gab[i] && sim.resp[i] !== sim.gab[i]).map((i) => anotarRef(sim.ano, i, sim.gab[i])).filter(Boolean).length;
      salvar();
      toast(n ? `${plural(n, "questão foi", "questões foram")} pro caderno` : "Já estavam no caderno");
    },
    "livre-fonte"(el) { livreFonte = el.dataset.f; render(); },
    "livre-area"(el) { livreArea = el.dataset.area; render(); },
    "livre-iniciar"() { iniciarLivre(); },
    "livre-tentar"() { carregarLivre(); },
    "livre-responder"(el) { responderLivre(el.dataset.r !== undefined ? Number(el.dataset.r) : el.dataset.l); },
    "livre-proxima"() { carregarLivre(); },
    "livre-encerrar"() {
      if (!LV) return;
      if (!LV.feitos) { LV = null; location.hash = "#hoje"; return; }
      LV.fim = true; render(); window.scrollTo(0, 0);
    },
    "livre-continuar-treino"() { LV.fim = false; carregarLivre(); },
    "livre-sair"() { LV = null; location.hash = "#hoje"; },
    "livre-desfazer"() {
      if (!LV || !LV.q) return;
      desfazerAnotacao(LV.anotadas, LV.fonte === "rapidas" ? LV.q.id : chaveEnem(LV.q));
      render(); toast("Tirei do caderno.");
    },
    "livre-anotar"() {
      if (!LV || !LV.q) return;
      if (LV.fonte === "rapidas") LV.anotadas[LV.q.id] = anotarQuestao(LV.q);
      else LV.anotadas[chaveEnem(LV.q)] = anotarEnem(LV.q);
      render(); toast("Foi pro caderno.");
    },
    "enem-iniciar"() { iniciarEnem(); },
    "enem-tentar"() { carregarEnem(); },
    "enem-responder"(el) { responderEnem(el.dataset.l); },
    "enem-continuar"() { continuarEnem(); },
    "enem-mais"() { EN.fim = false; EN.acertos = 0; EN.feitos = 0; EN.erradas = []; clearInterval(timerEnem); timerEnem = setInterval(tickEnem, 1000); carregarEnem(); },
    "enem-anotar"() {
      if (!EN || !EN.q || EN.anotadas[chaveEnem(EN.q)]) return;
      EN.anotadas[chaveEnem(EN.q)] = anotarEnem(EN.q);
      render();
      toast("Foi pro caderno. Volta amanhã na revisão.");
    },
    "enem-sair"() {
      if (EN && !EN.fim && EN.feitos % POR_RODADA !== 0 && !confirm("Se sair agora, essa rodada não conta pro foguinho. Sair mesmo?")) return;
      EN = null; clearInterval(timerEnem); timerEnem = null;
      location.hash = "#hoje";
    },
    lingua(el) {
      S.perfil.lingua = el.dataset.l;
      document.querySelectorAll('[data-acao="lingua"]').forEach((b) => b.setAttribute("aria-pressed", b === el));
      salvar({ semCartas: true });
    },
    "trocar-foto"() { document.getElementById("foto-input").click(); },
    "ocultar-instalar"() { S.ocultarInstalar = true; salvar(); render(); },
    "ativar-push"() { ativarPush(); },
    async "enviar-codigo"() {
      const texto = `Código dos lembretes do Missão ENEM:\n${S.push.codigo}`;
      if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(S.push.codigo); toast("Código copiado! Cole no WhatsApp."); }
      catch (e) { toast("Segure o dedo no código pra copiar."); }
    },
    async "testar-notif"() {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Missão ENEM", { body: "Teste de aviso funcionando! 💛", icon: "icons/icon-192.png" });
      } catch (e) { toast("Não deu: " + e.message); }
    },
    async exportar() {
      const nome = `missao-enem-copia-${hoje()}.json`;
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
      const arq = new File([blob], nome, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq], title: nome }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    zerar() {
      if (!confirm("Apagar TODO o progresso deste celular?")) return;
      if (!confirm("Tem certeza mesmo? Isso não tem volta (a não ser com uma cópia salva).")) return;
      const chave = S.cartas.chave;
      S = padrao();
      S.cartas.chave = chave;
      salvar(); location.hash = "#hoje"; render();
    },
  };

  function responderRevisao(lembrou) {
    const e = S.erros.find((x) => x.id === REV.fila[0]);
    if (e) {
      if (lembrou) {
        e.caixa = (e.caixa || 0) + 1;
        if (e.caixa >= INTERVALOS.length) e.dominado = true;
        else e.proxima = agendar(e.area, INTERVALOS[e.caixa]);
      } else {
        e.caixa = 0;
        e.proxima = agendar(e.area, 1);
      }
      e.revisoes = (e.revisoes || 0) + 1;
      S.contadores.revisoes = (S.contadores.revisoes || 0) + 1;
      const x = dia(hoje());
      x.revisou = true;
      x.atividade = true;
    }
    REV.fila.shift();
    REV.mostrando = false;
    REV.feitos++;
    salvar();
    if (!REV.fila.length) confete();
    render();
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el) return;
    const fn = acoes[el.dataset.acao];
    if (fn) { ev.preventDefault(); fn(el); }
  });

  document.addEventListener("change", (ev) => {
    if (ev.target.id === "f-topico") {
      document.getElementById("campo-livre").classList.toggle("hide", ev.target.value !== "outro");
    }
    if (ev.target.id === "foto-input" && ev.target.files[0]) {
      const img = new Image();
      img.onload = () => {
        const lado = 240, cv = document.createElement("canvas");
        cv.width = cv.height = lado;
        const m = Math.min(img.width, img.height);
        cv.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
        S.foto = cv.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
        salvar(); render();
      };
      img.src = URL.createObjectURL(ev.target.files[0]);
    }
    if (ev.target.id === "importar" && ev.target.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const dados = JSON.parse(r.result);
          if (!dados || dados.v !== 1 || !Array.isArray(dados.erros)) throw new Error("arquivo inválido");
          if (!confirm("Restaurar esta cópia? O que está no celular agora será substituído.")) return;
          localStorage.setItem(KEY, JSON.stringify(dados));
          S = carregar();
          salvar(); render(); toast("Cópia restaurada!");
        } catch (e) { toast("Esse arquivo não é uma cópia do Missão ENEM."); }
      };
      r.readAsText(ev.target.files[0]);
    }
  });

  document.addEventListener("submit", async (ev) => {
    const f = ev.target;
    ev.preventDefault();
    if (f.id === "form-erro") {
      const licao = document.getElementById("f-licao").value.trim();
      if (!licao) { toast("Escreve o que você precisa lembrar 🙂"); return; }
      const dados = {
        area: f.dataset.area,
        topico: document.getElementById("f-topico").value,
        assuntoLivre: document.getElementById("f-livre").value.trim(),
        questao: document.getElementById("f-questao").value.trim(),
        motivo: f.dataset.motivo || "",
        licao,
      };
      if (f.dataset.id) {
        Object.assign(S.erros.find((e) => e.id === f.dataset.id), dados);
        toast("Erro atualizado");
      } else {
        S.erros.push(Object.assign({ id: uid(), data: hoje(), caixa: 0, proxima: agendar(dados.area, 1), dominado: false }, dados));
        S.contadores.erros = (S.contadores.erros || 0) + 1;
        marcarAtividade();
        toast("Guardado! Volta pra revisão amanhã.");
      }
      salvar();
      location.hash = "#erros";
    } else if (f.id === "form-sim") {
      const val = (id) => { const v = document.getElementById(id).value; return v === "" ? null : Math.max(0, Math.min(45, Number(v))); };
      const s = { id: uid(), data: document.getElementById("s-data").value || hoje(), lc: val("s-lc"), ch: val("s-ch"), cn: val("s-cn"), mt: val("s-mt") };
      if ([s.lc, s.ch, s.cn, s.mt].every((v) => v == null)) { toast("Preencha pelo menos uma área"); return; }
      S.simulados.push(s);
      marcarAtividade();
      formAberto = null;
      salvar(); render(); toast("Simulado registrado!");
    } else if (f.id === "form-perfil") {
      S.perfil.nome = document.getElementById("a-nome").value.trim() || C.nome;
      S.perfil.curso = document.getElementById("a-curso").value.trim();
      S.perfil.meta = document.getElementById("a-meta").value.trim();
      salvar(); toast("Salvo!");
    } else if (f.id === "form-chave") {
      const msg = document.getElementById("k-msg");
      const resp = document.getElementById("k-resp").value;
      msg.textContent = "Conferindo…";
      try {
        const chave = await Comum.derivar(resp, PACOTE.salt, PACOTE.iter);
        CARTAS = (await Comum.decifrar(PACOTE, chave)).cartas || [];
        S.cartas.chave = await Comum.exportar(chave);
        salvar();
        render();
      } catch (e) {
        msg.textContent = "Hmm, não é essa. Tenta de novo (sem se preocupar com acento ou maiúscula).";
      }
    }
  });

  // ---------- roteador ----------
  const ROTAS = { hoje: telaHoje, desafio: telaDesafio, enem: telaEnem, livre: telaLivre, simulado: telaSimulado, "enem-ver": telaEnemVer, erros: telaErros, "novo-erro": telaNovoErro, revisar: telaRevisar, raiox: telaRaiox, cartas: telaCartas, prova: telaProva, ajustes: telaAjustes };
  const ABA_DE = { "novo-erro": "erros", revisar: "erros", desafio: "hoje", enem: "hoje", livre: "hoje", simulado: "hoje", "enem-ver": "erros" };
  let rotaAtual = "";
  function render() {
    const [rota, arg] = (location.hash.slice(1) || "hoje").split("/");
    const fn = ROTAS[rota] || telaHoje;
    if (rota !== "revisar") REV = null;
    if (rota !== "desafio" || (rotaAtual !== "desafio" && DES && DES.fim)) { DES = null; clearInterval(timerDes); timerDes = null; }
    if (rota !== "enem" || (rotaAtual !== "enem" && EN && EN.fim)) { EN = null; clearInterval(timerEnem); timerEnem = null; }
    if (rota !== "enem-ver") VER = null;
    if (rota !== "livre") LV = null;
    if (rota !== "simulado" && SIM) { if (S.sims[SIM] && !S.sims[SIM].fim) pausarSim(); else SIM = null; }
    if (rota !== rotaAtual) argAplicado = null;
    if (rota !== rotaAtual) formAberto = null;
    rotaAtual = rota;
    document.body.classList.toggle("modo-desafio", (rota === "desafio" && !!DES && !DES.fim) || (rota === "enem" && !!EN && !EN.fim) || (rota === "livre" && !!LV && !LV.fim) || (rota === "simulado" && !!SIM && S.sims[SIM] && !S.sims[SIM].fim));
    app.innerHTML = fn(arg);
    const aba = ABA_DE[rota] || rota;
    document.querySelectorAll("nav.abas a").forEach((a) => {
      if (a.dataset.aba === aba) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const rev = paraRevisar().length;
    const abaErros = document.querySelector('nav.abas a[data-aba="erros"]');
    abaErros.querySelector(".bolinha")?.remove();
    if (rev) abaErros.insertAdjacentHTML("beforeend", `<span class="bolinha">${rev}</span>`);
    const abaCartas = document.querySelector('nav.abas a[data-aba="cartas"]');
    abaCartas.querySelector(".bolinha")?.remove();
    const novas = CARTAS ? CARTAS.filter((c) => S.cartas.liberadas[c.id] && !S.cartas.lidas[c.id]).length : 0;
    if (novas) abaCartas.insertAdjacentHTML("beforeend", `<span class="bolinha">${novas}</span>`);
    const pausa = rota === "hoje" || rota === "raiox" || (rota === "desafio" && DES && DES.fim) || (rota === "enem" && EN && EN.fim) || (rota === "livre" && LV && (LV.fim || LV.resp !== null)) || (rota === "simulado" && !(SIM && S.sims[SIM] && !S.sims[SIM].fim));
    if (pausa && S.diagPendente) setTimeout(mostrarDiagnostico, 700);
    if (document.getElementById("relogio")) { tickRelogio(); if (!timerRelogio) timerRelogio = setInterval(tickRelogio, 1000); }
  }
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  // virou o dia com o app aberto
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { checarCartas(); render(); } });

  aplicarProtetor();
  render();
  carregarCartas();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
