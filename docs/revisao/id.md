# Revisão por amostragem — indonésio (id)

Tradição: LAI Terjemahan Baru (TB). Bíblia de referência para derivar nomes: `indtsi` (TSI), que diverge da TB de
propósito (paráfrase simples, outras grafias) e não tem Sl, Jó, Jr, Ez, Dn e 1–2 Cr.

Semente: `20261114` (`random.Random`, na ordem: revisado, alta, fora do indtsi, títulos).

## Amostra e erros (antes da correção)

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` (nomes.tsv) | 50 | 3 (Kue→Kewe, Heleb copiado como Heled, Tamah→Temah) | 6% |
| Nomes `auto`/`alta` (nomes.tsv) | 30 | 2 (Ramoth-gilead truncado em "Ramot", Cleophas→Klopas) | 7% |
| Manuais "LAI TB, fora do indtsi" (amostra extra) | 30 | 2 (Vedan→Wedan, Zillethai→Ziletai) | 7% |
| Títulos de eventos | 45 | 8 (participantes acrescentados; "Saul" virou "Paulus") | 18% |
| Descrições por regra (sem geo) | 22 | 0 de língua | 0% |
| Descrições geo | 8 | não contadas (identificação em inglês por desenho) | — |
| Prosa (`descricoes.tsv`) | — | não existe para id | — |

Erros conhecidos de antes: `God` → "Nod" (corrigido para "Allah"); `Satan` → "Setan" (TB: "Iblis").

## Checagem automática dos nomes

Script no scratchpad: para cada linha `revisado` de `nomes.tsv` e `nomes-manuais.tsv`, procura o nome nos versículos
das entidades no texto do `indtsi`. Antes: 907 aparecem, 1146 sem texto no indtsi (livros que faltam ou manuais sem
versículo), **479 não aparecem**. A maioria é divergência intencional TB × TSI (ex.: "Laut Teberau", "Balai
Pengadilan", "Kadesh-Barnea"), registrada nas notas "forma conferida na LAI TB". Conferidos à mão contra a TB, 34
estavam errados e foram corrigidos (ex.: Jonas profeta → Yunus, Deuel → Dehuel, Shedeur → Syedeur, Dishan → Disyan,
Stephanas → Stefanus, Chilion → Kilyon, Legion → Legion, Pelethites → Pleti, Hiddekel → Tigris, Mizraim → Mesir,
Ecbatana → Ahmeta, Shebat → Syebat, Shephelah → Dataran Rendah, Jozadak → Yozadak, Rock of Escape → Batu
Keluputan, Lucifer → Bintang Timur). Depois: 455 não aparecem, todos aceitos como forma TB.

## Padrões sistemáticos corrigidos

- **Títulos com participantes**: o tradutor acrescentou listas de pessoas ("… bersama Simon Petrus dan Yakobus",
  "…: Damaris dan Dionisius"), "Yesus Kristus" onde o inglês diz "Jesus", "Herodes Agripa I"/"Antipas" e "Simon
  Petrus" onde o inglês diz só "Herod"/"Peter", e "Paulus" onde a fonte diz "Saul". 54 títulos reescritos fiéis ao
  inglês (como no pt e no es).
- **Compostos truncados em `auto`/`alta`**: o alinhamento ficava só com uma parte (Ramot, Kades, Yearim, Rogel,
  Hadad…). 23 linhas corrigidas para a forma TB com hífen (Ramot-Gilead, Kadesh-Barnea, Kiryat-Yearim, En-Rogel,
  Ben-Hadad, Isyboset…).
- **Papel genérico no nome**: "Yohanes, rasul", "Filipus, rasul", "Filipus, penginjil" → "Rasul Yohanes", "Rasul
  Filipus", "Filipus, pemberita Injil" (Kis 21:8).
- Grafias TSI copiadas onde a TB difere: Haruz, Siaha, Arah, Hefzibah, Zurisyadai, Nimfa, Zefon, Adar, Raema.

## Riscos

- Não há texto da TB no repositório: as formas TB foram conferidas de memória. Casos duvidosos ficaram como estavam
  (Melatiah "Melatya", Mattithiah "Matitya"/"Matitia", Eliah "Eliya", Gibeath-elohim, Shomer).
- 1146 nomes manuais de livros fora do indtsi não têm verificação automática; amostra deles com 7% de erro.
- Compostos sem tradução nas descrições ("Perazim Mount", "Rephaim Valley", "Travelers_Valley") vêm do inglês, como
  no pt.
- Geo: quando a identificação moderna não tem nome traduzido, a frase sai sem o nome ("Identifikasi modern terbaik
  (sungai, …)").
