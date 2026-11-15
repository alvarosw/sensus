// Nomes de entidades em português (tabela entity_name, ver repo/names.ts). O domínio decide qual nome a tela mostra:
// feature nenhuma compara língua ou fonte à mão. Nome no idioma do app é texto da fonte: não passa pela tradução (ver Repo.nameLang).

/**
 * Língua padrão da tabela entity_name (Repo sem nameLang). O app passa a língua dele (Repo.nameLang): o banco traz uma
 * linha por (entidade, língua) e, sem linha na língua pedida, vale o nome da fonte (inglês).
 */
export const ENTITY_NAME_LANG = 'pt';

/** Campos de nome de uma entidade (ver Entity.name e Entity.namePt). */
export interface NameFields {
  /** Nome na fonte (em inglês). Sempre presente. */
  name: string;
  /** Nome em português da tabela entity_name; null/ausente quando o banco não tem ou a entidade não tem linha. */
  namePt?: string | null;
}

/** Nome a mostrar. `pt` = veio da tabela de nomes na língua pedida (texto de fonte, nunca traduzido). */
export interface ShownName {
  text: string;
  pt: boolean;
}

/**
 * Nome a mostrar para uma entidade: o nome na língua do app (namePt) quando existe e `preferPt` está ligado; senão o
 * original da fonte. `preferPt` é false quando o usuário pede "Ver original" (linha do tempo). Nome vazio conta como
 * ausente.
 */
export function shownEntityName(e: NameFields, preferPt: boolean): ShownName {
  const pt = e.namePt?.trim();
  if (preferPt && pt) return { text: pt, pt: true };
  return { text: e.name, pt: false };
}

/**
 * Título de evento a mostrar. O título é o nome da entidade do evento (Entity.name na tabela), então vale a mesma
 * regra de shownEntityName: o título na língua do app quando existe e `preferPt` está ligado, senão o da fonte (inglês).
 */
export function shownEventTitle(e: { title: string; namePt?: string | null }, preferPt: boolean): ShownName {
  return shownEntityName({ name: e.title, namePt: e.namePt }, preferPt);
}

/** Língua padrão da tabela entity_text (ver ENTITY_NAME_LANG): uma linha por (entidade, língua), e o app pede a dele. */
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
 * Descrição a mostrar: a da língua do app quando existe e `preferPt` está ligado; senão a da fonte (inglês). Null quando
 * não há nenhuma das duas. Descrição só de espaços conta como ausente. Com a da língua do app ligada e a inglesa
 * ausente, ela segue valendo (não há o que "ver original").
 */
export function shownDescription(e: DescriptionFields, preferPt: boolean): ShownDescription | null {
  const pt = e.descriptionPt?.trim();
  if (preferPt && pt) return { text: e.descriptionPt!, pt: true };
  if (e.description && e.description.trim()) return { text: e.description, pt: false };
  if (pt) return { text: e.descriptionPt!, pt: true };
  return null;
}
