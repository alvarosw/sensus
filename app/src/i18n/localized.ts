// Tabelas de textos por idioma. O pt é a fonte do tipo (cada strings.ts define `pt` e exporta o tipo); os outros
// idiomas são objetos com as mesmas chaves e assinaturas, checados pelo TypeScript na chamada de `localized`.
// Ver docs/design/idiomas-biblias-fontes.md §1 (App).
import { fallbackChain, type AppLang } from '@sensus/core';
import { currentLang } from './lang-store';

/** Uma tabela por idioma. `pt` é obrigatório (fonte do tipo); os demais, opcionais até serem traduzidos. */
export type LocaleTables<T extends object> = { pt: T } & Partial<Record<AppLang, T>>;

/**
 * Valor de uma chave no idioma pedido, com fallback por chave: idioma, depois inglês, depois português.
 * Função pura (sem store): é o que o Proxy de `localized` e `t()` chamam.
 */
export function resolveKey<T extends object>(tables: LocaleTables<T>, lang: AppLang, key: PropertyKey): unknown {
  for (const l of fallbackChain(lang)) {
    const table = tables[l];
    if (table && Object.hasOwn(table, key)) return (table as Record<PropertyKey, unknown>)[key];
  }
  return undefined;
}

/**
 * Objeto de textos que resolve cada propriedade no idioma atual na hora do acesso. Assim `STUDY.sheet` continua igual
 * nos componentes, e a troca de idioma vale depois de a raiz remontar (key={lang}).
 */
export function localized<T extends object>(tables: LocaleTables<T>): T {
  return new Proxy({} as T, {
    get: (_target, key) => resolveKey(tables, currentLang(), key),
    has: (_target, key) => fallbackChain(currentLang()).some((l) => {
      const table = tables[l];
      return table !== undefined && Object.hasOwn(table, key);
    }),
    ownKeys: () => Reflect.ownKeys(tables.pt),
    getOwnPropertyDescriptor: (_target, key) =>
      Object.hasOwn(tables.pt, key)
        ? { configurable: true, enumerable: true, writable: false, value: resolveKey(tables, currentLang(), key) }
        : undefined,
  });
}
