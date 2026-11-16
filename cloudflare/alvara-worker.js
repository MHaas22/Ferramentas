// CT Price — Busca de Alvará (Campo Grande/MS)
// Intermediário para o Cloudflare Workers: recebe a Inscrição Municipal da
// página alvara.html, consulta o Portal SIAT da prefeitura e devolve o PDF.
//
// Publicação: painel da Cloudflare > Workers & Pages > Create > "Hello World"
// > Deploy > Edit code > apague tudo, cole este arquivo > Deploy.

// Sites autorizados a usar este intermediário.
const ALLOWED_ORIGINS = ["https://mhaas22.github.io"];

const PORTAL = "https://siatportal.campogrande.ms.gov.br/dsf_cgr_gtm/por/emitircertidaoportalcon.do";
const START_QUERY = "evento=x&modoJanelaPlc=popup&TIPO=M&acronym=EMITIRALVARALOCALIZACAOEFUNCIONAMENTO";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";

class PortalError extends Error {
  constructor(message, nome = "") { super(message); this.nome = nome; }
}

function cleanIm(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  return d && d.length <= 11 && /[1-9]/.test(d) ? d.padStart(11, "0") : "";
}

function unescapeHtml(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
const plain = s => unescapeHtml(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const unique = list => [...new Set(list.filter(Boolean))];

function field(page, name) {
  const m = new RegExp(`name="${name}"[^>]*?\\bvalue="([^"]*)"`).exec(page);
  return m ? unescapeHtml(m[1]) : "";
}
function messages(page) {
  const found = [...page.matchAll(/class="mensagem[^"]*"[^>]*>([\s\S]*?)<\/(?:td|div|span|p)>/g)];
  return unique(found.map(m => plain(m[1]))).join("; ");
}
// Motivos listados pelo portal quando a certidão não pode ser emitida.
function motivos(page) {
  const m = /Motivo\(s\) relacionado\(s\)[\s\S]*?<\/td>([\s\S]*?)<\/table>/.exec(page);
  if (!m) return "";
  return unique([...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => plain(c[1]))).join(" ");
}
function isPdf(bytes) {
  const b = new Uint8Array(bytes.slice(0, 5));
  return b.length === 5 && String.fromCharCode(...b) === "%PDF-";
}

async function emitirAlvara(im) {
  const cookies = new Map(); // o portal guarda o estado da consulta na sessão

  async function call(url, data) {
    for (let attempt = 0; ; attempt++) {
      try {
        const resp = await fetch(url, {
          method: data ? "POST" : "GET",
          headers: {
            "User-Agent": USER_AGENT,
            ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
            ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          },
          body: data ? new URLSearchParams(data).toString() : undefined,
        });
        for (const c of resp.headers.getSetCookie()) {
          const pair = c.split(";")[0], eq = pair.indexOf("=");
          if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
        if (resp.status >= 500 && attempt < 2) throw new Error("retry");
        if (!resp.ok) throw new PortalError(`O portal da prefeitura respondeu com erro (HTTP ${resp.status}).`);
        return await resp.arrayBuffer();
      } catch (e) {
        if (e instanceof PortalError) throw e;
        if (attempt >= 2) throw new PortalError("Falha de conexão com o portal da prefeitura.");
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  const text = bytes => new TextDecoder("utf-8").decode(bytes);

  // 1) Abre a tela (cria a sessão)
  let page = text(await call(`${PORTAL}?${START_QUERY}`));
  const form = {
    lookupCorrentePlc: "", navSetaFocoPlc: "", modoJanelaPlc: "popup", modoPlc: "consultaPlc",
    indExcDetPlc: "", ordenacaoPlc: "", indListaIndexada: "", detCorrPlc: "", urlGeraArquivo: "",
    voltarPaginaInicial: "", emiteRelatorio: "", cadastroTipoCadastro: "M", cadastroAssociacaoId: "",
    cadastroCodigoPesquisa: im, cadastroDescricao: "",
    dataHoraLavraturaStr: field(page, "dataHoraLavraturaStr"),
  };

  // 2) Pesquisa o cadastro pela Inscrição Municipal
  page = text(await call(`${PORTAL}?evento=pesquisaCadastro`, form));
  const id = /name="cadastroAssociacaoId" value="(\d+)" id="idMOB"/.exec(page);
  if (!id) throw new PortalError(messages(page) || "Cadastro Mobiliário não encontrado.");
  const block = /id="idMOB">([\s\S]*?)<\/tr>/.exec(page);
  const nome = block ? field(block[1], "cadastroDescricao") : "";
  form.cadastroAssociacaoId = id[1];
  form.cadastroDescricao = nome;
  form.dataHoraLavraturaStr = field(page, "dataHoraLavraturaStr") || form.dataHoraLavraturaStr;

  // 3) Emite a certidão (o portal devolve o PDF direto)
  let body = await call(`${PORTAL}?evento=Emitir%20Certid%E3o`, form);
  if (isPdf(body)) return { nome, pdf: body };
  page = text(body);

  // Alguns casos devolvem a tela com o endereço do arquivo em vez do PDF
  const relatorio = field(page, "emiteRelatorio");
  if (relatorio) {
    body = await call(new URL(relatorio, PORTAL).toString());
    if (isPdf(body)) return { nome, pdf: body };
  }
  if (field(page, "urlGeraArquivo")) {
    body = await call(`${PORTAL}?evento=geraArquivoCertidao`, form);
    if (isPdf(body)) return { nome, pdf: body };
  }
  throw new PortalError(motivos(page) || messages(page) || "O portal não emitiu o alvará para esta inscrição.", nome);
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Expose-Headers": "X-Nome",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    };
    const json = (status, payload) => new Response(JSON.stringify(payload),
      { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json(405, { erro: "Método não permitido." });
    const url = new URL(request.url);
    if (url.pathname.endsWith("/api/status")) return json(200, { ok: true });
    if (!url.pathname.endsWith("/api/alvara")) return json(404, { erro: "Endereço não encontrado." });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(403, { erro: "Origem não autorizada." });

    const im = cleanIm(url.searchParams.get("im"));
    if (!im) return json(400, { erro: "Inscrição Municipal inválida." });
    try {
      const { nome, pdf } = await emitirAlvara(im);
      return new Response(pdf, { headers: { ...cors, "Content-Type": "application/pdf", "X-Nome": encodeURIComponent(nome) } });
    } catch (e) {
      if (e instanceof PortalError) return json(502, { erro: e.message, nome: e.nome });
      return json(500, { erro: "Erro inesperado no intermediário." });
    }
  },
};
