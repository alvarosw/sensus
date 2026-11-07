// Formas de plural das línguas que não cabem em "um / outros" (ver docs/design/idiomas-biblias-fontes.md §1).
// Os textos chamam estas funções com o número e as formas; cada uma devolve a forma certa para o número.

/** Plural russo: 1 / 2-4 / 5+, com 11 a 14 na terceira forma (1 стих, 2 стиха, 5 стихов, 11 стихов, 21 стих). */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Plural árabe: 1 singular, 2 dual, 3 a 10 plural, 11 ou mais singular (forma que os textos usam). */
export function arPlural(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return few;
  return many;
}
