// Nomes de entidades em português (tabela entity_name, ver repo/names.ts). O domínio decide qual nome a tela mostra:
// feature nenhuma compara língua ou fonte à mão. Nome no idioma do app é texto da fonte: não passa pela tradução (ver Repo.nameLang).

/** Língua da tabela entity_name. Hoje só português; o banco traz uma linha por (entidade, língua). */
export const ENTITY_NAME_LANG = 'pt';

/** Campos de nome de uma entidade (ver Entity.name e Entity.namePt). */
export interface NameFields {
  /** Nome na fonte (em inglês). Sempre presente. */
  name: string;
  /** Nome em português da tabela entity_name; null/ausente quando o banco não tem ou a entidade não tem linha. */
  namePt?: string | null;
}

/** Nome a mostrar. `pt` = veio da tabela pt (texto de fonte em português, nunca traduzido). */
export interface ShownName {
  text: string;
  pt: boolean;
}

/**
 * Nome a mostrar para uma entidade: o pt quando existe e `preferPt` está ligado; senão o original da fonte.
 * `preferPt` é false quando o usuário pede "Ver original" (linha do tempo). Nome pt vazio conta como ausente.
 */
export function shownEntityName(e: NameFields, preferPt: boolean): ShownName {
  const pt = e.namePt?.trim();
  if (preferPt && pt) return { text: pt, pt: true };
  return { text: e.name, pt: false };
}

/**
 * Título de evento a mostrar. O título é o nome da entidade do evento (Entity.name na tabela), então vale a mesma
 * regra de shownEntityName: pt quando existe e `preferPt` está ligado, senão o título da fonte (inglês).
 */
export function shownEventTitle(e: { title: string; namePt?: string | null }, preferPt: boolean): ShownName {
  return shownEntityName({ name: e.title, namePt: e.namePt }, preferPt);
}

/** Língua da tabela entity_text (descrições em português). Hoje só português; uma linha por (entidade, língua). */
export const ENTITY_TEXT_LANG = 'pt';

/** Campos de descrição de uma entidade (ver Entity.description e Entity.descriptionPt). */
export interface DescriptionFields {
  /** Descrição na fonte (em inglês). */
  description: string | null;
  /** Descrição em português da tabela entity_text; null/ausente quando o banco não tem ou a entidade não tem linha. */
  descriptionPt?: string | null;
}

/** Descrição a mostrar. `pt` = veio da tabela entity_text (texto de fonte em português, nunca traduzido). */
export interface ShownDescription {
  text: string;
  pt: boolean;
}

/**
 * Descrição a mostrar: a pt quando existe e `preferPt` está ligado; senão a da fonte (inglês). Null quando não há
 * nenhuma das duas. Descrição pt só de espaços conta como ausente. Com a pt ligada e a inglesa ausente, a pt segue
 * valendo (não há o que "ver original").
 */
export function shownDescription(e: DescriptionFields, preferPt: boolean): ShownDescription | null {
  const pt = e.descriptionPt?.trim();
  if (preferPt && pt) return { text: e.descriptionPt!, pt: true };
  if (e.description && e.description.trim()) return { text: e.description, pt: false };
  if (pt) return { text: e.descriptionPt!, pt: true };
  return null;
}
