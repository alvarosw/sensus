// Espanhol de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const esStudy = {
  threadLens: {
    literario: 'Dónde estamos',
    lingua: 'La palabra que mueve el pasaje',
    texto: 'Los manuscritos divergen',
    intertexto: 'Ecos en otros textos',
    historico: 'Personas, lugares y contexto',
    interpretacao: 'Cómo la iglesia lo leyó',
    aplicacao: 'Y para nosotros',
  },
  sheet: 'Estudio del pasaje seleccionado',
  expand: 'Expandir estudio',
  collapse: 'Reducir estudio',
  close: 'Quitar selección',
  verseCount: (n: number) => `${n} ${n === 1 ? 'versículo' : 'versículos'}`,
  versesAbbr: (n: number) => `${n} vv`,
  crosses: (a: string, b: string) => `cruza ${a} → ${b}`,
  pericope: (r: string) => `Perícopa ${r}`,
  pericopeWhole: 'Perícopa completa',
  pericopeExpanded: (r: string) => `Selección ampliada a la perícopa ${r}`,
  railLabel: 'Lentes del estudio',

  factComentaristas: 'comentaristas',
  factVariantes: (n: number, slash: string) => `${n === 1 ? 'variante' : 'variantes'} ${slash}`,
  variantCount: (n: number) => `${n} ${n === 1 ? 'variante' : 'variantes'}`,
  factXrefs: 'refs. cruzadas',
  factHapax: (t: Testament) => `hapax en el ${testamentLabel(t, 'es')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${n === 1 ? 'versículo' : 'vv.'} en el ${testamentLabel(t, 'es')}`,
  factNoData: 'Sin datos',

  deepen: 'Detallar',
  seeAll: 'Ver todos',
  seeLess: 'Menos',
  deepened: 'Detallado',
  deepenPoint: 'Detallar este punto',
  whereFrom: '¿De dónde sale esto?',
  askAbout: 'Preguntar sobre esto',
  openPreview: 'Abrir vista previa',

  summaryOfUnit: 'Resumen de la perícopa',
  summaryContains: 'que contiene la selección',
  noSummary: 'Sin resumen para esta sección.',
  thinking: 'pensando…',
  noProvider:
    'No hay ningún método de IA disponible. Inicia sesión con ChatGPT o agrega una clave de API en la configuración para ver el resumen por lente.',
  configure: 'Configurar IA',
  summaryError: (m: string) => `No se pudo generar el resumen: ${m}`,
  retry: 'Intentar de nuevo',
  panelError: 'No se pudieron cargar las fuentes de este pasaje.',
  loadingSources: 'Cargando fuentes…',

  lensCount: {
    visao: 'IA · cita las fuentes de abajo',
    aplicacao: 'sin fuente propia',
  },

  // Visão geral (o fio)
  threadTitle: 'El hilo de este pasaje',
  stepsCount: (n: number) => `${n} ${n === 1 ? 'paso' : 'pasos'}`,
  andMore: (n: number) => `y ${n} más`,

  // Texto
  translations: 'Traducciones y original',
  cmpOriginal: 'Original',
  originalHint: (nt: string, at: string) =>
    `Original: ${nt} para el NT, ${at} para el AT. Toca una palabra para ver su morfología.`,
  variantsTitle: 'Variantes entre ediciones',
  variantsEmpty: (list: string) => `No hay diferencias entre ${list} en estos versículos.`,
  variantType: 'Variante',
  omits: 'omite',
  analyzeWord: 'Analizar palabra',
  ask: 'Preguntar',

  // Literário
  neighborhood: 'Entorno',
  include: 'incluir',
  divisions: 'Divisiones del texto',
  division: 'División',
  paragraphStart: 'Inicio de párrafo',
  heading: 'Título',
  bookIntro: 'Introducción al libro',
  readEntry: 'Leer entrada',
  entry: 'Entrada',
  topicIndex: 'Índice temático',

  // Histórico
  place: 'Lugar',
  placesHeading: (n: number) => n > 1 ? 'Lugares' : 'Lugar',
  placesAndEntries: (places: number, entries: number) => `${places} ${places === 1 ? 'lugar' : 'lugares'} · ${entries} ${entries === 1 ? 'entrada' : 'entradas'}`,
  peopleGroups: 'Personas y grupos',
  dictionaries: 'Diccionarios y enciclopedias',
  seeEntity: 'Ver entidad',
  otherPassages: 'Otros pasajes',
  otherPassagesSoon: 'La lista de pasajes que mencionan esta entidad llegará pronto.',
  entityType: { person: 'Persona', place: 'Lugar', event: 'Evento', group: 'Grupo', other: 'Entidad' } as Record<string, string>,
  historicalEmpty: 'No hay lugares, personas ni entradas vinculados a estos versículos.',
  timeline: 'Línea de tiempo',
  timelineHere: 'en este pasaje',
  timelineOpen: 'Abrir en la línea de tiempo',

  // Língua
  word: 'Palabra',
  hapax: 'hapax',
  commentMentions: (n: number) => `citada en ${n} ${n === 1 ? 'comentario' : 'comentarios'}`,
  lexiconConcordance: 'Léxico y concordancia',
  languageEmpty: 'No hay palabras del texto original en estos versículos.',
  inText: 'en el texto',

  // Intertexto
  xrefType: 'Ref.',
  from: 'de',
  pinSideBySide: 'Fijar lado a lado',
  pinned: (r: string) => `${r} fijado sobre el texto`,
  topics: 'Índices temáticos',
  xrefsEmpty: 'No hay referencias cruzadas para estos versículos.',
  relevance: 'Relevancia',

  // Interpretação
  whoComments: 'Quién comenta cada versículo',
  allTraditions: 'Todas',
  commentary: 'Comentario',
  readFull: 'Leer completo',
  moreByAuthor: 'Más de este autor',
  onlyAuthor: (a: string) => `Solo ${a}`,
  clearAuthor: 'Todos los autores',
  commentsEmpty: 'No hay comentarios para estos versículos.',
  patristic: 'Patrística',
  matrixLabel: 'Quién comenta cada versículo',

  // Aplicação
  applicationHint: 'La aplicación solo viene de la IA y siempre se marca como inferencia.',
  xrefsCount: (n: number) => `${n} ${n === 1 ? 'referencia' : 'referencias'}`,
  commentariesCount: (n: number) => `${n} ${n === 1 ? 'comentario' : 'comentarios'}`,
  chapterMark: (n: number) => `(capítulo ${n})`,
  literaryEmpty: 'Sin contexto literario en esta fuente.',
  sheetBackHalf: 'Volver a media altura',
  sheetToggleHeight: 'Cambiar altura del estudio',
};
