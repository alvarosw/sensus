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

## Segunda rodada (títulos, descrições por regra e nomes conhecidos)

- **Semente:** `random.Random(2027)`; 45 dos 450 títulos de `titulos-eventos.tsv` e 30 das 4715 descrições por regra
  (comparadas com o inglês da fonte e com o pt). Não há `corrections/ja/descricoes.tsv` (prosa).
- **Títulos:** 0 erros de sentido em 45; 1 de estilo (イエスのガリラヤ第二巡回), padrão corrigido nas 3 linhas
  (イエスの第一次／第二次／第三次ガリラヤ巡回, como 第一次伝道旅行).
- **Descrições:** 0 erros de sentido em 30. Padrão sistemático: "referred to as X, or Y" saía como
  「XまたはYとも呼ばれる」("também chamado"), embora X seja o próprio nome; modelo `citacao` passou a
  「{lista}と呼ばれる」 (afeta todas as descrições com mais de uma forma). Nomes ingleses de lugar moderno com palavra
  comum (Awaj River) são omitidos por desenho (`geo_omitir_ingles`); nomes de uma palavra (Bethlehem, Harran) ficam em
  latim — risco de estilo, não de sentido.
- **Nomes conhecidos:** God estava ゴグ (linha `revisado` do candidato de Ez 38:3, que vencia o manual 神) → 神.
  Skull→イエス, Straight→サウロ, Zealot→イスカリオテ, Pacatiana→アーメン, East→ゼバ, Salt→ニブシャン, Amaw→バラム:
  conferidos, todos já `sem` no `nomes.tsv` (o candidato aparece na coluna, mas não vai ao banco); East tem o manual
  東の地. Nada a mudar.

## Checagem de nomes trocados, todas as línguas

Script no scratchpad (`troca.py`): agrupa `sensus-nomes-<xx>/entity_name.jsonl` pelo nome na língua (sem o sufixo
numérico), soma os `entity_ref` das entidades (theographic, stepbible-tipnr, openbible-geo) por nome inglês base e
lista cada nome inglês base que divide o nome com outro nome inglês base mais citado. Homônimos (mesmo nome inglês
base) não contam. A similaridade dos nomes ingleses (difflib, sem -ite/-ites/-s) separa variantes de grafia (≥ 0,7,
não revisadas uma a uma) dos suspeitos (< 0,7), que foram conferidos nos versículos da Bíblia de referência. Os dois
lados de cada par foram olhados: o erro pode estar no mais citado (Cyrus = Kore em de, Zophah = سعاح em ur).

| Língua | Pares | Suspeitos (< 0,7) | Corrigidos | Correções |
|---|---|---|---|---|
| es | 297 | 65 | 1 | Prison Gate Puerta de Efraín → Puerta de la Cárcel |
| fr | 263 | 59 | 0 | |
| de | 323 | 75 | 1 | Cyrus Kore → Kores |
| ru | 336 | 86 | 0 | (Есевон, Сигор, Кир, Артаксеркс são do Sinodal) |
| zh | 285 | 88 | 10 | Ahiram 亚希兰, Chephar-(ha)ammoni 基法·阿摩尼 (×2), Ishvah/Isuah 亦施瓦 (×2), Lysanias 吕撒聂, Ozni 阿斯尼, Meshillemith 米实利密, Beth-haram 伯亚兰, Ariel 甲薛 → `sem` |
| ja | 247 | 30 | 1 | God ゴグ → 神 (antes da checagem; o resto é homônimo do 口語訳/jpnm: ヤコブ, レギオン, オン) |
| hi | 283 | 65 | 3 | Zeredah सारतान/सरेदावासी → सरेदा (×2), Iyim manual अबारीम → `sem` |
| bn | 214 | 60 | 1 | Kore কোরহ → কোরি |
| ur | 292 | 69 | 7 | Abihu ناداب → ابیہو, Cilicia سیریا → کلکیہ, Zophah → صوفح, Obed-edom → عوبید ادوم, Baal-hanan → بعل حنان, Tel-abib → تل ابیب, Zabdiel → زبدی ایل |
| ar | 104 | 17 | 0 | |
| id | 303 | 68 | 5 | Greece Makedonia → Yunani, Laadan Libni → Ladan, Rapha Saf → Rafa, Sepharad Sardis → Sefarad, Ariel Kabsel → Ariel |
| vi | 343 | 78 | 1 | Pileha Bi-la → Phi-la |

Total: 30 linhas corrigidas, pela forma do texto de referência (ou `sem` quando o texto não traz o nome). Depois da
correção o script lista 3263 pares (eram 3290). Risco: a faixa ≥ 0,7 (variantes de grafia, ~2700 pares) não foi
conferida linha a linha, e é nela que caem trocas entre nomes parecidos como Huppim/Muppim e God/Gog.
