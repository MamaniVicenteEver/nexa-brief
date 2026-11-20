/* Una colección y un relleno por pieza; geometría y escala inmutables. */
export function choroplethScale(l, col = x => x) {
  const values = Object.values(l.values || {}), colors = (l.scale || ['blue', 'yellow', 'red']).map(col);
  const domain = l.domain || [Math.min(...values), Math.max(...values)];
  return { colors, domain };
}

export function createChoropleths(scene, { T, region, col, missing }) {
  const entries = (scene.layers || []).flatMap((l, i) => {
    if (l.type !== 'choropleth') return [];
    const features = Object.entries(l.values || {}).flatMap(([id, value]) => {
      const geometry = region(id)?.geometry;
      if (!geometry) { missing(`región no encontrada: ${id}`); return []; }
      return [{type:'Feature', properties:{value}, geometry}];
    });
    const { colors, domain } = choroplethScale(l, col), [min, max] = [domain[0], domain.at(-1)];
    const stops = colors.flatMap((color, j) => [domain.length === colors.length ? domain[j] : min + (max-min)*j/(colors.length-1), color]);
    const color = max > min ? ['interpolate', ['linear'], ['get', 'value'], ...stops] : colors[0];
    return [{l, id:`choro-${i}`, features, color, start:T(l.t,0), out:T(l.out,Infinity), alpha:0}];
  });
  return {
    appendTo(style) {
      for (const e of entries) {
        style.sources[e.id] = {type:'geojson', data:{type:'FeatureCollection', features:e.features}};
        // Mantiene el relleno en el lote de terreno anterior a los símbolos.
        const before = style.layers.findIndex(l => l.type === 'symbol');
        style.layers.splice(before < 0 ? style.layers.length : before, 0,
          {id:e.id, type:'fill', source:e.id, paint:{'fill-color':e.color, 'fill-opacity':0}});
      }
    },
    apply(map, t) {
      for (const e of entries) {
        const p = Math.max(0, Math.min(1, (t-e.start)/Math.max(.001,e.l.dur ?? .5)));
        const exit = e.l.exit ?? .35, fade = t < e.out ? 1 : exit > 0 ? Math.max(0,1-(t-e.out)/exit) : 0;
        const alpha = p*fade*(e.l.opacity ?? .65);
        if (e.alpha !== alpha) { map.setPaintProperty(e.id,'fill-opacity',alpha); e.alpha = alpha; }
      }
    },
  };
}
