# Revisão por amostragem — russo (ru)

Tradição Sinodal, nomes no nominativo; a Bíblia ru do app é a `russyn`, de onde vêm as grafias. Grafia da `russyn`
não foi contada como erro (ex.: "до Эглаима" em Ez 47:10, sem "Ен-"). A identificação do geo em inglês fica por
desenho (será tratada em código) e não conta como erro; a cobertura de ~59% por regra também é decisão (complementos
com nome próprio exigiriam caso e caem na tradução automática).

- **Semente:** `random.Random(20261114)` (nomes: todas as linhas estão `revisado`, então a amostra foi 50 de
  confiança média/baixa e depois 30 de confiança alta; títulos: 45; descrições por regra: 30 das 3851 linhas de
  `entity_text`).
- **Amostra:** 80 nomes, 45 títulos (10%), 30 descrições por regra. Não há `descricoes.tsv` (prosa) em ru.

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` (média/baixa) | 50 | 2 | 4% |
| Nomes `revisado` (alta) | 30 | 0 | 0% |
| Títulos | 45 | 0 | 0% |
| Descrições por regra | 30 | 0 | 0% |

Nomes conferidos no versículo da `russyn`. Nas descrições, conferido o caso: relações (сын, брат, отец…) sempre no
genitivo (varredura no arquivo inteiro: nenhum nome de relação sem desinência de genitivo; "из колена" sempre com a
tribo no genitivo — Иуды, Левия, Вениамина…).

## Correções

- **Nomes descritivos traduzidos à letra em vez da forma sinodal:** `Travelers Valley` / `Valley of the Passengers`
  "Долина путешественников" → "Долина прохожих" (Иез 39:11); `Beautiful Gate` "Красные ворота" → "Красные двери"
  (Деян 3:2, 3:10). Ao procurar o padrão: `Hamon-gog Valley` (3 linhas) "Долина Гамон-Гог" → "Долина полчища
  Гогова" (Иез 39:11, 15).
- **Fora da amostra:** `Engedi` "Ен-Геди" (só Нав 15:62) → "Ен-Гадди", a forma mais comum na `russyn`.

## Riscos que ficam

- Nomes compostos descritivos (portas, vales, montes) foram revisados com o glossário e podem ter outros casos de
  tradução literal onde a Sinodal traduz de outro jeito; o resto das portas e vales conferido de olho parece certo.
- Termos genéricos com maiúscula inicial ("Гора Хорив") por regra do perfil; em texto corrido o russo usaria
  minúscula.
- No geo, "(древняя)"/"(современная)" depois da identificação é seco (melhor "древнее/современное название").
