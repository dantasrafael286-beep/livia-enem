"""Cartas e lembretes num arquivo de texto só, fácil de editar.

  python ferramentas/personalizar.py exportar   -> cria privado/PERSONALIZAR.txt
  python ferramentas/personalizar.py importar   -> lê o arquivo editado e atualiza
                                                   privado/cartas.json, lembretes.json
                                                   e cartas.enc.json
"""
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT = os.path.join(RAIZ, "privado", "PERSONALIZAR.txt")
CARTAS = os.path.join(RAIZ, "privado", "cartas.json")
LEMBRETES = os.path.join(RAIZ, "lembretes.json")
sys.stdout.reconfigure(encoding="utf-8")

QUANDO = {
    "inicio": lambda c: "na primeira vez que ela abrir o app",
    "sequencia": lambda c: f"com {c['n']} dias seguidos de foguinho",
    "dias": lambda c: f"com {c['n']} foguinhos acesos",
    "erros": lambda c: f"com {c['n']} erros anotados no caderno",
    "revisoes": lambda c: f"com {c['n']} revisões feitas",
    "simulados": lambda c: f"quando ela registrar {c['n']} simulado(s)",
    "redacoes": lambda c: f"com {c['n']} redações escritas",
    "data": lambda c: "em " + "/".join(reversed(c["data"].split("-")[1:])) + (f" às {c['hora']}" if c.get("hora") else ""),
}

# (chave no lembretes.json, título da seção, tem lista de mensagens?)
SECOES = [
    ("bom_dia", "LEMBRETE: BOM DIA (todo dia às 6h)", True),
    ("boa_noite", "LEMBRETE: BOA NOITE (todo dia às 20h)", True),
    ("domingo_simulado", "LEMBRETE: DOMINGO DE SIMULADO (substitui o bom dia nos domingos antes da prova)", False),
    ("carta_nova", "LEMBRETE: CARTA NOVA (vai junto no aviso do dia em que uma carta de data abre)", False),
    ("vespera_manha", "LEMBRETE: VÉSPERA DA PROVA, MANHÃ (sáb 07/11 e sáb 14/11, 6h)", False),
    ("vespera_noite", "LEMBRETE: VÉSPERA DA PROVA, NOITE (sáb 07/11 e sáb 14/11, 20h)", False),
    ("prova_manha", "LEMBRETE: DIA DA PROVA, MANHÃ (dom 08/11 e dom 15/11, 6h)", False),
    ("fim_dia1", "LEMBRETE: FIM DO 1º DIA (dom 08/11, 20h)", False),
    ("acabou", "LEMBRETE: ACABOU O ENEM (dom 15/11, 20h)", False),
]

CABECALHO = """COMO EDITAR ESTE ARQUIVO
========================
- Mude só os textos. NÃO apague as linhas que começam com "===".
- Cartas: o título fica depois de "Título:" e o texto vai embaixo de "Texto:".
  Pode ter várias linhas; linha em branco vira parágrafo. Pode usar emoji.
- Lembretes aparecem na notificação do celular: deixe curtinhos (até umas 2 linhas).
  Nas listas, cada linha começando com "- " é uma mensagem; o app sorteia uma por dia.
  Pode apagar ou acrescentar linhas "- ".
- Palavras especiais nos lembretes: {nome} vira Lívia, {autor} vira Rafael,
  {dias} vira quantos dias faltam, {qual} vira "pro ENEM" ou "pro 2º dia do ENEM".
- "Abre:" é só informação. Se quiser mudar QUANDO uma carta abre, me fale.
- Salve o arquivo e me avise: eu publico.

"""


def exportar():
    cartas = json.load(open(CARTAS, encoding="utf-8"))
    lem = json.load(open(LEMBRETES, encoding="utf-8"))
    out = [CABECALHO]
    out.append(f"=== ASSINATURA DAS CARTAS ===\n{cartas.get('assinatura', '')}\n")
    for n, c in enumerate(cartas["cartas"], 1):
        out.append(f"=== CARTA {n} ===\nAbre: {QUANDO[c['cond']['tipo']](c['cond'])}\nTítulo: {c.get('titulo', '')}\nTexto:\n{c.get('texto', '').strip()}\n")
    for k, titulo, lista in SECOES:
        v = lem[k]
        if lista:
            out.append(f"=== {titulo} ===\nTítulo: {lem[k + '_titulo']}\nMensagens:\n" + "\n".join("- " + m for m in v) + "\n")
        elif isinstance(v, dict):
            out.append(f"=== {titulo} ===\nTítulo: {v['titulo']}\nTexto: {v['texto']}\n")
        else:
            out.append(f"=== {titulo} ===\nTexto: {v}\n")
    with open(TXT, "w", encoding="utf-8", newline="\r\n") as f:
        f.write("\n".join(out))
    print("Criado:", TXT)


def secoes(txt):
    partes = re.split(r"^=== (.+?) ===[ \t]*$", txt, flags=re.M)
    return {partes[i].strip(): partes[i + 1] for i in range(1, len(partes), 2)}


def campo(bloco, nome):
    m = re.search(rf"^{nome}:[ \t]*(.*)$", bloco, flags=re.M)
    return m.group(1).strip() if m else None


def importar():
    txt = open(TXT, encoding="utf-8-sig").read().replace("\r\n", "\n")
    S = secoes(txt)
    cartas = json.load(open(CARTAS, encoding="utf-8"))
    lem = json.load(open(LEMBRETES, encoding="utf-8"))
    problemas = []

    if "ASSINATURA DAS CARTAS" in S:
        cartas["assinatura"] = S["ASSINATURA DAS CARTAS"].strip()
    for n, c in enumerate(cartas["cartas"], 1):
        b = S.get(f"CARTA {n}")
        if b is None:
            problemas.append(f"CARTA {n} sumiu do arquivo (mantive a antiga)")
            continue
        c["titulo"] = campo(b, "Título") or ""
        m = re.search(r"^Texto:[ \t]*\n(.*)", b, flags=re.M | re.S)
        c["texto"] = (m.group(1) if m else "").strip()
        if not c["texto"]:
            problemas.append(f"CARTA {n} ficou sem texto (não vai aparecer)")

    for k, titulo, lista in SECOES:
        b = next((v for t, v in S.items() if t == titulo or t.split(" (")[0] == titulo.split(" (")[0]), None)
        if b is None:
            problemas.append(f"{titulo.split(' (')[0]} sumiu do arquivo (mantive o antigo)")
            continue
        try:
            if lista:
                lem[k + "_titulo"] = campo(b, "Título") or lem[k + "_titulo"]
                msgs = [l[2:].strip() for l in b.splitlines() if l.startswith("- ") and l[2:].strip()]
                if msgs:
                    lem[k] = msgs
                else:
                    problemas.append(f"{titulo.split(' (')[0]} ficou sem mensagens (mantive as antigas)")
            elif isinstance(lem[k], dict):
                lem[k] = {"titulo": campo(b, "Título") or lem[k]["titulo"], "texto": campo(b, "Texto") or lem[k]["texto"]}
            else:
                lem[k] = campo(b, "Texto") or lem[k]
            # confere as palavras especiais
            v = lem[k]
            textos = v if isinstance(v, list) else list(v.values()) if isinstance(v, dict) else [v]
            for s in textos + [lem.get(k + "_titulo", "")]:
                s.format(nome="", autor="", dias="", qual="")
        except (KeyError, IndexError, ValueError) as e:
            problemas.append(f"{titulo.split(' (')[0]}: palavra entre chaves inválida ({e}); use só {{nome}}, {{autor}}, {{dias}}, {{qual}}")

    with open(CARTAS, "w", encoding="utf-8") as f:
        json.dump(cartas, f, ensure_ascii=False, indent=2)
    with open(LEMBRETES, "w", encoding="utf-8") as f:
        json.dump(lem, f, ensure_ascii=False, indent=2)
        f.write("\n")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gerar_cartas
    sys.argv = [sys.argv[0], CARTAS]
    gerar_cartas.main()
    print("Lembretes atualizados em lembretes.json")
    if problemas:
        print("\nATENÇÃO:")
        for p in problemas:
            print(" -", p)


if __name__ == "__main__":
    {"exportar": exportar, "importar": importar}[sys.argv[1] if len(sys.argv) > 1 else "exportar"]()
