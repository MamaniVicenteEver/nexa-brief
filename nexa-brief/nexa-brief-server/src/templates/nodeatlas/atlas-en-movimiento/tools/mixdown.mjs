#!/usr/bin/env node
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mixdown as sharedMixdown,runCLI} from '../../_tactico/tools/mixdown.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function mixdown(options={}){return sharedMixdown({root,...options});}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await runCLI({root});
