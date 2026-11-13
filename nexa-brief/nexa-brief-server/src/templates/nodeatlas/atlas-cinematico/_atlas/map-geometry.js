/* Geometría compartida por arc y las piezas geográficas del noticiero. */
const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function greatCircle(a, b, s) {
  const xyz = p => { const lon = p[0] * PI / 180, lat = p[1] * PI / 180; return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; };
  const u = xyz(a), v = xyz(b), angle = Math.acos(clamp(u.reduce((n, x, i) => n + x * v[i], 0), -1, 1));
  let p;
  if (angle < 1e-8) p = u;
  else if (PI - angle < 1e-7) { const axis = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], dot = u.reduce((n, x, i) => n + x * axis[i], 0), q = axis.map((x, i) => x - dot * u[i]), len = Math.hypot(...q); p = u.map((x, i) => x * Math.cos(PI * s) + q[i] / len * Math.sin(PI * s)); }
  else p = u.map((x, i) => (x * Math.sin((1 - s) * angle) + v[i] * Math.sin(s * angle)) / Math.sin(angle));
  return [Math.atan2(p[1], p[0]) * 180 / PI, Math.atan2(p[2], Math.hypot(p[0], p[1])) * 180 / PI];
}

export function arcPoint(a, b, u, view, unit, l, point, origin, to) {
  let q;
  if (a) {
    if (l.path === 'straight' || l.path === 'curve') q = origin ? {x:origin.x+(to.x-origin.x)*u,y:origin.y+(to.y-origin.y)*u,k:origin.k+(to.k-origin.k)*u,visible:true} : null;
    else q = point(greatCircle(a,b,u),view,(l.altM || 0)*Math.sin(PI*u));
  } else q = {x:-view.W*.12+(to.x+view.W*.12)*u,y:to.y-view.H*.25*(1-u),k:to.k};
  return q ? {...q,y:q.y-(l.path==='straight'?0:l.lift ?? (l.style==='magenta'?180:100))*unit*q.k*Math.sin(PI*u)} : null;
}

export function distance(a, b) {
  const r = PI / 180, dlat = (b[1]-a[1])*r, dlon = (b[0]-a[0])*r;
  return 2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2)));
}

export function destination(at, km, bearing) {
  const r=PI/180, lat=at[1]*r, lon=at[0]*r, d=km/6371.0088;
  const y=Math.asin(clamp(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing),-1,1));
  return [(lon+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y)))/r,y/r];
}
