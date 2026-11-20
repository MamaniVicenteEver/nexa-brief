import {createCanvas} from '@napi-rs/canvas';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,rm,copyFile,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {loadEpisode} from './runtime.mjs';
import {mixDialogue} from './mix.mjs';
import {renderFrame} from '../engine/render.js';
import {resolveView} from '../engine/core/view.js';
const args=process.argv.slice(2),episode=args.shift(),output=args[0]&&!args[0].startsWith('--')?args.shift():undefined,flags=args;let tmp,child;
const killRender=signal=>{if(child?.pid){try{process.kill(-child.pid,signal);}catch{}}};
const onSignal=signal=>{killRender(signal);process.exitCode=signal==='SIGINT'?130:143;};process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
try {
 if(!episode)throw new Error('Uso: node tools/render.mjs <episodio.json> <out.mp4> [--from segundos --to segundos --scale factor --view landscape|portrait --framing fit|tight]');
 const options={view:'portrait',framing:'fit'};for(let i=0;i<flags.length;i+=2){const flag=flags[i],value=flags[i+1];if(['--view','--framing'].includes(flag)){if(!(flag==='--view'?['landscape','portrait']:['fit','tight']).includes(value))throw new Error('Opción inválida: '+flag);options[flag.slice(2)]=value;}else if(['--from','--to','--scale'].includes(flag)&&Number.isFinite(Number(value)))options[flag.slice(2)]=Number(value);else throw new Error('Opción inválida: '+flag);}
 const c=await loadEpisode(episode),from=options.from??0,to=options.to??c.duration,scale=options.scale??1;
 if(!(from>=0&&to>from&&to<=c.duration&&scale>0&&scale<=2))throw new Error('Rango --from/--to/--scale inválido');
 const view=resolveView(options.view),width=Math.round(view.w*scale/2)*2,height=Math.round(view.h*scale/2)*2,frames=Math.ceil((to-from)*30),canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
 tmp=await mkdtemp('/tmp/vida-escena-render-');const audio=join(tmp,'dialogue.mp3');await mixDialogue(c,audio);
 const cpu0=process.cpuUsage(),start=performance.now(),destination=resolve(output??join(dirname(episode),'../render',c.episode.id+(view.orientation==='landscape'?'-16x9':'')+'.mp4'));await mkdir(dirname(destination),{recursive:true});
 const ffargs=['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-r','30','-i','pipe:0','-ss',String(from),'-i',audio,'-map','0:v:0','-map','1:a:0','-t',String(to-from),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',join(tmp,'out.mp4')];
 child=spawn('/usr/bin/time',['-v','-o',join(tmp,'ffmpeg-time.txt'),'ffmpeg',...ffargs],{stdio:['pipe','ignore','pipe'],detached:true});let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdin.on('error',()=>{});const finished=new Promise((ok,no)=>{child.once('error',no);child.once('close',code=>code===0?ok():no(new Error(`ffmpeg (${code}): ${stderr}`)));});finished.catch(()=>{});
 for(let f=0;f<frames;f++){if(process.exitCode)throw new Error('Render interrumpido');renderFrame(ctx,c,from+f/30,options);const rgba=Buffer.from(canvas.data());if(!child.stdin.write(rgba))await Promise.race([once(child.stdin,'drain'),finished.then(()=>{throw new Error('ffmpeg terminó antes de recibir todos los cuadros');})]);if(f%90===0)console.error(`Render ${f}/${frames}`);}
 child.stdin.end();await finished;const seconds=(performance.now()-start)/1000,cpu=process.cpuUsage(cpu0),usage=process.resourceUsage(),fftime=await readFile(join(tmp,'ffmpeg-time.txt'),'utf8');
 const number=label=>Number(fftime.match(new RegExp(label+':\\s+([\\d.]+)'))?.[1]??0);
 const report={episode:c.episode.id,output:destination,view:view.orientation,framing:options.framing,resolution:[width,height],width,height,fps:30,from,to,frames,seconds,render_fps:frames/seconds,cpu_seconds:(cpu.user+cpu.system)/1e6,cpu_percent:(cpu.user+cpu.system)/1e4/seconds,max_rss_kib:usage.maxRSS,ffmpeg:{user_seconds:number('User time \\(seconds\\)'),system_seconds:number('System time \\(seconds\\)'),max_rss_kib:number('Maximum resident set size \\(kbytes\\)')},codec:'H.264 CRF 18 / yuv420p / AAC 192k',frame_transport:'RGBA stdin; no archivos de cuadros'};
 await copyFile(join(tmp,'out.mp4'),destination);await writeFile(destination.replace(/\.mp4$/,'.render.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e.stack);process.exitCode||=1;}finally{killRender('SIGTERM');if(tmp)await rm(tmp,{recursive:true,force:true});process.off('SIGINT',onSignal);process.off('SIGTERM',onSignal);}
