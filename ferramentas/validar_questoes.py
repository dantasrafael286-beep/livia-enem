"""Confere o banco de questões (questoes/*.js).

Uso: python ferramentas/validar_questoes.py
"""
import collections
import glob
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")


def main():
    data = open(os.path.join(RAIZ, "data.js"), encoding="utf-8").read()
    topicos = set(re.findall(r'id: "([a-z]+-[a-z0-9]+)"', data))
    ids, problemas, total = set(), [], 0
    for arq in sorted(glob.glob(os.path.join(RAIZ, "questoes", "*.js"))):
        nome = os.path.basename(arq)
        txt = open(arq, encoding="utf-8").read()
        m = re.search(r"window\.QUESTOES\s*=\s*\(window\.QUESTOES \|\| \[\]\)\.concat\((\[.*\])\);\s*$", txt, re.S)
        if not m:
            problemas.append(f"{nome}: formato do arquivo fora do padrão")
            continue
        try:
            lista = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            problemas.append(f"{nome}: JSON inválido ({e})")
            continue
        corretas = collections.Counter()
        por_topico = collections.Counter()
        for q in lista:
            qid = q.get("id", "?")
            if qid in ids:
                problemas.append(f"{nome}/{qid}: id repetido")
            ids.add(qid)
            if q.get("t") not in topicos:
                problemas.append(f"{nome}/{qid}: tópico desconhecido {q.get('t')}")
            a = q.get("a", [])
            if len(a) != 5 or len(set(a)) != 5 or not all(isinstance(x, str) and x.strip() for x in a):
                problemas.append(f"{nome}/{qid}: precisa de 5 alternativas diferentes")
            if not isinstance(q.get("c"), int) or not 0 <= q["c"] <= 4:
                problemas.append(f"{nome}/{qid}: índice da correta inválido")
            if not q.get("q") or len(q["q"]) > 260:
                problemas.append(f"{nome}/{qid}: enunciado vazio ou longo ({len(q.get('q', ''))})")
            if not q.get("e"):
                problemas.append(f"{nome}/{qid}: falta explicação")
            if any(len(x) > 80 for x in a):
                problemas.append(f"{nome}/{qid}: alternativa longa demais")
            corretas[q.get("c")] += 1
            por_topico[q.get("t")] += 1
        total += len(lista)
        print(f"{nome}: {len(lista)} questões | corretas por letra {dict(sorted(corretas.items()))} | tópicos {len(por_topico)}")
    print(f"TOTAL: {total}")
    if problemas:
        print("\nPROBLEMAS:")
        for p in problemas:
            print(" -", p)
        sys.exit(1)
    print("OK, nenhum problema de formato.")


if __name__ == "__main__":
    main()
