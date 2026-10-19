"""Coloca as provas de 2024 e 2025 dentro do app (o acervo enem.dev só vai até 2023).

Uso: python ferramentas/montar_provas_recentes.py <pasta_com_pdfs> <pasta_com_itens_csv>

Na pasta de PDFs (do site do INEP, caderno Azul):
  <ano>_D1_CD1.pdf, <ano>_D2_CD7.pdf       provas
  GB_<ano>_D1_CD1.pdf, GB_<ano>_D2_CD7.pdf gabaritos
Na pasta de itens: itens_<ano>.csv (ITENS_PROVA dos microdados, parâmetros da TRI).

Cada questão vira uma imagem (recorte fiel do caderno, de "Questão NN" até o fim da
alternativa E, juntando os pedaços quando ela continua na outra coluna ou página).
Saída: provas/<ano>/qNNN[-lingua].webp e provas/recentes.js.
Precisa de: pip install pymupdf pillow
"""
import collections
import csv
import difflib
import io
import json
import os
import re
import sys

import pymupdf
from PIL import Image, ImageChops

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANOS = (2024, 2025)
TOPO, BASE = 60, 742          # área útil da página (sem código de barras e rodapé)
ZOOM = 2.0


def area_de(i):
    return "lc" if i <= 45 else "ch" if i <= 90 else "cn" if i <= 135 else "mt"


def gabarito_pdf(caminho):
    """{posição: letra} e {posição: {"ingles": x, "espanhol": y}} para 1 a 5."""
    linhas = [l.strip() for p in pymupdf.open(caminho) for l in p.get_text().split("\n") if l.strip()]
    simples, lingua = {}, {}
    k = 0
    while k < len(linhas):
        if re.fullmatch(r"\d{1,3}", linhas[k]):
            n = int(linhas[k])
            seg = linhas[k + 1:k + 3]
            letra = lambda s: s.upper() if re.fullmatch(r"[A-Ea-e]|X|Anulad[oa]", s, re.I) else None
            l1 = letra(seg[0]) if seg else None
            l2 = letra(seg[1]) if len(seg) > 1 else None
            if l1 and n <= 5 and l2 and n not in lingua:
                lingua[n] = {"ingles": l1[0], "espanhol": l2[0]}
                k += 3
                continue
            if l1 and n not in simples:
                simples[n] = l1[0]
                k += 2
                continue
        k += 1
    return simples, lingua


def linhas_da_pagina(pagina):
    out = []
    for b in pagina.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            txt = "".join(s["text"] for s in l["spans"]).strip()
            if txt:
                out.append((pymupdf.Rect(l["bbox"]), txt, l["spans"][0]))
    return out


def margens(linhas):
    """Topo e base úteis da página: abaixo do código de barras e acima do rodapé ("ENEM2024ENEM2024…")."""
    topo, base = TOPO, BASE + 20
    for r, txt, _ in linhas:
        repetido = re.fullmatch(r"(ENEM20\d\d)+\S*", txt.replace(" ", ""))
        if (repetido or re.match(r"\*\d+", txt)) and r.y1 < 90:
            topo = max(topo, r.y1 + 1)
        if (repetido or "| CADERNO" in txt or "º DIA |" in txt) and r.y0 > 700:
            base = min(base, r.y0 - 1)
    return topo, base


def faixas(pagina, linhas):
    meio = pagina.rect.width / 2
    topo, base = margens(linhas)
    # página de largura inteira: alguma linha de conteúdo atravessa o meio
    cheia = any(r.y0 > topo and r.y1 < base and r.x0 < meio - 30 and r.x1 > meio + 30 for r, _, _ in linhas)
    if cheia:
        return [pymupdf.Rect(18, topo, pagina.rect.width - 14, base)]
    return [pymupdf.Rect(18, topo, meio - 1, base), pymupdf.Rect(meio - 1, topo, pagina.rect.width - 14, base)]


def conteudo(pagina, r, linhas):
    """Retângulos com algo desenhado dentro da faixa (texto, imagem, gráfico vetorial)."""
    caixas = [x for x, _, _ in linhas]
    caixas += [pymupdf.Rect(b["bbox"]) for b in pagina.get_text("dict")["blocks"] if b["type"] == 1]
    caixas += [d["rect"] for d in pagina.get_drawings() if d["rect"].height < 400]
    return [c for c in caixas if r.intersects(c) and c.y0 >= r.y0 - 1 and c.y1 <= r.y1 + 1]


def renderizar(doc, tiras, ini, fim, destino, mascaras=()):
    (t0, y0), (t1, y1) = ini, fim
    pedacos = []
    for ti in range(t0, t1 + 1):
        pn, r = tiras[ti]
        top = y0 if ti == t0 else r.y0
        bot = y1 if ti == t1 else r.y1
        if bot - top < 8:
            continue
        clip = pymupdf.Rect(r.x0, top, r.x1, bot)
        pix = doc[pn].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        if ti == t1:
            # apaga o título da questão seguinte quando o recorte precisou passar por ele
            from PIL import ImageDraw
            dr = ImageDraw.Draw(img)
            for m in mascaras:
                dr.rectangle([(m.x0 - clip.x0) * ZOOM, (m.y0 - clip.y0) * ZOOM, (m.x1 - clip.x0) * ZOOM, (m.y1 - clip.y0) * ZOOM], fill="white")
            if mascaras:
                # na faixa do título, sobra só o que é texto escuro (some o traço colorido)
                y_tit = int((min(m.y0 for m in mascaras) - clip.y0) * ZOOM)
                if 0 <= y_tit < img.height:
                    faixa = img.crop((0, y_tit, img.width, img.height))
                    cinza = faixa.convert("L").point(lambda v: 255 if v > 110 else 0)
                    img.paste(Image.composite(faixa, Image.new("RGB", faixa.size, "white"), ImageChops.invert(cinza)), (0, y_tit))
        caixa = ImageChops.difference(img, Image.new("RGB", img.size, "white")).getbbox()
        if caixa:
            pedacos.append(img.crop((max(0, caixa[0] - 6), max(0, caixa[1] - 6), min(img.width, caixa[2] + 6), min(img.height, caixa[3] + 6))))
    if not pedacos:
        return 0
    w = max(p.width for p in pedacos)
    h = sum(p.height for p in pedacos) + 10 * (len(pedacos) - 1)
    final = Image.new("RGB", (w, h), "white")
    yy = 0
    for p in pedacos:
        final.paste(p, (0, yy))
        yy += p.height + 10
    final.save(destino, "WEBP", quality=72, method=6)
    return len(pedacos)


def recortar(doc, pasta, ano):
    dia1 = "1º DIA" in doc[0].get_text()
    tiras, eventos = [], []  # eventos: (tira, y, tipo, valor)
    for pn in range(len(doc)):
        pag = doc[pn]
        linhas = linhas_da_pagina(pag)
        for r in faixas(pag, linhas):
            ti = len(tiras)
            tiras.append((pn, r))
            dentro = sorted([x for x in linhas if r.contains(x[0].tl)], key=lambda x: (x[0].y0, x[0].x0))
            paradas = []  # onde a área de uma questão precisa parar
            for bx, txt, s in dentro:
                m = re.fullmatch(r"Quest[ãa]o\s+(\d{1,3})", txt, re.I)
                t = re.search(r"Texto para as Quest[õo]es de (\d+) a (\d+)", txt, re.I)
                if m and "Bold" in s["font"]:
                    eventos.append((ti, bx.y0, "q", int(m.group(1))))
                    paradas.append(bx.y0)
                elif t:
                    eventos.append((ti, bx.y0, "t", (int(t.group(1)), int(t.group(2)))))
                    paradas.append(bx.y0)
                elif re.match(r"Quest[õo]es de \d+ a \d+", txt, re.I):
                    paradas.append(bx.y0)
            caixas = conteudo(pag, r, linhas)
            for bx, txt, s in dentro:
                if txt[:1] == "E" and "Bundesbahn" in s["font"] and s["text"].strip() == "E":
                    # a alternativa E vai até a próxima parada (ou o fim da coluna);
                    # o fim real é o último conteúdo desenhado antes disso (texto ou figura)
                    limite = min([p for p in paradas if p > bx.y0] + [r.y1])
                    # (figuras da alternativa podem começar um pouco acima da letra)
                    no_rodape = limite >= r.y1
                    teto = r.y1 if no_rodape else limite - 0.5
                    fim = max([c.y1 for c in caixas if c.y1 > bx.y0 and c.y1 <= teto] + [bx.y1])
                    # respiro para o "pé" de letras (ç, g, p); perto do próximo título, nunca
                    # corta conteúdo da questão (ex.: denominador de fração colado no título)
                    corte = r.y1 if no_rodape else max(limite - 2.5, fim + 1)
                    mascaras = []
                    if not no_rodape and fim + 6 > limite - 2.5:
                        # conteúdo colado no título seguinte (ex.: denominador de fração):
                        # passa um pouco do título e apaga o título e o traço dele
                        corte = limite + 10
                        mascaras = [pymupdf.Rect(x.x0 - 2, x.y0 - 3, x.x1 + 2, x.y1 + 2) for x, _, _ in dentro if abs(x.y0 - limite) < 1]
                        mascaras += [pymupdf.Rect(c.x0 - 1, c.y0 - 2, c.x1 + 1, c.y1 + 2) for c in caixas if c.height < 5 and limite - 3 <= c.y0 <= limite + 12]
                    # ordena pela posição da letra E; o ponto de corte vai junto no valor
                    eventos.append((ti, bx.y0, "e", (min(fim + 6, corte) if not mascaras else corte, mascaras)))
    eventos.sort(key=lambda e: (e[0], e[1], 0 if e[2] == "e" else 1))
    vistos = collections.Counter()
    questoes, textos, aberta, texto_aberto = [], [], None, None
    for ti, y, tipo, val in eventos:
        if tipo in ("q", "t") and texto_aberto:
            texto_aberto["fim"] = (ti, y - 3)
            textos.append(texto_aberto)
            texto_aberto = None
        if tipo == "t":
            if aberta:
                aberta["fim"] = (ti, y - 3); questoes.append(aberta); aberta = None
            texto_aberto = {"de": val[0], "ate": val[1], "ini": (ti, y - 3)}
        elif tipo == "q":
            if aberta:  # não achou o fim: fecha antes da próxima
                aberta["fim"] = (ti, y - 3)
                questoes.append(aberta)
            vistos[val] += 1
            lingua = ("ingles" if vistos[val] == 1 else "espanhol") if (dia1 and val <= 5) else None
            aberta = {"i": val, "lingua": lingua, "ini": (ti, y - 3)}
        elif tipo == "e" and aberta:
            aberta["fim"] = (ti, val[0])
            aberta["mascaras"] = val[1]
            questoes.append(aberta)
            aberta = None
    os.makedirs(pasta, exist_ok=True)
    base = {}
    for t in textos:
        nome = f"texto-{t['de']:03d}-{t['ate']:03d}.webp"
        if renderizar(doc, tiras, t["ini"], t["fim"], os.path.join(pasta, nome)):
            for i in range(t["de"], t["ate"] + 1):
                base[i] = f"provas/{ano}/{nome}"
    saida = []
    for q in questoes:
        nome = f"q{q['i']:03d}" + (f"-{q['lingua']}" if q["lingua"] else "") + ".webp"
        n = renderizar(doc, tiras, q["ini"], q["fim"], os.path.join(pasta, nome), q.get("mascaras", []))
        if n:
            saida.append({**q, "img": f"provas/{ano}/{nome}", "texto": base.get(q["i"]), "pedacos": n})
    return saida


def params_tri(itens_csv, gab_simples, gab_lingua):
    rows = list(csv.DictReader(io.StringIO(open(itens_csv, "rb").read().decode("latin-1")), delimiter=";"))
    num = lambda x: float(x.replace(",", ".")) if x not in (None, "") else None
    out = {}
    for area in ("lc", "ch", "cn", "mt"):
        posicoes = [p for p in gab_simples if area_de(p) == area]
        alvo = "".join(gab_simples[p] for p in sorted(posicoes))
        cad = collections.defaultdict(dict)
        for r in rows:
            if r["SG_AREA"] == area.upper() and "AZUL" in r["TX_COR"].upper():
                cad[r["CO_PROVA"]][(int(r["CO_POSICAO"]), (r.get("TP_LINGUA") or "").strip())] = r
        melhor = None
        for cp, itens in cad.items():
            seq = "".join(itens[k]["TX_GABARITO"] for k in sorted(itens) if k[1] == "")
            m = difflib.SequenceMatcher(None, alvo, seq, autojunk=False).ratio()
            if not melhor or m > melhor[0]:
                melhor = (m, cp, itens)
        m, cp, itens = melhor
        print(f"  {area}: caderno {cp} bate {m:.0%} com o gabarito oficial")
        d = {}
        for (pos, tl), r in itens.items():
            a, b, c = num(r["NU_PARAM_A"]), num(r["NU_PARAM_B"]), num(r["NU_PARAM_C"])
            if (r.get("IN_ITEM_ABAN") or "0").strip() == "1" or None in (a, b, c):
                continue
            chave = str(pos) + ({"0": "-ingles", "1": "-espanhol"}.get(tl, "") if tl else "")
            d[chave] = [round(a, 4), round(b, 4), round(c, 4)]
        out[area] = d
    return out


def main():
    pdfs, itens_dir = sys.argv[1], sys.argv[2]
    manifesto, tri = {}, {}
    for ano in ANOS:
        print(ano)
        qs = []
        gs, gl = {}, {}
        for dia in ("D1_CD1", "D2_CD7"):
            doc = pymupdf.open(os.path.join(pdfs, f"{ano}_{dia}.pdf"))
            qs += recortar(doc, os.path.join(RAIZ, "provas", str(ano)), ano)
            a, b = gabarito_pdf(os.path.join(pdfs, f"GB_{ano}_{dia}.pdf"))
            gs.update(a); gl.update(b)
        man = {}
        for q in qs:
            g = gl.get(q["i"], {}).get(q["lingua"]) if q["lingua"] else gs.get(q["i"])
            chave = str(q["i"]) + (f"-{q['lingua']}" if q["lingua"] else "")
            man[chave] = {"img": q["img"], "g": g if g in list("ABCDE") else None}
            if q.get("texto"):
                man[chave]["txt"] = q["texto"]
        faltam = [i for i in range(1, 181) if str(i) not in man and f"{i}-ingles" not in man]
        print(f"  {len(man)} questões recortadas; faltando: {faltam or 'nenhuma'}; com várias partes: {sum(1 for q in qs if q['pedacos'] > 1)}")
        manifesto[ano] = man
        tri[ano] = params_tri(os.path.join(itens_dir, f"itens_{ano}.csv"), gs, gl)
    with open(os.path.join(RAIZ, "provas", "recentes.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// Provas de 2024 e 2025 recortadas dos cadernos Azul do INEP (gerado por ferramentas/montar_provas_recentes.py).\n")
        f.write("window.PROVAS_RECENTES = " + json.dumps(manifesto, separators=(",", ":")) + ";\n")
        f.write("window.TRI_RECENTES = " + json.dumps(tri, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
