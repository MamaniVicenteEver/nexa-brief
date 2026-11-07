import { drawProp } from '../props/index.js';
/** Precompute image padding once per plate, shared by Node and the browser. */
export function preparePlate(image,createCanvas){
 const blurred=createCanvas(image.width,image.height),b=blurred.getContext('2d');b.filter='blur(3px)';b.drawImage(image,0,0);
 const backdrop=createCanvas(image.width,image.height),bc=backdrop.getContext('2d');bc.filter='blur(24px)';
 // Overscan avoids transparent blur edges. Dimming happens once, outside the frame loop.
 bc.drawImage(image,-80,-80,image.width+160,image.height+160);bc.filter='none';bc.fillStyle='rgba(27,30,36,.13)';bc.fillRect(0,0,image.width,image.height);
 const feathered=createCanvas(image.width,image.height),fc=feathered.getContext('2d');fc.drawImage(image,0,0);fc.globalCompositeOperation='destination-in';
 for(const horizontal of [true,false]){const n=horizontal?image.width:image.height,g=fc.createLinearGradient(0,0,horizontal?n:0,horizontal?0:n);g.addColorStop(0,'transparent');g.addColorStop(40/n,'#000');g.addColorStop(1-40/n,'#000');g.addColorStop(1,'transparent');fc.fillStyle=g;fc.fillRect(0,0,image.width,image.height);}
 const blurredFeathered=createCanvas(image.width,image.height),bf=blurredFeathered.getContext('2d');bf.drawImage(blurred,0,0);bf.globalCompositeOperation='destination-in';bf.drawImage(feathered,0,0);
 return {image,blurred,backdrop,feathered,blurredFeathered};
}
export function drawPlate(ctx,set,resources,camera){
 const plate=resources?.plates?.[set.id],img=camera.blur?plate?.blurred??plate?.image:plate?.image;
 if(img){
  if(camera.fit){
   // A single stretched, blurred, dimmed copy fills every output pixel. Feathering
   // the foreground plate removes its hard top/bottom edge when portrait pulls back.
   ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(plate.backdrop??plate.blurred??plate.image,0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
   ctx.drawImage(camera.blur?plate.blurredFeathered??plate.blurred:plate.feathered??plate.image,0,0,set.plate.w,set.plate.h);return;
  }
  // Opaque underpaint also covers antialiased tile edges in native Canvas.
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(plate.image,0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
  const right=camera.x+camera.w,bottom=camera.y+camera.h;
  if(camera.x<0||camera.y<0||right>set.plate.w||bottom>set.plate.h){
   // Reflected, blurred image continuation. Never stretch a two-pixel floor stripe.
   ctx.save();ctx.filter=`blur(${set.charHeight*.025}px)`;
   const pad=set.charHeight*.15;
   for(let row=Math.floor((camera.y-pad)/set.plate.h);row<=Math.floor((bottom+pad)/set.plate.h);row++)for(let col=Math.floor((camera.x-pad)/set.plate.w);col<=Math.floor((right+pad)/set.plate.w);col++){
    ctx.save();ctx.translate((col+(Math.abs(col)%2))*set.plate.w,(row+(Math.abs(row)%2))*set.plate.h);ctx.scale(Math.abs(col)%2?-1:1,Math.abs(row)%2?-1:1);ctx.drawImage(plate.image,0,0,set.plate.w,set.plate.h);ctx.restore();
   }
   ctx.restore();
  }
  if(camera.blur&&plate.image)ctx.drawImage(plate.image,0,0,set.plate.w,set.plate.h);
  ctx.drawImage(img,0,0,set.plate.w,set.plate.h);
 }else{ctx.fillStyle='#f1dfc7';ctx.fillRect(camera.x-2,camera.y-2,camera.w+4,camera.h+4);}

}
export function drawSetProps(ctx,props,pass){
 for(const p of [...props].sort((a,b)=>Number(b.prop==='rug')-Number(a.prop==='rug'))){if(p.layer===pass)drawProp(ctx,p.prop,{...p,layer:'all'});}
}
export function drawShadow(ctx,a){const {x,y}=a.pose,s=a.rig.scale;ctx.save();const g=ctx.createRadialGradient(x,y,1,x,y,s*.14);g.addColorStop(0,'rgba(49,45,49,.20)');g.addColorStop(1,'rgba(49,45,49,0)');ctx.translate(x,y);ctx.scale(1,.20);ctx.fillStyle=g;ctx.translate(-x,-y);ctx.beginPath();ctx.arc(x,y,s*.16,0,Math.PI*2);ctx.fill();ctx.restore();}
export function drawLight(ctx,set,camera){const alpha=(1-set.light.ambient)*.5+.025;ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=alpha;ctx.fillStyle=set.light.tint;ctx.fillRect(camera?.x??0,camera?.y??0,camera?.w??set.plate.w,camera?.h??set.plate.h);ctx.restore();}
