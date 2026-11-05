import Ajv from 'ajv/dist/2020.js';
import {inspectEpisode} from '../engine/core/inspect.js';
import {loadEpisode,json,ROOT} from './runtime.mjs';
import {resolve,join} from 'node:path';
import {validateCapabilities} from '../engine/core/capabilities.js';
const schema=await json(join(ROOT,'schema/episode.schema.json'));
const validator=new Ajv({allErrors:true,strict:false}).compile(schema);
export async function validateEpisodeFile(path){
 const ep=await json(resolve(path));validateCapabilities(ep);if(!validator(ep)){const errors=validator.errors.filter(e=>e.keyword!=='oneOf'&&e.keyword!=='anyOf');throw new Error(errors.slice(0,12).map(e=>`$${e.instancePath.replace(/\/(\d+)(?=\/|$)/g,'[$1]').replace(/\//g,'.')}${e.params.additionalProperty?'.'+e.params.additionalProperty:''}: ${e.keyword==='required'?'falta '+e.params.missingProperty:e.keyword==='additionalProperties'?'propiedad no permitida':e.keyword==='enum'?'valor fuera del catálogo; alternativas válidas: '+e.params.allowedValues.join(' | '):e.keyword==='type'?'tipo incorrecto':e.keyword==='const'?'valor fijo incorrecto':'valor fuera del esquema'} (${JSON.stringify(e.params)})`).join('\n'));}
 const compiled=await loadEpisode(path,{images:false});compiled.warnings.push(...inspectEpisode(compiled).warnings);return compiled;
}
