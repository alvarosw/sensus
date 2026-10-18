// Painel de entidade (pessoa, lugar, evento, grupo): descrição, coordenadas, mini-mapa e outras passagens.
import { View } from 'react-native';
import { Empty, LinkButton, Skeleton, SubHeader, Tag, Txt, TypeMark } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { shownEntityName, type Entity } from '@sensus/core';
import { askAbout, showInText } from '../common/actions';
import { loadEntityPassages, type CiteDetail } from '../common/cites';
import { useBooks, useCite } from '../common/hooks';
import { SRC } from '../common/strings';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { LicenseBlock, RefChips } from '../common/PanelParts';
import { PlaceMapBlock } from '@/features/maps';

export function EntityPanel({ citeId }: { citeId: string }) {
  const cite = useCite(citeId);
  if (cite.loading) {
    return (
      <View style={{ gap: 12 }}>
        <Skeleton width="30%" />
        <Skeleton width="55%" height={26} />
        <Skeleton />
        <Skeleton width="80%" />
      </View>
    );
  }
  if (!cite.detail || cite.detail.record.table !== 'entity') {
    return <Empty text={cite.error ? SRC.loadError : SRC.notFound} />;
  }
  return <EntityBody detail={cite.detail} entity={cite.detail.record.record} />;
}

function EntityBody({ detail, entity }: { detail: CiteDetail; entity: Entity }) {
  const repo = useRepo();
  const books = useBooks();
  const passages = useAsync(() => loadEntityPassages(repo, detail.citeId), [repo, detail.citeId]);
  const hasPlace = entity.lat != null && entity.lon != null;
  const descTr = useAutoTranslate(entity.description, detail.source?.lang ?? null);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TypeMark kind="ent" label={detail.typeLabel} />
        {detail.source ? <Tag label={detail.source.title.split(/ - | \(/)[0] ?? detail.source.title} /> : null}
      </View>
      <Txt v="panelTitle" testID="panel-title">{shownEntityName(entity, true).text}</Txt>

      {hasPlace ? <PlaceMapBlock entity={entity as Entity & { lat: number; lon: number }} /> : null}

      {entity.description ? (
        <View style={{ gap: 4 }}>
          <Txt v="fullText" selectable testID="entity-description">{descTr.display}</Txt>
          <AutoTranslateNote tr={descTr} testID="entity-tr" />
        </View>
      ) : null}

      <SubHeader label={SRC.otherPassages} />
      {passages.loading ? (
        <Txt v="meta" color="muted">{SRC.otherPassagesLoading}</Txt>
      ) : (passages.data?.length ?? 0) > 0 ? (
        <RefChips testIDPrefix="entity-ref" vids={passages.data ?? []} books={books} onPress={(vid) => showInText(vid)} />
      ) : (
        <Empty text={SRC.noPassages} />
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
        <LinkButton testID="panel-ask" label={SRC.askEntity} onPress={() => askAbout(detail, { closePanels: true })} />
      </View>
      <LicenseBlock sources={[detail.source]} citeId={detail.citeId} />
    </View>
  );
}
