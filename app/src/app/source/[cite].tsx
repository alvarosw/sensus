import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, Text, View } from 'react-native';
import {
  formatReference,
  googleTranslateLinks,
  type Book,
  type CitableRecord,
  type Source,
} from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { APP_LANG, t } from '@/i18n';
import { Button, Card, Heading } from '@/ui/primitives';
import { Body, Label, Meta } from '@/ui/text';
import { ErrorView, LoadingView } from '@/ui/state';
import { readingFont, useTheme } from '@/ui/theme';

type Field = { label: string; value: string | number | null | undefined };

export default function SourceScreen() {
  const { cite } = useLocalSearchParams<{ cite: string }>();
  const key = cite ?? '';
  const sourceOnly = key.startsWith('src:');

  const repo = useRepo();
  const theme = useTheme();

  const sources = useAsync(() => repo.sources(), [repo]);
  const books = useAsync(() => repo.books(), [repo]);
  const record = useAsync<CitableRecord | null>(
    () => (sourceOnly ? Promise.resolve(null) : repo.resolveCite(key)),
    [repo, key, sourceOnly],
  );

  if (sources.loading || books.loading || record.loading) return <LoadingView />;
  const loadError = sources.error ?? books.error ?? record.error;
  if (loadError) {
    return (
      <ErrorView
        message={t('common.error')}
        detail={loadError}
        onRetry={() => {
          sources.reload();
          books.reload();
          record.reload();
        }}
      />
    );
  }

  const sourceId = sourceOnly ? key.slice('src:'.length) : record.data?.record.source_id;
  const source = (sources.data ?? []).find((s) => s.id === sourceId);
  const allBooks = books.data ?? [];

  if (!sourceOnly && !record.data) {
    return (
      <>
        <Stack.Screen options={{ title: t('source.title') }} />
        <ErrorView message={t('source.notFound')} />
      </>
    );
  }

  const primaryText = record.data ? textOf(record.data) : '';
  const translateLinks =
    source && source.lang === 'en' && primaryText ? googleTranslateLinks(primaryText, APP_LANG) : [];

  return (
    <>
      <Stack.Screen options={{ title: source?.title ?? t('source.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} contentInsetAdjustmentBehavior="automatic">
        {record.data ? <RecordCard record={record.data} books={allBooks} /> : null}

        {translateLinks.length > 0 ? (
          <Card style={{ gap: 10 }}>
            <Heading level={3}>{t('source.translate')}</Heading>
            <View style={{ gap: 8 }}>
              {translateLinks.map((link, i) => (
                <Button
                  key={link}
                  variant="secondary"
                  label={
                    translateLinks.length > 1
                      ? t('source.translatePart', { part: i + 1, total: translateLinks.length })
                      : t('source.translate')
                  }
                  onPress={() => Linking.openURL(link)}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: 12 }}>
          <Heading level={3}>{t('source.details')}</Heading>
          {source ? (
            <SourceDetails source={source} />
          ) : (
            <Meta>{t('common.noSource')}</Meta>
          )}
          {source && /^https?:\/\//.test(source.url) ? (
            <Button label={t('source.openUrl')} variant="ghost" onPress={() => Linking.openURL(source.url)} />
          ) : null}
        </Card>
        <Text style={{ color: theme.textMuted, fontSize: 11 }} selectable>
          {key}
        </Text>
      </ScrollView>
    </>
  );
}

function textOf(record: CitableRecord): string {
  switch (record.table) {
    case 'verse_text':
    case 'commentary':
    case 'dictionary_entry':
      return record.record.text;
    case 'lexicon_entry':
      return record.record.definition;
    case 'token':
      return record.record.surface;
    case 'entity':
      return record.record.description ?? record.record.name;
    default:
      return '';
  }
}

function RecordCard({ record, books }: { record: CitableRecord; books: Book[] }) {
  const ref = (start: number, end: number = start) => formatReference({ start, end }, books);
  const fields: Field[] = [];
  let body: string | null = null;
  let heading = t('source.record');

  switch (record.table) {
    case 'verse_text':
      heading = ref(record.record.vid);
      body = record.record.text;
      break;
    case 'commentary':
      heading = ref(record.record.start_vid, record.record.end_vid);
      body = record.record.text;
      break;
    case 'dictionary_entry':
      heading = record.record.headword;
      body = record.record.text;
      break;
    case 'lexicon_entry':
      heading = record.record.lemma ?? record.record.key;
      fields.push(
        { label: t('source.field.strong'), value: record.record.key },
        { label: t('source.field.translit'), value: record.record.translit },
        { label: t('source.field.gloss'), value: record.record.gloss },
      );
      body = record.record.definition;
      break;
    case 'token':
      heading = record.record.surface;
      fields.push(
        { label: t('source.reference'), value: ref(record.record.vid) },
        { label: t('source.field.translit'), value: record.record.translit },
        { label: t('source.field.lemma'), value: record.record.lemma },
        { label: t('source.field.strong'), value: record.record.strong },
        { label: t('source.field.morph'), value: record.record.morph_desc ?? record.record.morph },
        { label: t('source.field.gloss'), value: record.record.gloss_en },
        { label: t('source.field.editions'), value: record.record.editions },
        { label: t('source.field.variant'), value: record.record.variant_note },
        { label: t('source.field.altRef'), value: record.record.alt_ref },
      );
      break;
    case 'xref':
      heading = `${ref(record.record.from_vid)} → ${ref(record.record.to_start_vid, record.record.to_end_vid)}`;
      fields.push({ label: t('source.field.weight'), value: record.record.weight });
      break;
    case 'entity':
      heading = record.record.name;
      fields.push(
        { label: t('source.field.type'), value: t(`entity.${record.record.type}` as 'entity.other') },
        {
          label: t('source.field.coords'),
          value:
            record.record.lat !== null && record.record.lon !== null
              ? `${record.record.lat}, ${record.record.lon}`
              : null,
        },
      );
      body = record.record.description;
      break;
  }

  return (
    <Card style={{ gap: 10 }}>
      <Meta>{t('source.record')}</Meta>
      <Heading level={1}>{heading}</Heading>
      <RecordFields fields={fields} />
      {body ? <Body reading={record.table === 'verse_text'} style={{ fontFamily: record.table === 'verse_text' ? readingFont : undefined }}>{body}</Body> : null}
    </Card>
  );
}

function RecordFields({ fields }: { fields: Field[] }) {
  const present = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  if (present.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {present.map((f) => (
        <View key={f.label} style={{ gap: 2 }}>
          <Label>{f.label}</Label>
          <Body>{String(f.value)}</Body>
        </View>
      ))}
    </View>
  );
}

function SourceDetails({ source }: { source: Source }) {
  const fields: Field[] = [
    { label: t('source.field.title'), value: source.title },
    { label: t('source.field.author'), value: source.author },
    { label: t('source.field.lang'), value: source.lang },
    { label: t('source.field.license'), value: source.license },
    { label: t('source.field.attribution'), value: source.attribution },
    { label: t('source.field.url'), value: source.url },
    { label: t('source.field.version'), value: source.version },
    { label: t('source.field.retrieved'), value: source.retrieved_at },
    { label: t('source.field.tradition'), value: source.tradition },
    { label: t('source.field.notes'), value: source.notes },
  ];
  return <RecordFields fields={fields} />;
}
