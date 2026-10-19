"""Gera tri.js com os parâmetros oficiais da TRI de cada questão (2015-2023).

Uso: python ferramentas/montar_tri.py   (precisa de: pip install remotezip requests)

1. Lê só o arquivo ITENS_PROVA_<ano>.csv de dentro do zip de microdados do INEP
   (download parcial; o zip inteiro tem centenas de MB).
2. Busca o gabarito de cada questão no acervo api.enem.dev.
3. Acha o caderno do INEP que corresponde à numeração do enem.dev alinhando as
   sequências de gabarito (aguenta numeração diferente e questão faltando).
4. Grava [a, b, c] por ano > área > número da questão.

As constantes de escala (ESCALA) foram obtidas comparando o θ (EAP, priori N(0,1),
D = 1) com as notas oficiais de candidatos reais dos microdados de 2016 e 2023.
"""
import collections
import csv
import difflib
import io
import json
import os
import time

import requests
import urllib3
from remotezip import RemoteZip

urllib3.disable_warnings()
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANOS = range(2015, 2024)
ESCALA = {"mt": [129.6352, 500.0303], "cn": [113.0965, 501.1471], "ch": [112.3047, 501.4959], "lc": [108.0864, 499.9766]}
LINGUA = {"0": "ingles", "1": "espanhol"}


def faixa(area, ano):
    novo = ano >= 2017
    ini = {"lc": 1 if novo else 91, "ch": 46 if novo else 1, "cn": 91 if novo else 46, "mt": 136}[area]
    return ini, ini + 44


def eh_lingua(ano, i):
    return i <= 5 if ano >= 2017 else 91 <= i <= 95


def itens_inep(ano):
    url = f"https://download.inep.gov.br/microdados/microdados_enem_{ano}.zip"
    for tentativa in range(4):
        try:
            with RemoteZip(url, verify=False, timeout=60) as z:
                nome = next(i.filename for i in z.infolist() if "ITENS_PROVA" in i.filename.upper() and i.filename.lower().endswith(".csv"))
                bruto = z.read(nome)
            break
        except Exception:
            time.sleep(15)
    else:
        raise RuntimeError(f"INEP não respondeu para {ano}")
    try:
        txt = bruto.decode("utf-8")
    except UnicodeDecodeError:
        txt = bruto.decode("latin-1")
    return list(csv.DictReader(io.StringIO(txt), delimiter=";"))


def gabaritos_api(ano):
    qs, off = [], 0
    while True:
        for _ in range(5):
            r = requests.get(f"https://api.enem.dev/v1/exams/{ano}/questions", params={"limit": 50, "offset": off}, timeout=30)
            if r.status_code != 429:
                break
            time.sleep(5)
        d = r.json()
        qs += [{"i": q["index"], "l": q.get("language"), "g": q.get("correctAlternative")} for q in d["questions"]]
        time.sleep(1.2)
        if not d["metadata"]["hasMore"]:
            return qs
        off += 50


def num(x):
    return float(x.replace(",", ".")) if x not in (None, "") else None


def main():
    tri = {}
    for ano in ANOS:
        rows, api = itens_inep(ano), gabaritos_api(ano)
        tri[ano] = {}
        for area in ["lc", "ch", "cn", "mt"]:
            a0, a1 = faixa(area, ano)
            d = {}
            for lg in ([None] if area != "lc" else ["ingles", "espanhol"]):
                vistos = {}
                for q in sorted((q for q in api if a0 <= q["i"] <= a1), key=lambda q: q["i"]):
                    if area == "lc" and q["l"] not in (None, lg):
                        continue
                    if q["i"] not in vistos or q["l"] == lg:
                        vistos[q["i"]] = q
                aq = [vistos[k] for k in sorted(vistos)]
                sa = "".join(q["g"] or "?" for q in aq)
                cadernos = collections.defaultdict(dict)
                for r in rows:
                    if r["SG_AREA"] != area.upper():
                        continue
                    tl = LINGUA.get((r.get("TP_LINGUA") or "").strip())
                    if tl and lg and tl != lg:
                        continue
                    cadernos[r["CO_PROVA"]][int(r["CO_POSICAO"])] = r
                melhor = None
                for itens in cadernos.values():
                    ps = sorted(itens)
                    sm = difflib.SequenceMatcher(None, sa, "".join(itens[p]["TX_GABARITO"] for p in ps), autojunk=False)
                    m = sum(b.size for b in sm.get_matching_blocks())
                    if not melhor or m > melhor[0]:
                        melhor = (m, ps, itens, sm)
                _, ps, itens, sm = melhor
                for blk in sm.get_matching_blocks():
                    if blk.size < 3:
                        continue
                    for t in range(blk.size):
                        q, r = aq[blk.a + t], itens[ps[blk.b + t]]
                        a, b, c = num(r["NU_PARAM_A"]), num(r["NU_PARAM_B"]), num(r["NU_PARAM_C"])
                        if (r.get("IN_ITEM_ABAN") or "0").strip() == "1" or None in (a, b, c):
                            continue
                        chave = str(q["i"]) + (f"-{lg}" if area == "lc" and eh_lingua(ano, q["i"]) else "")
                        d[chave] = [round(a, 4), round(b, 4), round(c, 4)]
            tri[ano][area] = d
            print(ano, area, len(d), "questões com parâmetro")
    cab = ("// Parâmetros oficiais da TRI (INEP, microdados ITENS_PROVA 2015-2023), por ano > área > número da questão no enem.dev.\n"
           "// Cada item: [a, b, c] do modelo logístico de 3 parâmetros. Gerado por ferramentas/montar_tri.py.\n"
           "// Nota = escala[0] * θ + escala[1], com θ estimado por EAP (priori normal padrão, D = 1),\n"
           "// conferido contra as notas oficiais dos microdados de 2016 e 2023 (diferença menor que 1 ponto).\n")
    with open(os.path.join(RAIZ, "tri.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write(cab + "window.TRI_ESCALA = " + json.dumps(ESCALA) + ";\nwindow.TRI_PARAMS = " + json.dumps(tri, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
