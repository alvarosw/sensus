import { describe, expect, it } from 'vitest';
import { APP_LANGS, BOOK_NAMES, BOOK_TABLE, bookAbbrOf, formatReference, makeVid, type AppLang } from '../src/index';

// Abreviações de pt-BR (já em uso no núcleo): congeladas aqui para pegar qualquer mudança sem querer.
const PT_ABBR = [
  'Gn', 'Êx', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm',
  '1Rs', '2Rs', '1Cr', '2Cr', 'Ed', 'Ne', 'Et', 'Jó', 'Sl', 'Pv',
  'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn', 'Os', 'Jl', 'Am',
  'Ob', 'Jn', 'Mq', 'Na', 'Hc', 'Sf', 'Ag', 'Zc', 'Ml', 'Mt',
  'Mc', 'Lc', 'Jo', 'At', 'Rm', '1Co', '2Co', 'Gl', 'Ef', 'Fp',
  'Cl', '1Ts', '2Ts', '1Tm', '2Tm', 'Tt', 'Fm', 'Hb', 'Tg', '1Pe',
  '2Pe', '1Jo', '2Jo', '3Jo', 'Jd', 'Ap',
];

// Códigos USFM em maiúsculas (GEN, EXO, JHN...): não podem aparecer como abreviação fora do inglês.
const USFM_UPPER = /^\d?\p{Lu}{2,}$/u;

// Amostras (Gn 1:1, Jo 3:16, Ap 22:21): nome completo na referência e abreviação, em cada idioma.
const SAMPLES: Partial<Record<AppLang, { refs: [string, string, string]; abbrs: [string, string, string] }>> = {
  es: { refs: ['Génesis 1:1', 'Juan 3:16', 'Apocalipsis 22:21'], abbrs: ['Gn', 'Jn', 'Ap'] },
  fr: { refs: ['Genèse 1:1', 'Jean 3:16', 'Apocalypse 22:21'], abbrs: ['Gn', 'Jn', 'Ap'] },
  de: { refs: ['1. Mose 1:1', 'Johannes 3:16', 'Offenbarung 22:21'], abbrs: ['1Mo', 'Joh', 'Offb'] },
  ru: { refs: ['Бытие 1:1', 'Иоанна 3:16', 'Откровение 22:21'], abbrs: ['Быт', 'Ин', 'Откр'] },
  zh: { refs: ['创世记 1:1', '约翰福音 3:16', '启示录 22:21'], abbrs: ['创', '约', '启'] },
  ja: { refs: ['創世記 1:1', 'ヨハネによる福音書 3:16', 'ヨハネの黙示録 22:21'], abbrs: ['創', 'ヨハ', '黙'] },
  hi: { refs: ['उत्पत्ति 1:1', 'यूहन्ना 3:16', 'प्रकाशितवाक्य 22:21'], abbrs: ['उत्प.', 'यूह.', 'प्रका.'] },
  bn: { refs: ['আদিপুস্তক 1:1', 'যোহন 3:16', 'প্রকাশিত বাক্য 22:21'], abbrs: ['আদি', 'যোহ', 'প্রকা'] },
  ur: { refs: ['پیدائش 1:1', 'یوحنا 3:16', 'مکاشفہ 22:21'], abbrs: ['پید', 'یوح', 'مکا'] },
  ar: { refs: ['التكوين 1:1', 'يوحنا 3:16', 'الرؤيا 22:21'], abbrs: ['تك', 'يو', 'رؤ'] },
  id: { refs: ['Kejadian 1:1', 'Yohanes 3:16', 'Wahyu 22:21'], abbrs: ['Kej', 'Yoh', 'Why'] },
  vi: { refs: ['Sáng Thế Ký 1:1', 'Giăng 3:16', 'Khải Huyền 22:21'], abbrs: ['Sáng', 'Gi', 'Khải Huyền'] },
};

const CODES = APP_LANGS.map((l) => l.code);
const OTHER_LANGS = CODES.filter((c) => c !== 'pt' && c !== 'en');

describe('tabela de nomes dos livros', () => {
  it('há tabela para os 14 idiomas, nenhum a mais', () => {
    expect(Object.keys(BOOK_NAMES).sort()).toEqual([...CODES].sort());
  });

  it('pt continua igual ao que o núcleo usa (nomes e abreviações)', () => {
    expect(BOOK_NAMES.pt?.map((b) => b.abbr)).toEqual(PT_ABBR);
    expect(BOOK_NAMES.pt?.map((b) => b.short)).toEqual(BOOK_NAMES.pt?.map((b) => b.name));
  });

  for (const code of CODES) {
    describe(`idioma ${code}`, () => {
      const rows = BOOK_NAMES[code] ?? [];

      it('tem 66 livros, na ordem canônica', () => {
        expect(rows).toHaveLength(66);
      });

      it('nenhum campo vazio', () => {
        for (const row of rows) {
          expect(row.name.trim(), `name de ${row.abbr}`).not.toBe('');
          expect(row.short.trim(), `short de ${row.name}`).not.toBe('');
          expect(row.abbr.trim(), `abbr de ${row.name}`).not.toBe('');
        }
      });

      it('abreviações únicas dentro do idioma', () => {
        const abbrs = rows.map((r) => r.abbr);
        expect(new Set(abbrs).size, `repetidas: ${abbrs.filter((a, i) => abbrs.indexOf(a) !== i).join(', ')}`).toBe(66);
      });

      if (code !== 'en') {
        it('nenhuma abreviação é código USFM em maiúsculas', () => {
          for (const row of rows) expect(row.abbr, row.name).not.toMatch(USFM_UPPER);
        });
      }
    });
  }

});

describe('referências nos idiomas (Gn 1:1, Jo 3:16, Ap 22:21)', () => {
  for (const code of OTHER_LANGS) {
    const sample = SAMPLES[code];
    if (!sample) continue;
    it(`${code}: nome completo e abreviação`, () => {
      const refs = [
        formatReference({ start: makeVid(1, 1, 1), end: makeVid(1, 1, 1) }, BOOK_TABLE, code),
        formatReference({ start: makeVid(43, 3, 16), end: makeVid(43, 3, 16) }, BOOK_TABLE, code),
        formatReference({ start: makeVid(66, 22, 21), end: makeVid(66, 22, 21) }, BOOK_TABLE, code),
      ];
      expect(refs).toEqual(sample.refs);
      const abbrs = [1, 43, 66].map((n) => BOOK_NAMES[code]?.[n - 1]?.abbr);
      expect(abbrs).toEqual(sample.abbrs);
    });
  }

  it('todo idioma com tabela tem amostra', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(OTHER_LANGS.slice().sort());
  });
});

describe('abreviação e introdução em todos os idiomas', () => {
  it('bookAbbrOf lê a tabela do idioma pedido (não só pt e en)', () => {
    expect(bookAbbrOf(43, 'pt')).toBe(BOOK_NAMES.pt![42]!.abbr);
    for (const lang of ['es', 'de', 'ru', 'zh', 'ar'] as const) {
      expect(bookAbbrOf(43, lang)).toBe(BOOK_NAMES[lang]![42]!.abbr);
    }
  });

  it('introdução do capítulo no idioma: NT grego (Fp 2) e AT hebraico (1Rs 15)', () => {
    expect(formatReference({ start: 50002000, end: 50002000 }, BOOK_TABLE, 'es')).toContain('(introducción)');
    expect(formatReference({ start: 11015000, end: 11015000 }, BOOK_TABLE, 'de')).toContain('(Einleitung)');
  });
});
