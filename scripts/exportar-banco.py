#!/usr/bin/env python3
"""
Exporta o banco de dados da Calculadora ICMS-ST MS para uso fora da calculadora
(Excel, CSV e JSON), em icms-st-ms/exportar/.
Uso: python3 scripts/exportar-banco.py
"""
import csv, json, shutil
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

BASE = Path(__file__).resolve().parent.parent / "icms-st-ms"
DADOS, SAIDA = BASE / "dados", BASE / "exportar"
SAIDA.mkdir(exist_ok=True)

sub = json.loads((DADOS / "subanexo1.json").read_text(encoding="utf-8"))
par = json.loads((DADOS / "parametros.json").read_text(encoding="utf-8"))
pmpf = json.loads((DADOS / "pmpf.json").read_text(encoding="utf-8"))

COLS = ["Tabela", "Segmento", "Abrangência", "Item", "CEST", "NCM/SH", "MVA oper. interna %",
        "MVA ajustada 4 %", "MVA ajustada 7 %", "MVA ajustada 12 %", "Observação MVA", "Descrição", "Dispositivo legal"]
linhas = []
for r in sub["r"]:
    seg, item, cest, ncms, mva, mva_txt, desc, disp = r
    tab, nome, abr = sub["s"][seg]
    m = mva or [None] * 4
    linhas.append([tab, nome, abr, item, cest, " ; ".join(ncms), *m, mva_txt or "", desc, sub["d"][disp]])

# CSV (separador ; e vírgula decimal, como o Excel em português abre direto)
with open(SAIDA / "subanexo1.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(COLS)
    for l in linhas:
        w.writerow([("%.2f" % v).replace(".", ",") if isinstance(v, float) else v for v in l])

# Excel
HEAD = PatternFill("solid", fgColor="1F3864")
wb = Workbook()

def aba(ws, titulo, cols, rows, larguras):
    ws.append([titulo]); ws["A1"].font = Font(bold=True, size=13, color="1F3864")
    ws.append([]); ws.append(cols)
    for c in ws[3]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in rows: ws.append(r)
    for i, wd in enumerate(larguras, 1): ws.column_dimensions[get_column_letter(i)].width = wd
    ws.freeze_panes = "A4"
    ws.auto_filter.ref = f"A3:{get_column_letter(len(cols))}{ws.max_row}"

ws = wb.active; ws.title = "Subanexo I"
aba(ws, f"{sub['fonte']} · {len(linhas)} itens · atualizado em {sub['atualizado_em']}",
    COLS, linhas, [12, 30, 26, 7, 11, 28, 10, 10, 10, 10, 22, 70, 32])
for row in ws.iter_rows(min_row=4, min_col=7, max_col=10):
    for c in row: c.number_format = "0.00"
for row in ws.iter_rows(min_row=4, min_col=12, max_col=12):
    for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")

aba(wb.create_sheet("PMPF"), f"{pmpf['ato']} · vigência a partir de {pmpf['vigencia_inicio']} · UF {pmpf['uf']}",
    ["Produto", "PMPF (R$)", "Unidade"], [[i["produto"], i["valor"], i["unidade"]] for i in pmpf["itens"]], [40, 12, 10])
aba(wb.create_sheet("Parâmetros"), f"Parâmetros · atualizado em {par['atualizado_em']}", ["Parâmetro", "Valor", "Fonte"],
    [["Alíquota interna padrão (%)", par["aliquota_interna"], par["fontes"]["aliquota_interna"]],
     ["FECOMP (%)", par["fecomp"], par["fontes"]["fecomp"]],
     ["Alíquotas interestaduais (%)", ", ".join(map(str, par["aliquotas_interestaduais"])), "Resolução do Senado nº 22/1989 e nº 13/2012"]],
    [30, 14, 70])
aba(wb.create_sheet("Tabelas"), "Tabelas do Subanexo I", ["Tabela", "Segmento", "Abrangência", "Itens"],
    [[t, n, a, sum(1 for r in sub["r"] if r[0] == i)] for i, (t, n, a) in enumerate(sub["s"])], [14, 50, 50, 8])
wb.save(SAIDA / "Banco_ICMS-ST_MS.xlsx")

for n in ("subanexo1.json", "parametros.json", "pmpf.json"):
    shutil.copy(DADOS / n, SAIDA / n)
print(f"Exportado: {len(linhas)} itens do Subanexo I, {len(pmpf['itens'])} PMPF -> {SAIDA}")
