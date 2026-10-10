import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { Source, Token } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { t } from '@/i18n';
import { Button, Chip } from '@/ui/primitives';
import { Body, Label, Meta } from '@/ui/text';
import { LoadingView } from '@/ui/state';
import { readingFont, useTheme } from '@/ui/theme';
import { excerpt, previewOf } from './record-preview';
import { openSource } from './navigation';

interface SheetApi {
  openCite: (citeId: string) => void;
  openToken: (tokenCiteId: string) => void;
}

const SheetContext = createContext<SheetApi | null>(null);

/** Abre as fichas de citação e de palavra grega. Envolver telas que renderizam texto rico. */
export function SheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ kind: 'cite' | 'token'; id: string } | null>(null);
  const [shown, setShown] = useState<{ kind: 'cite' | 'token'; id: string } | null>(null);

  const openCite = useCallback((citeId: string) => {
    setShown({ kind: 'cite', id: citeId });
    setOpen({ kind: 'cite', id: citeId });
  }, []);
  const openToken = useCallback((tokenCiteId: string) => {
    setShown({ kind: 'token', id: tokenCiteId });
    setOpen({ kind: 'token', id: tokenCiteId });
  }, []);
  const api = useMemo<SheetApi>(() => ({ openCite, openToken }), [openCite, openToken]);

  return (
    <SheetContext.Provider value={api}>
      {children}
      <Sheet visible={open !== null} onClose={() => setOpen(null)}>
        {shown?.kind === 'cite' ? (
          <CiteBody citeId={shown.id} onFull={() => closeAndOpen(setOpen, () => openSource(shown.id))} />
        ) : shown?.kind === 'token' ? (
          <TokenBody
            tokenCiteId={shown.id}
            onFull={() => closeAndOpen(setOpen, () => openSource(shown.id))}
          />
        ) : null}
      </Sheet>
    </SheetContext.Provider>
  );
}

function closeAndOpen(setOpen: (v: null) => void, go: () => void) {
  setOpen(null);
  go();
}

export function useSheets(): SheetApi {
  const api = useContext(SheetContext);
  if (!api) throw new Error('useSheets fora de SheetProvider');
  return api;
}

/** Painel inferior com deslize. Toque no fundo fecha. */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View
        style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '72%',
          paddingBottom: 24,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginVertical: 10 }} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 14 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function CiteBody({ citeId, onFull }: { citeId: string; onFull: () => void }) {
  const repo = useRepo();
  const theme = useTheme();
  const data = useAsync<{ record: Awaited<ReturnType<typeof repo.resolveCite>>; sources: Source[] }>(
    async () => ({ record: await repo.resolveCite(citeId), sources: await repo.sources() }),
    [repo, citeId],
  );
  if (data.loading) return <LoadingView />;
  if (data.error || !data.data?.record) return <Body>{t('source.notFound')}</Body>;

  const { record, sources } = data.data;
  const source = sources.find((s) => s.id === record.record.source_id);
  const preview = previewOf(record);
  return (
    <>
      <Meta>{source?.title ?? record.record.source_id}{source?.tradition ? ` · ${source.tradition}` : ''}</Meta>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{preview.heading}</Text>
      {preview.body ? <Body reading={record.table === 'verse_text'} style={record.table === 'verse_text' ? { fontFamily: readingFont } : undefined}>{excerpt(preview.body)}</Body> : null}
      <Button label={t('sheet.openFull')} onPress={onFull} />
    </>
  );
}

function TokenBody({ tokenCiteId, onFull }: { tokenCiteId: string; onFull: () => void }) {
  const repo = useRepo();
  const theme = useTheme();
  const data = useAsync<{ token: Token | null; lex: string | null }>(
    async () => {
      const rec = await repo.resolveCite(tokenCiteId);
      if (!rec || rec.table !== 'token') return { token: null, lex: null };
      const entries = rec.record.strong_base ? await repo.lexicon([rec.record.strong_base]) : [];
      return { token: rec.record, lex: entries[0]?.definition ?? null };
    },
    [repo, tokenCiteId],
  );
  if (data.loading) return <LoadingView />;
  if (data.error || !data.data?.token) return <Body>{t('source.notFound')}</Body>;
  const { token, lex } = data.data;

  return (
    <>
      <Text style={{ color: theme.text, fontSize: 26, fontFamily: readingFont }}>{token.surface}</Text>
      {token.translit ? <Meta>{token.translit}</Meta> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {token.lemma ? <Chip label={`${t('source.field.lemma')}: ${token.lemma}`} /> : null}
        {token.strong ? <Chip label={`${t('source.field.strong')}: ${token.strong}`} /> : null}
      </View>
      {token.morph || token.morph_desc ? (
        <View style={{ gap: 2 }}>
          <Label>{t('sheet.morph')}</Label>
          <Body>{token.morph_desc ?? token.morph}</Body>
          {token.morph_desc && token.morph ? <Meta>{token.morph}</Meta> : null}
        </View>
      ) : null}
      {token.gloss_en ? (
        <View style={{ gap: 2 }}>
          <Label>{t('source.field.gloss')}</Label>
          <Body>{token.gloss_en}</Body>
        </View>
      ) : null}
      {lex ? (
        <View style={{ gap: 2 }}>
          <Label>{t('sheet.lexicon')}</Label>
          <Body>{excerpt(lex, 400)}</Body>
        </View>
      ) : null}
      {token.variant_note ? <Meta>{`${t('source.field.variant')}: ${token.variant_note}`}</Meta> : null}
      <Button label={t('sheet.openFull')} onPress={onFull} />
    </>
  );
}
