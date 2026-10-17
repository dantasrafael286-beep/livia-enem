"""Manda os lembretes pro celular. Roda no GitHub Actions (ver .github/workflows/lembretes.yml).

Variáveis de ambiente:
  VAPID_PRIVATE_KEY  chave privada (GitHub Secret)
  PUSH_SUBS          códigos "ENEM:..." que o app gera, um por linha (GitHub Secret)
  MOMENTO            "manha" ou "noite" (automático pelo horário agendado)
  TITULO / MENSAGEM  opcional: manda uma mensagem sua no lugar da automática
"""
import base64
import datetime as dt
import json
import os
import re
import sys

from py_vapid import Vapid
from pywebpush import WebPushException, webpush

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRT = dt.timezone(dt.timedelta(hours=-3))


def ler_config():
    txt = open(os.path.join(RAIZ, "config.js"), encoding="utf-8").read()
    pega = lambda k: re.search(k + r':\s*"([^"]*)"', txt).group(1)
    return {k: pega(k) for k in ("nome", "autor", "prova1", "prova2")}


def ler_agenda():
    try:
        with open(os.path.join(RAIZ, "cartas.enc.json"), encoding="utf-8") as f:
            return json.load(f).get("agenda", [])
    except FileNotFoundError:
        return []


def assinaturas(bruto):
    subs = []
    for m in re.finditer(r"ENEM:([A-Za-z0-9_-]+)", bruto or ""):
        b = m.group(1)
        subs.append(json.loads(base64.urlsafe_b64decode(b + "=" * (-len(b) % 4))))
    for linha in (bruto or "").splitlines():
        if linha.strip().startswith("{"):
            subs.append(json.loads(linha))
    return subs


def escolhe(lista, hoje):
    return lista[hoje.toordinal() % len(lista)]


BOM_DIA = [
    "O plano de hoje já tá pronto no app. Bora?",
    "Um passo de cada vez. Abre o app e vê o plano de hoje.",
    "Hoje conta. Começa pela revisão dos erros, são 5 minutinhos.",
    "Café, água e o plano do dia. Você consegue.",
    "Constância vence talento. Bora manter a sequência 🔥",
    "Questão fácil primeiro, sempre. Abre o plano de hoje.",
    "Cada dia estudado é ponto a mais em novembro.",
]
BOA_NOITE = [
    "Já marcou o dia de hoje? Até 20 minutinhos contam pra sequência 🔥",
    "Antes de dormir: revisou o caderno de erros? 5 minutos e pronto.",
    "Se estudou hoje, marca no app. Se não deu, tudo bem: amanhã tem plano novo.",
    "Errou alguma questão hoje? Anota no caderno antes de esquecer.",
    "Fechou o dia? Descansa, dormir bem também é estudar 💛",
]


def mensagem(momento, agora, cfg, agenda):
    nome, autor = cfg["nome"], cfg["autor"]
    hoje = agora.date()
    d1 = dt.date.fromisoformat(cfg["prova1"])
    d2 = dt.date.fromisoformat(cfg["prova2"])
    carta_hoje = any(a["data"] == hoje.isoformat() and (momento == "noite" or a.get("hora", "00:00") <= "07:00") for a in agenda)
    extra = f" 💌 Tem carta nova do {autor} te esperando." if carta_hoje else ""

    if hoje > d2 or (hoje == d2 and momento == "noite"):
        if hoje == d2:
            return "ACABOU!!! 🎉", f"{nome}, você terminou o ENEM. Orgulho demais de você. Abre o app: tem carta nova 💌"
        return None
    if hoje == d1 or hoje == d2:
        if momento == "manha":
            return "É HOJE! 💪", "Portões: 12h às 13h (horário de Brasília). Documento original com foto + caneta preta transparente." + extra
        return "1º dia: FEITO ✅", "Descansa hoje. Semana que vem é Natureza e Matemática, e você vai com tudo."
    if hoje == d1 - dt.timedelta(days=1) or hoje == d2 - dt.timedelta(days=1):
        if momento == "manha":
            return "Amanhã é o dia", "Hoje é leve: separar documento e caneta, conferir o local e dormir cedo." + extra
        return "Dorme cedo hoje 💛", f"Você está pronta, {nome}. O trabalho já foi feito. Amanhã é só mostrar." + extra

    alvo, qual = (d1, "pro ENEM") if hoje < d1 else (d2, "pro 2º dia do ENEM")
    falta = (alvo - hoje).days
    if momento == "manha":
        corpo = escolhe(BOM_DIA, hoje)
        if hoje.weekday() == 6 and hoje < d1:
            corpo = "Hoje é dia de simulado no horário real: 13h30. Prepara o lanche!"
        return f"Bom dia, {nome}! Faltam {falta} dias {qual} ☀️", corpo + extra
    return f"Faltam {falta} dias {qual}", escolhe(BOA_NOITE, hoje) + extra


def main():
    cfg = ler_config()
    agora = dt.datetime.now(BRT)
    agendado = os.environ.get("AGENDA", "")
    momento = os.environ.get("MOMENTO") or ("manha" if agendado.startswith("0 10") else "noite" if agendado else ("manha" if agora.hour < 14 else "noite"))

    titulo, corpo = (os.environ.get("TITULO") or "").strip(), (os.environ.get("MENSAGEM") or "").strip()
    if not corpo:
        msg = mensagem(momento, agora, cfg, ler_agenda())
        if not msg:
            print("ENEM já passou, nada a enviar.")
            return
        titulo, corpo = msg
    titulo = titulo or "Missão ENEM"

    subs = assinaturas(os.environ.get("PUSH_SUBS"))
    if not subs:
        print("Nenhum código em PUSH_SUBS ainda. Nada enviado.")
        return
    chave = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not chave:
        sys.exit("Falta o secret VAPID_PRIVATE_KEY.")
    vapid = Vapid.from_raw(chave.encode())

    print(f"[{agora:%d/%m %H:%M}] {momento}: {titulo} | {corpo}")
    falhas = 0
    for i, sub in enumerate(subs, 1):
        try:
            webpush(
                subscription_info=sub,
                data=json.dumps({"title": titulo, "body": corpo, "url": "./#hoje"}, ensure_ascii=False),
                vapid_private_key=vapid,
                vapid_claims={"sub": "https://github.com"},
                ttl=6 * 3600,
            )
            print(f"  aparelho {i}: enviado")
        except WebPushException as e:
            falhas += 1
            status = getattr(e.response, "status_code", "?")
            dica = " (código expirou: gere de novo no app)" if status in (404, 410) else ""
            print(f"  aparelho {i}: falhou, status {status}{dica}")
    if falhas == len(subs):
        sys.exit(1)


if __name__ == "__main__":
    main()
