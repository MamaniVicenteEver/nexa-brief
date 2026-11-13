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
export function multiply(a,b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
// Margen calculado desde TODO el shutter: evita descubrir bordes sin imagen al girar.
export function shutterView(views) {
  const last=views.at(-1),{W,H}=last;
  let left=0,top=0,right=W,bottom=H;
  for(const view of views){
    const matrix=multiply(last.mercatorToScreen,view.screenToMercator);
    for(const [x,y] of [[0,0],[W,0],[W,H],[0,H]]){
      const p=transform(matrix,x,y);left=Math.min(left,p.x);top=Math.min(top,p.y);
      right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);
    }
  }
  left=Math.floor(left)-2;top=Math.floor(top)-2;right=Math.ceil(right)+2;bottom=Math.ceil(bottom)+2;
  const matrix=[...last.mercatorToScreen];matrix[4]-=left;matrix[5]-=top;
  const inv=inverse(matrix),width=right-left,height=bottom-top;
  const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>transform(inv,x,y));
  return {...last,W:width,H:height,unit:Math.min(W,H)/1080,
    mercatorToScreen:matrix,screenToMercator:inv,
    bounds:[Math.min(...corners.map(p=>p.x)),Math.min(...corners.map(p=>p.y)),Math.max(...corners.map(p=>p.x)),Math.max(...corners.map(p=>p.y))],
    project(...args){const p=last.project(...args);return {...p,x:p.x-left,y:p.y-top};}};
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
