# Revisão por amostragem — japonês (ja)

Tradição 口語訳 (1955); Bíblia de referência dos nomes: `jpnm`. Onde o revisor anterior adotou a forma do 口語訳 e
ela difere do texto da `jpnm`, há nota "口語訳" em `nomes-revisao.tsv` (ex.: マリヤ, ミデヤン, アンテオケ, シケム);
isso é divergência de propósito, não erro. Japonês ainda não tem títulos nem gramática de descrições: só os nomes
foram revisados.

- **Semente:** `random.Random(2026)` — `sample` de 80 linhas `revisado` de `nomes.tsv`. Não há linhas `auto`/`alta`
  (todas as linhas com nome foram revisadas); no lugar das 30 `alta`, `shuffle` com a mesma semente das 113
  divergências "口語訳" e as 30 primeiras conferidas.
- **Checagem automática:** cada `revisado` de `nomes.tsv` e de `nomes-manuais.tsv` procurado nos versículos `jpnm`
  das entidades (3352 linhas com versículo).

## Checagem automática

222 não apareciam no texto: 113 divergências "口語訳" com nota, 106 manuais (a maioria descrições como ロトの長女,
シバの女王, 王の大路, ou formas do 口語訳 anotadas) e 3 `revisado` sem nota. Corrigidos 13:

- `revisado`: Kedesh-naphtali → ナフタリのケデシュ, Shimhi シムヒ → シムイ, Koz コズ → ハコツ (todos pela forma do
  texto).
- Manuais que contradiziam o próprio `nomes.tsv` (nota "口語訳" que não era 口語訳 nem `jpnm`): Caesarea Philippi
  (×2) → カイサリア・ピリポ, Portius Festus → ポルキオ・フェスト, Herod Antipas → ヘロデ・アンティパス,
  Adramyttium → アドラミティオン, Misrephoth-maim → ミスレフォト・マイム, Atroth-beth-joab → アトロテ・ベテ・ヨアブ,
  Beeroth Bene-jaakan → ベエロト・ベネ・ヤアカン, Valley of Mizpeh/Mizpeh_Valley ミヅパの谷 → ミツパの谷.

Depois: 210 não aparecem, todos com nota ou descritivos.

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 80 | 1 (Huppim = ムピム, nome vizinho na lista) | 1% |
| Divergências "口語訳" | 30 | 2 (Media メディヤ, 口語訳 é メデア; Beth-Ashtoreth ベテ・アシュタロテ contra アシタロテ de Ashtoreth) | 7% |

## Padrões procurados no arquivo inteiro

- Nome vizinho em lista (como Huppim): `nome_ja` igual para nomes ingleses pouco parecidos. Achado mais um:
  Jehudijah = ビテヤ (é Bithiah; a `jpnm` traz só ユダ人の妻) → `sem`.
- Nota "口語訳" inventada: Ecbatana エクバタナ (texto e 口語訳 trazem アクメタ) → アクメタ.

## Risco

- Ortografia mista por desenho: só parte dos nomes foi levada ao 口語訳 (マリヤ, ミデヤン), o resto segue a `jpnm`
  (ケハテ, オホリアブ, ツァルモナ, onde o 口語訳 tem コハテ, アホリアブ, ザルモナ).
- Notas "口語訳" não verificáveis aqui sem o texto do 口語訳; ficam como estão: Mysia ミシヤ, Lycia リキヤ (o 口語訳
  pode trazer ムシヤ, ルキヤ), Melzar メルザル, Mahalab マハラブ, Shephelah シェフェラ (o 口語訳 traduz "低地").
- Manuais descritivos (使徒ヨハネ, 皮なめしシモン) não têm forma no texto para conferir.
