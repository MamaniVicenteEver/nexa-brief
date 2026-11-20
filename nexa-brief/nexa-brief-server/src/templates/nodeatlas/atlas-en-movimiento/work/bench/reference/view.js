const DEG = Math.PI / 180;
export const MAX_LAT = 85.0511287798066;
export function mercator(lon, lat) {
  const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * DEG;
  return [(lon + 180) / 360, (1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2];
}
export function transform(matrix, x, y) {
  const [a,b,c,d,e,f] = matrix;
  return {x:a*x+c*y+e, y:b*x+d*y+f};
}
export function inverse(matrix) {
  const [a,b,c,d,e,f] = matrix, det = a*d-b*c;
  return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
}
export function createView(pose, W, H) {
  const center = mercator(pose.lon, pose.lat), scale = 512 * 2 ** pose.zoom;
  const angle = -(pose.bearing || 0) * DEG, a = scale*Math.cos(angle), b = scale*Math.sin(angle);
  const matrix = [a,b,-b,a,W/2-a*center[0]+b*center[1],H/2-b*center[0]-a*center[1]];
  const inv = inverse(matrix), corners = [[0,0],[W,0],[W,H],[0,H]].map(([x,y])=>transform(inv,x,y));
  const bounds = [Math.min(...corners.map(p=>p.x)),Math.min(...corners.map(p=>p.y)),Math.max(...corners.map(p=>p.x)),Math.max(...corners.map(p=>p.y))];
  return {
    W,H,zoom:pose.zoom,bearing:pose.bearing||0,pitch:0,scale,center,bounds,
    mercatorToScreen:matrix, screenToMercator:inv,
    project(lon,lat,altM=0) {
      const [mx,my]=mercator(lon,lat), p=transform(matrix,mx,my);
      // Como Atlas: visible indica oclusión/validez, no recorte al viewport.
      const k=Math.max(.35,Math.min(1.5,Math.cos(pose.lat*DEG)/Math.max(.001,Math.cos(lat*DEG))));
      return {...p,visible:Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(lat)<=90,k};
    },
  };
}
// MapLibre usa un mundo de 512 px y el proveedor teselas de 256 px.
// El z de tesela es zoom+1. El último cuarto mezcla el mip actual con el próximo.
export function tileLevels(zoom, maxZoom=8, tileSize=256) {
  const native = Math.max(0,zoom+Math.log2(512/tileSize));
  const low = Math.min(maxZoom,Math.floor(native)), high = Math.min(maxZoom,low+1);
  const u = Math.max(0,Math.min(1,((native-Math.floor(native))-.75)/.25));
  return {low,high,alpha:low===high?0:u*u*(3-2*u)};
}
export function visibleTiles(view,z) {
  const n=2**z, [left,top,right,bottom]=view.bounds, out=[];
  // El mismo mundo único que Atlas (renderWorldCopies:false). Un margen evita juntas.
  const x0=Math.max(0,Math.floor(left*n)-1),x1=Math.min(n-1,Math.floor(right*n)+1);
  const y0=Math.max(0,Math.floor(top*n)-1),y1=Math.min(n-1,Math.floor(bottom*n)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)out.push({z,x,y,key:`${z}/${x}/${y}`});
  return out;
}
