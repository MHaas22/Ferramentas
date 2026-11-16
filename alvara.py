#!/usr/bin/env python3
"""CT Price — Busca de Alvará de Localização e Funcionamento (Campo Grande/MS).

Como usar:
    python alvara.py

Abre a página alvara.html no navegador (http://localhost:8765/alvara.html).
Este programa faz a ponte com o portal SIAT da prefeitura, que não aceita
chamadas diretas de uma página estática. Usa apenas a biblioteca padrão do
Python 3.8+ — não é preciso instalar nada.
"""
import html
import http.cookiejar
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("ALVARA_PORT", "8765"))
ROOT = os.path.dirname(os.path.abspath(__file__))
PORTAL = "https://siatportal.campogrande.ms.gov.br/dsf_cgr_gtm/por/emitircertidaoportalcon.do"
START_QUERY = "evento=x&modoJanelaPlc=popup&TIPO=M&acronym=EMITIRALVARALOCALIZACAOEFUNCIONAMENTO"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
TIMEOUT = 90

# O portal é lento e guarda estado por sessão: uma consulta de cada vez.
PORTAL_LOCK = threading.Lock()


class PortalError(Exception):
    """Erro com mensagem pronta para mostrar ao usuário."""


def clean_im(value):
    """Inscrição Municipal como o portal espera: só dígitos, 11 posições."""
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits or len(digits) > 11 or not digits.strip("0"):
        return ""
    return digits.zfill(11)


def _field(page, name):
    m = re.search(r'name="%s"[^>]*?\bvalue="([^"]*)"' % re.escape(name), page)
    return html.unescape(m.group(1)) if m else ""


def _messages(page):
    found = re.findall(r'class="mensagem[^"]*"[^>]*>(.*?)</(?:td|div|span|p)>', page, re.S)
    texts = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip() for t in found]
    return "; ".join(dict.fromkeys(t for t in texts if t))


def _read(resp):
    body = resp.read()
    ctype = resp.headers.get("Content-Type", "")
    return body, ctype


def emitir_alvara(im):
    """Devolve (nome, pdf_bytes) ou levanta PortalError."""
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    opener.addheaders = [("User-Agent", USER_AGENT)]

    def call(url, data=None):
        body = urllib.parse.urlencode(data).encode("utf-8") if data is not None else None
        try:
            with opener.open(url, body, timeout=TIMEOUT) as resp:
                return _read(resp)
        except urllib.error.HTTPError as e:
            raise PortalError("O portal da prefeitura respondeu com erro (HTTP %s)." % e.code)
        except Exception:
            raise PortalError("Falha de conexão com o portal da prefeitura.")

    # 1) Abre a tela (cria a sessão)
    body, _ = call(PORTAL + "?" + START_QUERY)
    page = body.decode("utf-8", "replace")
    form = {
        "lookupCorrentePlc": "", "navSetaFocoPlc": "", "modoJanelaPlc": "popup",
        "modoPlc": "consultaPlc", "indExcDetPlc": "", "ordenacaoPlc": "",
        "indListaIndexada": "", "detCorrPlc": "", "urlGeraArquivo": "",
        "voltarPaginaInicial": "", "emiteRelatorio": "", "cadastroTipoCadastro": "M",
        "cadastroAssociacaoId": "", "cadastroCodigoPesquisa": im, "cadastroDescricao": "",
        "dataHoraLavraturaStr": _field(page, "dataHoraLavraturaStr"),
    }

    # 2) Pesquisa o cadastro pela Inscrição Municipal
    body, _ = call(PORTAL + "?evento=pesquisaCadastro", form)
    page = body.decode("utf-8", "replace")
    m = re.search(r'name="cadastroAssociacaoId" value="(\d+)" id="idMOB"', page)
    if not m:
        raise PortalError(_messages(page) or "Cadastro Mobiliário não encontrado.")
    nome = ""
    block = re.search(r'id="idMOB">(.*?)</tr>', page, re.S)
    if block:
        nome = _field(block.group(1), "cadastroDescricao")
    form.update({
        "cadastroAssociacaoId": m.group(1),
        "cadastroDescricao": nome,
        "dataHoraLavraturaStr": _field(page, "dataHoraLavraturaStr") or form["dataHoraLavraturaStr"],
    })

    # 3) Emite a certidão (o portal devolve o PDF direto)
    body, ctype = call(PORTAL + "?evento=Emitir%20Certid%E3o", form)
    if body[:5] == b"%PDF-":
        return nome, body
    page = body.decode("utf-8", "replace")

    # Alguns casos devolvem a tela com o endereço do arquivo em vez do PDF
    for name, evento in (("emiteRelatorio", None), ("urlGeraArquivo", "geraArquivoCertidao")):
        value = _field(page, name)
        if not value:
            continue
        if evento:
            body, _ = call(PORTAL + "?evento=" + evento, form)
        else:
            body, _ = call(urllib.parse.urljoin(PORTAL, value))
        if body[:5] == b"%PDF-":
            return nome, body

    raise PortalError((_messages(page) or "O portal não emitiu o alvará para esta inscrição.")
                      + (" (%s)" % nome if nome else ""))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/alvara.html")
            self.end_headers()
            return
        if url.path == "/api/status":
            return self._json(200, {"ok": True})
        if url.path != "/api/alvara":
            return super().do_GET()

        im = clean_im(urllib.parse.parse_qs(url.query).get("im", [""])[0])
        if not im:
            return self._json(400, {"erro": "Inscrição Municipal inválida."})
        try:
            with PORTAL_LOCK:
                nome, pdf = emitir_alvara(im)
        except PortalError as e:
            print("  %s  ERRO: %s" % (im, e))
            return self._json(502, {"erro": str(e)})
        print("  %s  OK  %s" % (im, nome))
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("X-Nome", urllib.parse.quote(nome))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(pdf)


def main():
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit("A porta %d já está em uso. Feche a outra janela do programa "
                 "ou defina ALVARA_PORT com outra porta." % PORT)
    address = "http://localhost:%d/alvara.html" % PORT
    print("CT Price — Busca de Alvará (Campo Grande/MS)")
    print("Abra no navegador: " + address)
    print("Para encerrar, feche esta janela ou pressione Ctrl+C.\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, webbrowser.open, [address]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")


if __name__ == "__main__":
    main()
