# Revisão por amostragem — árabe (ar)

Tradição Van Dyck (`arbvd`), sem tashkil. O árabe ainda não tem títulos nem gramática de descrições: esta revisão
cobre só os nomes (`corrections/ar/nomes.tsv`; `nomes-manuais.tsv` está vazio).

- **Semente:** `random.Random(2026)` (`sample` de 80 `revisado` e depois 30 `auto`/`alta` de `nomes.tsv`, tirada
  do arquivo antes das correções).
- **Conferência:** o nome procurado como palavra inteira (aceitando proclítico و ف ب ل ك) nos versículos das
  entidades do nome-base, texto da `arbvd` normalizado como o perfil `ar`.

## Checagem automática

Dos 2009 `revisado`, 108 não apareciam nos versículos da própria entidade. 94 foram corrigidos:

- 87 trocados pela grafia do texto: ابن حور (não بن حور), بيت عناة, بيت الجلجال, آبل الكروم, عين نون, كليوباس,
  مليطة, أندرونكوس, هيجاي, القيروان, الأبلية, gentílicos no singular coletivo do texto (العرقي, الحماتي,
  الجرمي) etc.; e formas em que a Van Dyck traduz o nome (مرتفعات دور, تل القلف, أعالي الأرض, ماء ذهب, السعاة
  para os peleteus, النعش para a Ursa).
- 7 marcados `sem` (o nome não está no texto e não há forma segura): Amminadib, Beth-merhak, Kiyyun, Sikkuth, Kue,
  Pyrrhus, Adino.
- 14 ficaram como estavam, com nome correto mas que a Van Dyck traduz ou omite nesses versículos: أرام النهرين,
  أرام صوبة, النقب (o texto diz الجنوب), بيت ملو (القلعة), حورش (الغاب), العوفل (الأكمة), اليشيمون, جمزو,
  حاصور حدتة, تحتيم حدشي, محلب, الحكموني.

## Erros antes da correção

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Nomes `revisado` | 80 | 10 | 12,5% |
| Nomes `alta` | 30 | 1 (Nimrah → ونمرة, com o و colado) | 3% |

Os 10 da amostra `revisado` são todos grafia diferente da do texto (بيت جلجال/بيت الجلجال, آبل مايم, الحماتيين,
المكتيش, إيلون/أيلون…); 9 já tinham sido pegos pela checagem automática.

## Padrões sistemáticos

- **Proclítico colado** (`auto` e alguns `revisado`): o candidato ficou com و/ل/ب/ك do texto. Varredura no
  arquivo inteiro: 44 com و (ونمرة, ويفتاح, ورامة, وسمعان, وشاول, ويوشافاط…) e 24 com ل/ب/ك (لملكوم, ليهوياريب,
  لميامين, لكنداكة, للأوريم, كنيل → النيل…). Mantidos os nomes em que a letra é do próprio nome (وشتي, وفسي,
  ونيا, واهب, ودان; بنيامين, لبنان, كفتور…).
- **Candidato errado junto com o proclítico:** James → ويوحنا (corrigido يعقوب), Jaddua → ويوياداع (يدوع), Korah →
  بخورا (قورح), Eker → كر (عاقر), Tibhath → باطح (طبحة), Tobadonijah → وأدونيا (طوب أدونيا), Lucifer → كيف (`sem`).

## Riscos que ficam

- As linhas `auto`/`media` (2364) não foram revistas uma a uma; a varredura pegou proclíticos e alguns candidatos
  absurdos, mas homógrafos com palavra comum (Amam → أمام, Bunni → بني, Ur → أور) passam.
- Os 14 nomes que a Van Dyck traduz ficaram com a forma tradicional fora do texto.
- `nomes-revisao.tsv` (notas) não foi conferido.
