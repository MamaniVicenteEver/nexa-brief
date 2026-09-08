const path = require('path');
const {Config} = require('@remotion/cli/config');

// bg.jpg / song.mp3 viven en test/, no en public/ — así staticFile() los resuelve ahí.
// __dirname aquí resuelve dentro del paquete del CLI de Remotion, no del
// proyecto — hay que anclar a cwd (se invoca siempre desde la raíz del repo).
Config.setPublicDir(path.join(process.cwd(), 'test'));
