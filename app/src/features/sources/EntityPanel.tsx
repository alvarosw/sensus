// Painel de entidade (pessoa, lugar, evento, grupo): descrição, coordenadas, mini-mapa e outras passagens.
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Empty, LinkButton, Skeleton, SubHeader, Tag, Txt, TypeMark, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import type { Entity } from '@sensus/core';
import { askAbout, showInText } from '../common/actions';
import { loadEntityPassages, type CiteDetail } from '../common/cites';
import { useBooks, useCite } from '../common/hooks';
import { SRC } from '../common/strings';
import { LicenseBlock, RefChips } from './PanelParts';

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

function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'L' : 'O'}`;
}

function EntityBody({ detail, entity }: { detail: CiteDetail; entity: Entity }) {
  const repo = useRepo();
  const books = useBooks();
  const passages = useAsync(() => loadEntityPassages(repo, detail.citeId), [repo, detail.citeId]);
  const hasPlace = entity.lat != null && entity.lon != null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TypeMark kind="ent" label={detail.typeLabel} />
        {detail.source ? <Tag label={detail.source.title.split(/ - | \(/)[0] ?? detail.source.title} /> : null}
      </View>
      <Txt v="panelTitle" testID="panel-title">{entity.name}</Txt>

      {hasPlace ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <MiniMap name={entity.name} />
          <View style={{ flex: 1, gap: 4 }}>
            <SubHeader label={SRC.coords} />
            <Txt v="mono" color="muted" testID="entity-coords">{formatCoords(entity.lat as number, entity.lon as number)}</Txt>
          </View>
        </View>
      ) : null}

      {entity.description ? <Txt v="fullText" selectable>{entity.description}</Txt> : null}

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

/** Mini-mapa esquemático (proto: .place svg): grade, água e o ponto da entidade ao centro. */
function MiniMap({ name }: { name: string }) {
  const { c, st } = useTheme();
  return (
    <View style={{ width: 92, height: 92, borderRadius: 10, backgroundColor: c.surfaceAlt, overflow: 'hidden' }} testID="entity-map">
      <Svg width={92} height={92} viewBox="0 0 92 92" accessibilityLabel={`Posição de ${name}`}>
        <G stroke={c.border} strokeWidth={1}>
          {[16, 31, 46, 61, 76].map((g) => (
            <G key={g}>
              <Line x1={g} y1={0} x2={g} y2={92} />
              <Line x1={0} y1={g} x2={92} y2={g} />
            </G>
          ))}
        </G>
        <Path d="M0 70 C20 62 30 74 50 68 S80 76 92 70 V92 H0Z" fill={st.tok} fillOpacity={0.25} />
        <Circle cx={46} cy={46} r={9} fill={st.ent} fillOpacity={0.25} />
        <Circle cx={46} cy={46} r={4} fill={st.ent} />
        <SvgText x={46} y={34} textAnchor="middle" fontSize={9} fontWeight="700" fill={c.text}>
          {name.length > 14 ? `${name.slice(0, 13)}…` : name}
        </SvgText>
      </Svg>
    </View>
  );
}
