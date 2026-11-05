import {spawn} from 'node:child_process';
const children=new Set();
export function killChildren(signal='SIGTERM'){for(const p of children)p.kill(signal);}
export function run(cmd,args,options={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe'],...options});children.add(p);let stdout='',stderr='';p.stdout?.on('data',x=>stdout+=x);p.stderr?.on('data',x=>stderr+=x);p.once('error',e=>{children.delete(p);reject(e);});p.once('close',code=>{children.delete(p);code===0?resolve({stdout,stderr}):reject(new Error(`${cmd} (${code}): ${stderr.slice(-6000)}`));});});}
