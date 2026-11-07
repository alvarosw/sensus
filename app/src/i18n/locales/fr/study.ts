// Français de app/src/features/study/strings.ts. A revisar por falante nativo.
import { testamentLabel } from '@sensus/core';
import type { Testament } from '@sensus/core';

export const frStudy = {
  sheet: 'Étude du passage sélectionné',
  expand: 'Agrandir l’étude',
  collapse: 'Réduire l’étude',
  close: 'Effacer la sélection',
  verse: 'verset',
  verses: 'versets',
  crosses: (a: string, b: string) => `chevauche ${a} → ${b}`,
  pericope: (r: string) => `Péricope ${r}`,
  pericopeWhole: 'Péricope entière',
  pericopeExpanded: (r: string) => `Sélection étendue à la péricope ${r}`,
  railLabel: 'Lentilles d’étude',

  factComentaristas: 'commentateurs',
  factVariante: (slash: string) => `variante ${slash}`,
  factVariantes: (slash: string) => `variantes ${slash}`,
  factXrefs: 'réf. croisées',
  factHapax: (t: Testament) => `hapax · ${testamentLabel(t, 'fr')}`,
  /** Contagem de versículos no testamento da palavra; 1 vira "versículo", o resto "vv.". */
  factVv: (n: number, t: Testament) => `${n} ${n === 1 ? 'verset' : 'vv.'} · ${testamentLabel(t, 'fr')}`,
  factNoData: 'Pas de données',

  deepen: 'Détailler',
  seeAll: 'Tout voir',
  seeLess: 'Moins',
  deepened: 'Détaillé',
  deepenPoint: 'Détailler ce point',
  whereFrom: 'D’où vient cela ?',
  askAbout: 'Poser une question à ce sujet',
  openPreview: 'Ouvrir l’aperçu',

  summaryOfUnit: 'Résumé de la péricope',
  summaryContains: 'qui contient la sélection',
  noSummary: 'Aucun résumé pour cette section.',
  thinking: 'réflexion…',
  noProvider:
    'Aucune méthode d’IA disponible. Connectez-vous avec ChatGPT ou ajoutez une clé d’API dans les réglages pour voir le résumé par lentille.',
  configure: 'Configurer l’IA',
  summaryError: (m: string) => `Impossible de générer le résumé : ${m}`,
  retry: 'Réessayer',
  panelError: 'Impossible de charger les sources de ce passage.',
  loadingSources: 'Chargement des sources…',

  lensCount: {
    visao: 'IA · cite les sources ci-dessous',
    aplicacao: 'pas de source propre',
  },

  // Visão geral (o fio)
  threadTitle: 'Le fil de ce passage',
  stepsCount: (n: number) => `${n} ${n === 1 ? 'étape' : 'étapes'}`,
  andMore: (n: number) => `et ${n} de plus`,

  // Texto
  translations: 'Traductions et original',
  cmpBlivre: 'Bíblia Livre',
  cmpKjv: 'KJV',
  cmpOriginal: 'Original',
  originalHint: (nt: string, at: string) =>
    `Original : ${nt} pour le NT, ${at} pour l’AT. Touchez un mot pour voir sa morphologie.`,
  variantsTitle: 'Variantes entre éditions',
  variantsEmpty: (list: string) => `Aucune différence entre ${list} dans ces versets.`,
  variantType: 'Variante',
  omits: 'omet',
  analyzeWord: 'Analyser le mot',
  ask: 'Demander',

  // Literário
  neighborhood: 'Environnement',
  include: 'inclure',
  divisions: 'Divisions du texte',
  division: 'Division',
  paragraphStart: 'Début de paragraphe',
  heading: 'Titre',
  bookIntro: 'Introduction au livre',
  readEntry: 'Lire l’entrée',
  entry: 'Entrée',
  topicIndex: 'Index thématique',

  // Histórico
  place: 'Lieu',
  places: 'Lieux',
  peopleGroups: 'Personnes et groupes',
  dictionaries: 'Dictionnaires et encyclopédies',
  seeEntity: 'Voir l’entité',
  otherPassages: 'Autres passages',
  otherPassagesSoon: 'La liste des passages qui mentionnent cette entité arrive bientôt.',
  entityType: { person: 'Personne', place: 'Lieu', event: 'Événement', group: 'Groupe', other: 'Entité' } as Record<string, string>,
  historicalEmpty: 'Aucun lieu, personne ni entrée lié à ces versets.',
  timeline: 'Chronologie',
  timelineHere: 'dans ce passage',
  timelineOpen: 'Ouvrir dans la chronologie',

  // Língua
  word: 'Mot',
  hapax: 'hapax',
  commentMentions: (n: number) => `cité dans ${n} ${n === 1 ? 'commentaire' : 'commentaires'}`,
  lexiconConcordance: 'Lexique et concordance',
  languageEmpty: 'Aucun mot du texte original pour ces versets.',
  inText: 'dans le texte',

  // Intertexto
  xrefType: 'Réf.',
  from: 'de',
  pinSideBySide: 'Épingler côte à côte',
  pinned: (r: string) => `${r} épinglé au-dessus du texte`,
  topics: 'Index thématiques',
  xrefsEmpty: 'Aucune référence croisée pour ces versets.',
  relevance: 'Pertinence',

  // Interpretação
  whoComments: 'Qui commente chaque verset',
  allTraditions: 'Toutes',
  commentary: 'Commentaire',
  readFull: 'Lire en entier',
  moreByAuthor: 'Plus de cet auteur',
  onlyAuthor: (a: string) => `Seulement ${a}`,
  clearAuthor: 'Tous les auteurs',
  commentsEmpty: 'Aucun commentaire pour ces versets.',
  patristic: 'Patristique',
  matrixLabel: 'Qui commente chaque verset',

  // Aplicação
  applicationHint: 'L’application ne vient que de l’IA et est toujours marquée comme inférence.',
};
