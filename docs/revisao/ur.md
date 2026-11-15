# Revisão por amostragem — urdu (ur)

Tradição Urdu Revised/Geo, sem `ؔ`. As grafias dos nomes vêm da Bíblia de referência `urdoucv` (Geo): داوید،
شلومون، اصحاق، یوسیف، گبعون. Única exceção mantida: موسیٰ (o texto traz موشہ; o plano fixa موسیٰ).

- **Semente:** `random.Random(2026)` (nomes: `sample` de 80 `revisado` e depois 30 `auto`/`alta` de `nomes.tsv`;
  títulos: `sample` de 45; descrições: 22 TIPNR + 8 geo de `entity_text.jsonl`).
- **Amostra:** 110 nomes (80 + 30, ampliada a pedido: os `revisado` do urdu foram feitos com pouca conferência no
  texto), 45 títulos (10%), 30 descrições por regra. Não há prosa (`corrections/ur/descricoes.tsv` não existe).
- Conferência: o nome procurado como palavra inteira nos versículos das entidades do nome-base (texto da `urdoucv`,
  sem tashkil).

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 80 | 20 | 25% |
| Nomes `alta` | 30 | 1 (Ebed-melech → só ملک) | 3% |
| Títulos | 45 | 3 (nomes: فالج, بابل, جتسمنی) | 7% |
| Descrições por regra | 30 | 1 (modelo "کے قریب رہنے والا" para lugar) | 3% |

O geo deixa nomes modernos e a identificação em inglês por desenho; não contado como erro.

## Padrões sistemáticos (nomes `revisado`)

Os 20 erros da amostra não eram casos soltos: o revisor anterior escreveu grafias "de memória", em parte do Urdu
Revised clássico, em parte inventadas, e não a forma do texto. Na varredura de todos os 2307 `revisado`, 812 não
apareciam nos versículos da própria entidade. Padrões:

- `-ئیل` colado onde o texto separa ` ایل`: عزیئیل → عزی ایل, اوریئیل → اوری ایل, یحزیئیل → یحزی ایل.
- ج onde o texto tem گ: جدی ایل → گدی ایل, جرسوم → گیرشوم, جوج → گوگ, جت → گاتھ.
- ص/ض, ف/پ: صوعر → ضعر, فشحور → پشحور, عوص → عوض.
- final `-ای` onde o texto tem `-ائی`: شبتای → شبتائی, حوشای → حوشائی, ابیشی → ابیشائی.
- nomes conhecidos fora do texto: شاول → شاؤل, یوسف → یوسیف, بابل → بابیل, اسماعیل → اشمعیل, لاوی → لیوی,
  یسی → یشائی, فالج (que em urdu quer dizer "paralisia") → پلگ.

## Correções

- **Nomes (`nomes.tsv`):** cerca de 630 linhas `revisado` trocadas pela forma achada nos versículos (por
  parecença ≥ 0,75 com o mesmo número de palavras, por variantes das trocas acima achadas como palavra inteira, e
  à mão), com uma lista de exclusões em que a proposta era outra palavra. Restam 182 `revisado` fora do texto
  (variantes de nome, o texto usa outra forma, ou nada parecido no versículo).
- **Manuais (`nomes-manuais.tsv`):** 30 correções do mesmo tipo, conferidas no versículo citado (مریم مگدلینی,
  گبعون کی وادی, کوہ پاران, گلعاد کا پہاڑ, یوسیف کا قبیلہ, لیوی کا قبیلہ…).
- **Títulos:** os nomes trocados acompanham nos títulos (شاؤل, سروگ, مہلل ایل, پلگ, بابیل, اشمعیل, لیوی,
  گتسمنی, گلگتا, گملی ایل, یوتخس, زکائی, ابی ملیخ, فلسطینیوں/فلسطین).
- **Glossário das descrições:** nomes alinhados (گدیرہ, پطی ایل, ابی ایل, نوحاہ, یوسیف, لیوی, فلسطینی).
- **Gramática (sistemático):** `comp_perto` "{nome} کے قریب رہنے والا" ("que mora perto de", usado em 234
  lugares) → "{nome} کے قریب کا"; `comp_em` "{nome} میں رہنے والا" (32 lugares, 19 reis) → "{nome} کا".
- **Geo:** `geo_omitir_ingles = sim` e `geo_melhor_sem_nome`, como no es.

## Riscos que ficam

- 182 nomes `revisado` sem forma achada no texto e cerca de 300 manuais cujo versículo citado não traz a forma
  (muitos são descrições, como "لوط کی بڑی بیٹی", ou referência com numeração diferente). Não foram revistos um
  a um.
- Mesmo nome inglês com grafias diferentes no texto (Jehoiada یہویداع/یہویدع, Sheba سبا/سبع/سیبا, Ezer) ficou como
  estava.
- "X سے منسوب" para "of the X" ("مصر سے منسوب فرعون") é compreensível, mas soa forçado; não mudou.
- O revisor anterior pode ter usado a mesma memória na prosa (T4), que não existe ainda no urdu.
