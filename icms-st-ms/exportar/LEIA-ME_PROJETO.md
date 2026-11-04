# Projeto · Calculadora ICMS-ST MS (CT Price)

Cole este texto numa nova conversa do Claude, junto com os arquivos desta pasta, para continuar o projeto.

## O que é

Calculadora de ICMS Substituição Tributária de Mato Grosso do Sul, feita para a CT Price Organização Contábil
(Campo Grande/MS). Tem três formas de cálculo: por XML de NF-e, consulta manual de um item e vários itens.
Ela gera planilhas Excel e segue o RICMS/MS (Decreto nº 9.203/1998), Anexo III e Subanexo I.

- Página publicada: https://claude.ai/artifact/L6459enn5T4un7fKc13gNk
- Código-fonte: repositório GitHub `MHaas22/Ferramentas`, branch `claude/brave-pascal-kygzb7`, pasta `icms-st-ms/`

## Arquivos do banco de dados (esta pasta)

| Arquivo | Conteúdo |
| --- | --- |
| `Banco_ICMS-ST_MS.xlsx` | Banco completo para leitura humana. Abas: Subanexo I, PMPF, Parâmetros, Tabelas |
| `subanexo1.csv` | Subanexo I em CSV (separador `;`, vírgula decimal, UTF-8 com BOM) |
| `subanexo1.json` | Subanexo I no formato que a calculadora lê |
| `pmpf.json` | PMPF vigente de MS (Ato COTEPE/PMPF) |
| `parametros.json` | Alíquota interna padrão (17%) e FECOMP (2%) |

### Formato de `subanexo1.json`

- `s`: lista de tabelas `[nome da tabela, segmento, abrangência]` (26 tabelas, II a XXIX)
- `d`: lista de dispositivos legais (texto)
- `r`: itens (941), cada um `[índice em s, item, CEST, [NCMs], [MVA interna, MVA 4%, MVA 7%, MVA 12%] ou null, texto quando não há MVA ou null, descrição, índice em d]`
- As MVAs das colunas 4%, 7% e 12% já vêm ajustadas (art. 9º-A). NCM de 2 dígitos indica o capítulo inteiro.

## Fórmulas usadas

- `BC-ST = (mercadoria + IPI + frete + seguro + outras − desconto) × (1 + MVA) × (1 − redução)`
- `ICMS-ST = BC-ST × alíquota interna − ICMS próprio`
- MVA ajustada: `[(1 + MVA original) × (1 − alíq. inter) ÷ (1 − alíq. intra)] − 1`
- Alíquota de origem no XML: remetente de MS = interna; senão `pICMS` do XML; sem destaque, 4% para origem
  estrangeira (orig 1, 2, 3, 8), 7% para remetente de SP, RJ, MG, PR, SC ou RS e 12% para as demais UFs.

## Situação dos dados (exportados em 04/11/2026)

- Subanexo I: 941 itens, texto-base salvo em 03/09/2026. Foram corrigidos 18 itens que tinham NCMs juntos ou escritos como "Capítulos…".
- Pendência: CEST 17.116.00 tem NCM `008.13` e `009.09`, provável erro de transcrição. Conferir no texto oficial.
- PMPF: Ato COTEPE/PMPF nº 29/2026, vigência a partir de 01/11/2026 (QAV 7,6119; AEHC 4,0564; GNV 4,4986).
  Gasolina, diesel e GLP são monofásicos ad rem e não entram no PMPF.

## Fontes oficiais

- PMPF: https://www.confaz.fazenda.gov.br/legislacao/atos-pmpf
- RICMS/MS (Decreto 9.203/1998) consolidado: https://www.legisweb.com.br/legislacao/?legislacao=135855
- SEFAZ-MS: https://www.sefaz.ms.gov.br

Cálculo de apoio: confira descrição, NCM, CEST, alíquota, benefícios e FECOMP antes de recolher.
