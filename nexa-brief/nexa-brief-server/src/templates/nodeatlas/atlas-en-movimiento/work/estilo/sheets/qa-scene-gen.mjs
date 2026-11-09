import {readFile,writeFile} from 'node:fs/promises';
const c=JSON.parse(await readFile('engine/tactico/components.json'));const get=n=>structuredClone(c.components.find(x=>x.name===n).demo);
const names=['label.unit','army.advance','portrait.card','arrow.route','site.port','fx.impact','caption.transcript'];
const items=names.map(get);items.find(i=>i.type==='label.unit').screen=[.69,.19];items.find(i=>i.type==='fx.impact').t=2.6;
await writeFile('preview/tactico/qa-scene.json',JSON.stringify({duration:8,items},null,2)+'\n');
