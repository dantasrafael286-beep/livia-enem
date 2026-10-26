"""Manda os lembretes pro celular. Roda no GitHub Actions (ver .github/workflows/lembretes.yml).

Variáveis de ambiente:
  VAPID_PRIVATE_KEY  chave privada (GitHub Secret)
  PUSH_SUBS          códigos "ENEM:..." que o app gera, um por linha (GitHub Secret; nunca no repo)
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


def erro(msg):
    # "::error::" vira anotação pública no Actions: dá para ver o motivo sem abrir o log
    print(f"::error::{msg}")
    sys.exit(1)


def escolhe(lista, hoje):
    return lista[hoje.toordinal() % len(lista)]




def ler_textos():
    # os textos ficam em lembretes.json (editado via privado/PERSONALIZAR.txt)
    with open(os.path.join(RAIZ, "lembretes.json"), encoding="utf-8") as f:
        return json.load(f)


def mensagem(momento, agora, cfg, agenda, T=None):
    T = T or ler_textos()
    hoje = agora.date()
    d1 = dt.date.fromisoformat(cfg["prova1"])
    d2 = dt.date.fromisoformat(cfg["prova2"])
    alvo, qual = (d1, "pro ENEM") if hoje <= d1 else (d2, "pro 2º dia do ENEM")
    vars_ = {"nome": cfg["nome"], "autor": cfg["autor"], "dias": (alvo - hoje).days, "qual": qual}
    f = lambda s: s.format(**vars_)
    par = lambda k: (f(T[k]["titulo"]), f(T[k]["texto"]))
    carta_hoje = any(a["data"] == hoje.isoformat() and (momento == "noite" or a.get("hora", "00:00") <= "06:00") for a in agenda)
    extra = " " + f(T["carta_nova"]) if carta_hoje else ""

    if hoje > d2 or (hoje == d2 and momento == "noite"):
        return par("acabou") if hoje == d2 else None
    if hoje == d1 or hoje == d2:
        if momento == "manha":
            t, c = par("prova_manha")
            return t, c + extra
        return par("fim_dia1")
    if hoje == d1 - dt.timedelta(days=1) or hoje == d2 - dt.timedelta(days=1):
        t, c = par("vespera_manha" if momento == "manha" else "vespera_noite")
        return t, c + extra

    if momento == "manha":
        corpo = f(escolhe(T["bom_dia"], hoje))
        if hoje.weekday() == 6 and hoje < d1:
            corpo = f(T["domingo_simulado"])
        return f(T["bom_dia_titulo"]), corpo + extra
    return f(T["boa_noite_titulo"]), f(escolhe(T["boa_noite"], hoje)) + extra


def main():
    cfg = ler_config()
    agora = dt.datetime.now(BRT)
    agendado = os.environ.get("AGENDA", "")
    momento = os.environ.get("MOMENTO") or ("manha" if agendado.startswith("0 9 ") else "noite" if agendado else ("manha" if agora.hour < 14 else "noite"))

    titulo, corpo = (os.environ.get("TITULO") or "").strip(), (os.environ.get("MENSAGEM") or "").strip()
    if not corpo:
        msg = mensagem(momento, agora, cfg, ler_agenda())
        if not msg:
            print("ENEM já passou, nada a enviar.")
            return
        titulo, corpo = msg
    titulo = titulo or "Missão ENEM"

    # os códigos dos aparelhos ficam só no secret (não vão para o repositório público)
    subs = list({s["endpoint"]: s for s in assinaturas(os.environ.get("PUSH_SUBS"))}.values())
    if not subs:
        # falha de propósito, com o motivo visível nas anotações do Actions
        print("::error::Falta o secret PUSH_SUBS: cole o código ENEM:... do app em Settings > Secrets and variables > Actions.")
    chave = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not chave:
        erro("Falta o secret VAPID_PRIVATE_KEY (Settings > Secrets and variables > Actions).")
    try:
        vapid = Vapid.from_raw(chave.encode())
        from cryptography.hazmat.primitives import serialization
        pub = vapid.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        pub = base64.urlsafe_b64encode(pub).rstrip(b"=").decode()
    except Exception as e:
        erro(f"VAPID_PRIVATE_KEY inválida ({type(e).__name__}): copie de novo a linha de privado/VAPID_PRIVATE_KEY.txt.")
    publica = re.search(r'vapidPublica:\s*"([^"]+)"', open(os.path.join(RAIZ, "config.js"), encoding="utf-8").read()).group(1)
    if pub != publica:
        erro("VAPID_PRIVATE_KEY não combina com a chave pública do app (config.js): copie de novo a de privado/VAPID_PRIVATE_KEY.txt.")
    print("::notice::VAPID_PRIVATE_KEY ok (combina com a chave do app).")
    if not subs:
        sys.exit(1)
    if os.environ.get("TESTE"):
        print(f"::notice::Teste ok: {len(subs)} aparelho(s) cadastrado(s) e chave VAPID certa. Nada foi enviado.")
        return

    print(f"[{agora:%d/%m %H:%M}] {momento}: {titulo} | {corpo}")
    falhas = 0
    for i, sub in enumerate(subs, 1):
        try:
            webpush(
                subscription_info=sub,
                # tag única: uma notificação nova não apaga a anterior que ela ainda não viu
                data=json.dumps({"title": titulo, "body": corpo, "url": "./#hoje", "tag": f"m{int(agora.timestamp())}"}, ensure_ascii=False),
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
            print(f"::warning::aparelho {i}: envio recusado, status {status}{dica}")
    if falhas == len(subs):
        erro("Nenhum aparelho recebeu (veja os avisos acima).")


if __name__ == "__main__":
    main()
