# Revisão por amostragem — vietnamita (vi)

Tradição: grafia de 1925 (Bản Truyền thống, sílabas com hífen), por decisão do projeto. A Bíblia de alinhamento é a
VCB (`vieovcb`); divergência da VCB com a forma de 1925 não conta como erro. Formas conferidas no versículo da
entidade (texto da VCB alinhado à KJV) e na forma de 1925.

- **Semente:** `random.Random(5925)` (nomes: `sample` de 50 `revisado` de confiança média/baixa e depois 30
  `revisado` de confiança alta, na ordem do TSV — o vi não tem linhas `auto`; títulos: 45 dos 450 `revisado`;
  descrições por regra: 20 TIPNR + 10 geo, de `sorted` dos cite_id de `entity_text`).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra. O vi não tem prosa (`descricoes.tsv`).

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` (média/baixa) | 50 | 1 | 2% |
| Nomes `revisado` (alta) | 30 | 0 | 0% |
| Títulos (nome errado para o trecho: forma de Lucas no Gênesis; "Phao-lô" em Atos 9) | 45 | 2 | 4% |
| Descrições TIPNR por regra | 20 | 0 | 0% |
| Descrições geo por regra (rótulos de voto enganosos) | 10 | 6 | 60% |

Não contam como erro: o texto inglês da identificação no geo (por desenho, como em todas as línguas) e variantes
sem nome na língua ("Sép-na hoặc Shebnah"), herdadas do pt.

## Correções

- **Nome:** Ibnijah "Gíp-nê-gia" → "Gíp-ni-gia" (1Cr 9:8; 1925 distingue Gíp-nê-gia, Ibneiah, de Gíp-ni-gia,
  Ibnijah; a revisão anterior tinha juntado as duas).
- **Títulos (sistemático, 7 linhas):** eventos de Salah no Gênesis (47, 48, 82) com a forma de Lucas "Sa-la" →
  "Sê-lách" (Gn 11:12, 1925). Eventos de Atos antes de 13:9 (323, 326, 327, 339) usavam "Phao-lô" para Saulo →
  "Sau-lơ". Nota "rev. amostragem".
- **Rótulos do geo (`glossario-geo.tsv`, sistemático):** os votos eram traduzidos como adjetivos soltos e às vezes
  com sentido trocado ("không tin cậy" = "não confiável" para *confidence_no*; "khả năng" solto para *possible*;
  "thẩm quyền" literal para *authority*). Passam ao formato do pt, rótulo e valor: "tin cậy: có / nhiều khả năng /
  có thể / ít khả năng / không", "căn cứ: học giả / truyền thống / thường dùng …".
- **Rodapé da linha do tempo** (`app/src/i18n/locales/vi/timeline.ts`): tirada a menção a IA.

## Riscos que ficam

- **Geo por regra:** nome moderno e identificação em inglês ("another name for Gibeon", "within 10 km of
  Beersheba 1"), por desenho de `geo_descricao.py`.
- **Citação com nomes repetidos** ("A-rôn (אַהֲרֹן) hoặc A-rôn (Ἀαρών)", Môi-se quatro vezes): vem da regra,
  igual ao pt.
- **Abreviações de livros** misturam forma curta e nome inteiro ("1 Sử", "2 Sa", mas "Giô-suê", "Nê-hê-mi").
  Coerente com a gramática, mas não com uma tabela de 1925.
- Nomes `revisado` da folha dependem de a revisão anterior ter tido a forma de 1925 certa: a amostra achou 1 caso
  de duas pessoas fundidas (Ibneiah/Ibnijah); pares parecidos no mesmo versículo são o ponto fraco.
- 485 TIPNR e 2789 Theographic sem tradução por regra nem prosa: o app mostra o inglês/tradução automática.
