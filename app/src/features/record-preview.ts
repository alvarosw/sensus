import { formatReference, formatVerse, type CitableRecord } from '@sensus/core';

export interface RecordPreview {
  heading: string;
  body: string;
}

/** Título e texto resumido de qualquer registro citável (sem marcação). */
export function previewOf(record: CitableRecord): RecordPreview {
  switch (record.table) {
    case 'verse_text':
      return { heading: formatVerse(record.record.vid), body: record.record.text };
    case 'token':
      return { heading: record.record.surface, body: record.record.gloss_en ?? '' };
    case 'lexicon_entry':
      return { heading: record.record.lemma ?? record.record.key, body: record.record.definition };
    case 'commentary':
      return {
        heading: formatReference({ start: record.record.start_vid, end: record.record.end_vid }),
        body: record.record.text,
      };
    case 'dictionary_entry':
      return { heading: record.record.headword, body: record.record.text };
    case 'xref':
      return {
        heading: `${formatVerse(record.record.from_vid)} → ${formatReference({
          start: record.record.to_start_vid,
          end: record.record.to_end_vid,
        })}`,
        body: '',
      };
    case 'entity':
      return { heading: record.record.name, body: record.record.description ?? '' };
  }
}

/** Corta um texto no limite, sem quebrar palavra quando possível. */
export function excerpt(text: string, max = 600): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
