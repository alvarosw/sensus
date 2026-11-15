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

## Segunda rodada: títulos, descrições e glossário de nomes

Semente `random.Random(2027)` para as três amostras abaixo. Os nomes já revisados acima não foram reconferidos,
exceto os que aparecem nos títulos.

| Tipo | Amostra | Erros | Taxa |
|---|---|---|---|
| Títulos `revisado` | 45 | 4 | 9% |
| Descrições por regra (TIPNR e openbible-geo) | 30 | 11 | 37% |
| Glossário `nome` das descrições | 30 | 2 | 7% |

- **Títulos:** Noah estava como نوحا (acusativo) em 6 títulos (corrigido para نوح; em 35 a frase passou a
  أمر الله لنوح); «Reign of Johoahaz (Shallum)» dizia só ملك شلوم, igual ao rei de Israel (agora ملك يهوآحاز
  (شلوم)); 327 شاول يعلن يسوع → شاول يكرز بيسوع (At 9:20); 328 sem Dorcas → بطرس يشفي إينياس ويقيم طابيثا; 134
  Cuchã completado (كوشان رشعتايم); 144 → اضطهاد بني عمون والفلسطينيين. Os 16 `rascunho` vazios foram traduzidos
  com a grafia da Van Dyck (أبيام، يكنيا، حجي، كورزين، بيت صيدا، الجدريين، الخصي الحبشي…) e marcados `revisado`.
  الله، الروح القدس، المعمدان e قيصر ficam: são os termos da Van Dyck, só não são nomes do `nomes.tsv`.
- **Descrições:** dois defeitos da gramática, ambos sistemáticos: o و vinha solto (`عمرام و يوكابد`; agora
  `conector_e` = « و», colado ao nome seguinte) e «father of» saía أب em construto (agora أبو, como أخو). Os dois
  cobriam 10 das 11 descrições com erro. A outra: Abel de 1Sm 6:18 saía هابيل (a Van Dyck traduz: الحجر الكبير;
  linha marcada `sem`).
- **Glossário `nome`** (758 linhas vindas de `auto`/`media` do `nomes.tsv`): na amostra, Raham → يرقعام (é راقم)
  e Pi-hahiroth → الحيروث (é فم الحيروث). Varredura das 129 linhas de cobertura baixa ou com outra grafia
  concorrente: 24 corrigidas no glossário e no `nomes.tsv` (Noah نوح, Haggai حجي, Josiah يوشيا, Hazeroth
  حضيروت, Gaal جعل, Gehazi جيحزي, Tyre صور, Galilee الجليل, Halah حلح, Zeeb ذئب, Syene أسوان, Nohah نوحة, Janoah
  يانوح, Elishua أليشوع, Kanah قانة, Lod لود, Nahalal نهلال, Nahalol نهلول; Shiloh → شيلوه só no glossário) e
  4 retiradas (Shuah e Shua → تعزى, Millo → جعله, East → اشتم; ficaram `sem`). Com isso 15 descrições deixam de
  ser geradas e caem na tradução do app.

### Riscos que ficam

- No openbible-geo, a identificação antiga entre aspas sai em latim quando é nome («Elam»); o nome moderno
  também (Kaloi Limenes, Shush). É o comportamento do código para todas as escritas não latinas.
- `عدد 1 من المواقع…` fica gramaticalmente pesado para n = 1.
- As ~630 linhas restantes do glossário `nome` não foram vistas uma a uma.
