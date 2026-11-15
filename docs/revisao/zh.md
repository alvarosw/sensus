# Revisão por amostragem — chinês simplificado (zh)

Tradição 和合本 (CUV); texto de referência `cmncbs` (CCB, nomes marcados `\pn`). Quando o 和合本 diverge da CCB
de propósito, a linha fica com a forma do 和合本 e a nota em `nomes-revisao.tsv` registra `CCB: …` (não é erro).

- **Semente:** `random.Random(20261114)` (nomes: `sample` de 50 `revisado` e depois 30 `auto`/`alta` de
  `nomes.tsv`; títulos: `sample` de 45; descrições: `sample` de 30 de `entity_text.jsonl`).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra (20 TIPNR + 10 geo). Não há prosa
  (`corrections/zh/descricoes.tsv` não existe).

## Checagem automática dos nomes

Cada linha `revisado`/`manual` de `nomes.tsv` e `nomes-manuais.tsv` foi procurada (sem `·`/`‧`/espaços) nos
versículos CCB das entidades do nome-base.

- Antes: 2224 linhas com texto; **307 não apareciam** (148 com nota `CCB:` de divergência declarada).
- Conferidas uma a uma: **235 corrigidas** (231 para a forma do texto ou do 和合本, 4 para `sem`).
- Depois: 92 não aparecem, todas divergências conscientes do 和合本 com nota `CCB:` (司提反, 大比大, 丢大, 马利亚,
  马大, 哈拿, 腓力斯, 干大基…) ou manuais sem nome marcado no versículo.

Padrão: o revisor anterior escreveu "de memória" grafias que não são nem CCB nem 和合本 (利户 por 利宏, 布登 por
布田, 提摩 por 提门, 赫耳墨斯 por 希耳米, 以拿达 por 以拿, 埃克巴坦那 por 亚马他, 示纳撒 por 示拿萨, 洗比雅 por
西比亚…), e marcou como "CCB diverge" casos em que a CCB traz justamente a forma do 和合本 (以连, 伊是班, 欣但,
亚希摩, 哈古巴…). Onde o 和合本 traduz o nome (委办, 王的儿子) ou o texto crítico o omite (Trogyllium), ficou `sem`.

## Erros antes da correção (amostra)

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 50 | 4 (亚大米提, 以勒歌士, 伊比散, 隐临门) | 8% |
| Nomes `alta` | 30 | 0 | 0% |
| Títulos | 45 | 0 | 0% |
| Descrições por regra | 30 | 3 (modelo `又称` para "referred to as") | 10% |

Os 4 erros de nome da amostra já tinham sido pegos pela checagem automática. O geo deixa a identificação em inglês
por desenho (`geo_omitir_ingles sim` e `geo_melhor_sem_nome` já estavam na gramática); não contado como erro.

## Correções

- **Nomes:** 235 linhas (acima); notas `rev. T5:` em `nomes-revisao.tsv`/`nomes-manuais.tsv`, e `CCB: …` nas
  divergências do 和合本 que estavam sem nota.
- **Gramática:** `citacao` `又称{lista}` → `称为{lista}` ("又称" pressupõe um nome já dito; 330 descrições).

## Riscos

- As formas do 和合本 mantidas contra a CCB vêm de memória do revisor; não há texto 和合本 no pipeline para conferir.
- Nomes `auto` seguem a CCB mesmo onde o 和合本 diverge (ex.: 雅珥 em vez de 睚珥); títulos acompanham os nomes.
- Descrições TIPNR usam "人" para "A man" (neutro, aceitável) e a nota de geo omite "outro nome de X".
