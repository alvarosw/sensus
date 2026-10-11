// Bloco de mapa do painel de entidade (lugar): o mapa real com o lugar, coordenadas e as outras identificações.
import { useMemo } from 'react';
import { View } from 'react-native';
import { confidenceLabel, type Entity } from '@sensus/core';
import { radius, SubHeader, Txt, useTheme } from '@/design';
import { SRC } from '../common/strings';
import { formatCoords } from './MapPanel';
import { SensusMap } from './SensusMap';
import type { MapMarker } from './geometry';
import { MAPS } from './strings';
import { usePlaceSites, WHOLE_BIBLE } from './usePlaceSites';

export function PlaceMapBlock({ entity }: { entity: Entity & { lat: number; lon: number } }) {
  const { c } = useTheme();
  const { sites } = usePlaceSites(WHOLE_BIBLE);
  // O lugar desta entidade é o sítio que a agrupa (mesma localidade em outra fonte).
  const site = useMemo(() => sites.find((s) => s.citeIds.includes(entity.cite_id)) ?? null, [sites, entity.cite_id]);
  const markers = useMemo<MapMarker[]>(
    () => [{ id: entity.cite_id, name: entity.name, lat: entity.lat, lon: entity.lon, band: site?.band ?? 'none' }],
    [entity.cite_id, entity.name, entity.lat, entity.lon, site?.band],
  );
  const candidates = site?.candidates ?? [];
  const homonyms = site?.homonyms ?? [];

  return (
    <View style={{ gap: 10 }}>
      <View style={{ height: 180, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
        <SensusMap markers={markers} selectedId={entity.cite_id} lite style={{ flex: 1 }} testID="entity-map" />
      </View>
      <SubHeader label={SRC.coords} />
      <Txt v="mono" color="muted" testID="entity-coords">{formatCoords(entity.lat, entity.lon)}</Txt>

      {site ? (
        <View style={{ gap: 4 }} testID="entity-ident">
          <SubHeader label={MAPS.identification} />
          <Txt v="bodySm" testID="entity-confidence">
            {site.confidence != null
              ? `${MAPS.confidence}: ${confidenceLabel(site, MAPS.bands)}`
              : `${MAPS.confidence}: ${MAPS.bands.none}`}
          </Txt>
          {candidates.length > 0 ? (
            <View style={{ gap: 3 }} testID="entity-candidates">
              <Txt v="meta" color="muted">{MAPS.candidates}</Txt>
              {candidates.map((cand, i) => (
                <Txt key={`${cand.name}-${i}`} v="bodySm" testID={`entity-candidate-${i}`}>
                  {cand.score != null ? `${cand.name} · ${cand.score.toFixed(2).replace('.', ',')}` : cand.name}
                </Txt>
              ))}
            </View>
          ) : null}
          {homonyms.length > 0 ? (
            <View style={{ gap: 3 }} testID="entity-homonyms">
              <Txt v="meta" color="muted">{MAPS.homonyms}</Txt>
              {homonyms.map((h) => (
                <Txt key={h.id} v="mono" color="muted" style={{ fontSize: 11 }}>
                  {`${h.name} · ${formatCoords(h.lat, h.lon)}`}
                </Txt>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
