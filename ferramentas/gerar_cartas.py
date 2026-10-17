"""Cifra as cartas para o app.

Uso:  python ferramentas/gerar_cartas.py [privado/cartas.json]

Lê o arquivo com as cartas em texto aberto (fica só no seu PC; a pasta
privado/ não vai para o GitHub) e grava cartas.enc.json, que é publicado.
Precisa do pacote "cryptography" (pip install cryptography).
"""
import base64
import json
import os
import re
import secrets
import sys
import unicodedata

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "cartas.enc.json")
ITER = 310000  # igual ao comum.js


def normalizar(t):
    # mesma regra do comum.js: sem acento, minúsculo, só letras e números
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if not ("̀" <= c <= "ͯ"))
    return re.sub(r"[^a-z0-9]", "", t.lower())


def chave(resposta, salt):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER)
    return kdf.derive(normalizar(resposta).encode())


def b64(b):
    return base64.b64encode(b).decode()


def main():
    origem = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "privado", "cartas.json")
    with open(origem, encoding="utf-8") as f:
        src = json.load(f)

    if not normalizar(src.get("resposta", "")):
        sys.exit("Falta a resposta da pergunta secreta.")

    # reaproveita o salt se a resposta não mudou, assim o celular dela continua destrancado
    salt = None
    if os.path.exists(SAIDA):
        with open(SAIDA, encoding="utf-8") as f:
            antigo = json.load(f)
        try:
            s = base64.b64decode(antigo["salt"])
            AESGCM(chave(src["resposta"], s)).decrypt(base64.b64decode(antigo["iv"]), base64.b64decode(antigo["dados"]), None)
            salt = s
        except Exception:
            print("Aviso: a resposta mudou. Ela vai precisar responder a pergunta de novo.")
    salt = salt or secrets.token_bytes(16)

    assinatura = src.get("assinatura", "")
    cartas, puladas = [], []
    for c in src["cartas"]:
        if not (c.get("texto") or "").strip():
            puladas.append(c["id"])
            continue
        cartas.append({
            "id": c["id"],
            "titulo": c.get("titulo", ""),
            "cond": c["cond"],
            "texto": c["texto"].strip(),
            "assinatura": c.get("assinatura") or assinatura,
        })

    iv = secrets.token_bytes(12)
    dados = AESGCM(chave(src["resposta"], salt)).encrypt(iv, json.dumps({"cartas": cartas}, ensure_ascii=False).encode(), None)
    pacote = {
        "v": 1,
        "pergunta": src["pergunta"],
        "dica": src.get("dica", ""),
        "salt": b64(salt),
        "iter": ITER,
        "iv": b64(iv),
        "dados": b64(dados),
        # só as datas, sem conteúdo: o robô dos lembretes avisa "carta nova" nesses dias
        "agenda": [{"data": c["cond"]["data"], "hora": c["cond"].get("hora", "00:00")} for c in cartas if c["cond"]["tipo"] == "data"],
    }
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, indent=1)
    print(f"{len(cartas)} cartas cifradas em cartas.enc.json")
    if puladas:
        print("Ainda sem texto (não entraram):", ", ".join(puladas))


if __name__ == "__main__":
    main()
