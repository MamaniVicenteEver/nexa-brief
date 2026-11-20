export const VIEWS=Object.freeze({portrait:Object.freeze({orientation:'portrait',w:1080,h:1920}),landscape:Object.freeze({orientation:'landscape',w:1920,h:1080})});
/** The logical view is independent of raster resolution (review thumbnails, exports). */
export function resolveView(input='portrait'){
 const orientation=typeof input==='string'?input:input?.orientation??'portrait';
 if(!VIEWS[orientation])throw new RangeError('view debe ser landscape o portrait');
 return VIEWS[orientation];
}
export function viewportView(width,height,requested='auto'){return resolveView(requested==='auto'?(width/height>=1?'landscape':'portrait'):requested);}
export function resolveFraming(compiled,options={}){
 const framing=options.framing??compiled.episode.framing??'fit';
 if(!['fit','tight'].includes(framing))throw new RangeError('framing debe ser fit o tight');
 return framing;
}
export function safeArea(view,subtitles=true){
 view=resolveView(view);
 return {left:.03,top:.03,right:.97,bottom:subtitles?.84:.97,subtitleTop:.86,subtitleBottom:.97};
}
