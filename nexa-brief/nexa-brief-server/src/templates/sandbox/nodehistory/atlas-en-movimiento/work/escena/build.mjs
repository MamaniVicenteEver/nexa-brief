import fs from 'node:fs';
import {pathAt} from '../../../_tactico/util.js';
import {timerFromWords} from '../../../_tactico/tools/anchors.js';
const read=p=>JSON.parse(fs.readFileSync(p)), write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const measured=read('work/voz/anclas.json'),lyrics=read('assets/lyrics.json'),words=lyrics.segments.flatMap(s=>s.words||[]),T=timerFromWords(words);
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]/g,'').trim();
const anchors=Object.fromEntries(measured.anchors.map(a=>{const w=norm(a.word),n=words.slice(0,a.global_word_index+1).filter(v=>norm(v.word)===w).length;const ref='@'+w+(n>1?'#'+n:'');if(T(ref,NaN)!==a.start)throw Error(a.id);return [a.id,{...a,ref}];}));
const A=(id,offset=0)=>anchors[id].ref+(offset?(offset>0?'+':'')+offset:'');
const sec=t=>T(t,NaN),items=[];
function item(id,type,t,end,props={}){const x={id,type,t,dur:+(sec(end)-sec(t)).toFixed(3),out:typeof end==='number'?+(end-.3).toFixed(3):end,fade:.3,sfx:false,...props};items.push(x);return x;}
const label=(id,text,t,end,props={})=>item(id,'label.chip',t,end,{text,screen:[.5,.13],width:920,size:36,...props});
const year=(id,text,t,end)=>item(id,'text.year',t,end,{text,screen:[.5,.23],size:140,width:900});
const path=(via,t,dur,curve='smooth')=>({via,t,dur,curve,ease:'inOut'});
const state=(id,s,offset=0,dur=.35)=>({at:A(id,offset),state:s,dur});
const impact=(id,at,t,size=80)=>item(id,'fx.impact',t,sec(t)+1.7,{at,size,particles:36,variant:'water',fade:0,sfx:[{sfx:'explosion-far',dur:1.6,gain_db:-29}]});
const places={Farsi:[49.8333,27.9667],Abadan:[48.27,30.36],Jorramchar:[48.18,30.44],Basora:[47.95,30.55],Kharg:[50.32,29.24],Sirri:[54.54,25.91],Ormuz:[56.4,26.5],Golfo:[53.1,27.1],Stark:[51.9167,26.7833],IranAjr:[51.2,26.6],Roberts:[51.6,26.2],Sassan:[53.13,25.5],PlataformaSirri:[54.5,25.83],Enterprise:[59,24],Sahand:[56.0,26.50],Sabalan:[56.36,26.78],Joshan:[54.5,25.8],AlFaw:[48.47,29.98]};
const sea=[[50.32,29.20],[50.3,28.5],[51.3,27.6],[52.3,26.9],[54.5,26.0],[55.5,26.35],[56.4,26.5],[56.75,26.25],[57.2,25.6],[58.4,24.9]];
const escortUnits=[{type:'naval.warship',variant:'cruiser',label:'USS Fox',flag:'US'},{type:'naval.warship',variant:'destroyer',label:'USS Kidd',flag:'US'},{type:'naval.warship',variant:'frigate',label:'USS Crommelin',flag:'US'}];
// 1 — Una mina, un mercante superviviente y sus tres escoltas.
item('intro','intro.title',0,5.5,{fade:0,title:'LA GUERRA DE\nLOS PETROLEROS',subtitle:'Golfo Pérsico · 1980–1988',kicker:'ATLAS EN MOVIMIENTO',year:'1987',focus:'Farsi',style:'focus'});
const hookPath=path([[50.03,27.78],places.Farsi,[49.67,28.12]],4.85,17);
// Ajustar la duración para que el mercante alcance la coordenada publicada al decir «mina».
{let lo=0,hi=1;const normalized={...hookPath,t:0,dur:1};for(let n=0;n<50;n++){const m=(lo+hi)/2;if(pathAt(normalized,m).lon>places.Farsi[0])lo=m;else hi=m;}hookPath.dur=(anchors['bridgeton-mina'].start-hookPath.t)/((lo+hi)/2);}
item('bridgeton','naval.cargo',0,25.23,{at:hookPath.via[0],variant:'tanker',flag:'US',label:'Bridgeton',heading:'auto',scale:1.08,path:hookPath,states:[state('bridgeton-mina','hit')],sfx:[{sfx:'naval-engine-low',at:5.5,dur:7,gain_db:-27}],source_facts:['G23','G24']});
item('escoltas-inicio','naval.group',0,16.5,{leader:'bridgeton',units:escortUnits,formation:'diamond',spacing:.72,path:hookPath,heading:'auto',scale:1.08});
item('escoltas-estela','naval.group',A('bridgeton-estela',-3.25),25.23,{leader:'bridgeton',units:escortUnits,formation:'line',spacing:.43,path:hookPath,heading:'auto',scale:1.08});
label('fecha-bridgeton','24 JUL 1987 · AL OESTE DE FARSI',A('gancho-fecha'),25.23,{screen:[.5,.1]});
label('capitan','Frank C. Seitz, Jr. · capitán del Bridgeton',A('capitan'),10.29,{screen:[.5,.23],size:30});
impact('mina-bridgeton','bridgeton',A('bridgeton-mina'));
item('onda-bridgeton','fx.shockwave',A('bridgeton-mina'),15.3,{at:'bridgeton',variant:'water',size:100,fade:0});
label('sobrevive-bridgeton','El mercante sobrevive',A('bridgeton-mina',1.8),19.2,{screen:[.5,.23]});
label('siguen-estela','Las escoltas siguen su estela',A('bridgeton-estela'),23.5,{screen:[.5,.23]});
label('retroceso','Siete años antes',A('retroceso',-.8),27.3,{screen:[.5,.72]});
// 2 — Frentes aproximados y objetivos terrestres; ninguna conquista ficticia.
item('iran-bandera','territory.flag',25.23,35.5,{region:'IR',flag:'IR',flagMode:'fill',opacity:.58});
item('iraq-bandera','territory.flag',25.23,35.5,{region:'IQ',flag:'IQ',flagMode:'marker',at:[44.8,33.7],flagWidth:110});
item('iraq-tinte','territory.fill',25.23,67.75,{region:'IQ',color:'danger',opacity:.22});
item('iran-tinte','territory.fill',35.2,67.75,{region:'IR',color:'success',opacity:.2});
item('iran-borde','territory.glow',25.23,35.5,{region:'IR',color:'cyan',opacity:.4,pulse:false,width:1});
label('invasion','SEPTIEMBRE DE 1980',A('invasion'),40.8);
item('iran-nombre','label.neon',25.8,35.5,{at:[53,33],text:'IRÁN',color:'cyan',size:74});
item('iraq-nombre','label.neon',25.8,35.5,{at:[44.6,31.8],text:'IRAK',color:'accent',size:66});
item('sadam','portrait.badge',A('invasion'),34.8,{at:[46.8,32.2],src:'assets/media/P02.png',name:'Sadam Husein',role:'Presidente de Irak · 1980',date:'Foto: antes de 1987',credit:'Min. Información de Irak · PD',offset:[-245,420],scale:.76});
item('jomeini','portrait.badge',A('invasion'),34.8,{at:[46.8,32.2],src:'assets/media/P01.png',name:'Ruhollah Jomeini',role:'Líder supremo de Irán',date:'Foto: 6 may 1981',credit:'Ali Kaveh · PD-Iran',offset:[245,420],scale:.76});
for(const [n,via] of [[[46.0,32.7],[46.17,33.12]],[[47.3,31.75],[48.1,32.2]],[[47.6,30.7],[48.1,30.51]]].entries()){
 item('avance-'+n,'unit.advance',A('corredores'),40.8,{flag:'IQ',count:4,formation:'wedge',scale:.63,path:path(via,A('corredores'),7),heading:'auto'});
 item('flecha-avance-'+n,'arrow.route',A('corredores'),40.8,{via,width:6,color:'accent'});
}
const front1980=[[45.58,34.52],[46.17,33.12],[48.12,32.35],[48.45,31.43],[48.18,30.44]];
const front1982=[[45.4,34.5],[45.85,33.3],[47.1,32.5],[47.45,31.35],[47.95,30.55]];
item('frente','front.line',A('corredores'),67.75,{via:front1980,color:'danger',width:4,states:[{at:A('frente-1982'),state:'retreat',via:front1982,dur:1.2}],note:'G07/G10; esquema regional, no línea digitalizada ni frontera jurídica.'});
label('frente-aprox','Frente aproximado · flechas: direcciones',A('corredores'),67.75,{screen:[.5,.78],size:27});
item('jorramchar-mapa','label.callout',A('objetivos-sur'),59.03,{at:'Jorramchar',text:'Jorramchar\n(Khorramshahr)',offset:[-190,-210],width:440,size:34});
item('abadan','site.refinery',A('objetivos-sur'),59.03,{at:'Abadan',label:'Abadán · refinería',scale:.92,states:[state('abadan-refineria','hit')],source_facts:['G05','G06']});
label('abadan-resiste','Abadán resiste el asedio',A('abadan-resiste'),45.73,{screen:[.5,.22]});
item('humo-abadan','fx.smoke',A('abadan-refineria'),48.73,{at:'Abadan',size:50,particles:18,drift:[20,-35],variant:'column'});
label('rompe-cerco','SEP 1981 · Irán rompe el cerco',A('cerco-roto'),50.6,{screen:[.5,.22]});
year('ano-1982','1982','@1982',59.03);
label('recupera-jorramchar','24 MAY 1982 · Irán recupera Jorramchar',A('jorramchar'),59.03);
item('retirada-iraq','unit.retreat',A('jorramchar'),59.03,{flag:'IQ',count:5,scale:.72,path:path([[48.16,30.52],[47.92,30.7]],A('jorramchar'),4.6),heading:'auto'});
item('recuperacion-iran','unit.advance',A('jorramchar'),59.03,{flag:'IR',count:4,scale:.64,path:path([[48.45,30.62],[48.18,30.44]],A('jorramchar'),4.2),heading:'auto'});
label('guerra-continua','La guerra continúa',A('guerra-continua'),64.5,{screen:[.5,.22]});
item('ofensiva-basora','unit.advance',62.27,67.75,{flag:'IR',count:5,scale:.8,path:path([[48.28,30.7],[47.95,30.55]],62.27,5),heading:'auto'});
item('basora-label','label.callout',A('basora'),67.75,{at:'Basora',text:'Basora · Irak',offset:[-100,-190],size:36});
// 3 — Exportación; el dinero es simbólico, sin cifras de comercio inventadas.
item('kharg-terminal','site.port',A('kharg-exporta'),90.19,{at:'Kharg',label:'Kharg · terminal exportador',scale:1.1});
label('kharg-no-refineria','Terminal de exportación de crudo',A('kharg-exporta'),75.29);
label('instalaciones-distintas','Abadán: refinería · Kharg: terminal',A('instalaciones-distintas'),79.35,{screen:[.5,.73],size:32});
label('rutas-esquema','Rutas esquemáticas · flujos sin escala',A('rutas-golfo'),90.19,{screen:[.5,.76],size:28});
item('ruta-exportacion','route.sea',A('rutas-golfo'),90.19,{via:sea,color:'text',width:2});
item('carriles-ormuz','route.lanes',A('rutas-golfo'),90.19,{via:sea.slice(3),text:'ORMUZ',chipAt:.68,width:1.5,lanes:3});
item('flecha-exportacion','arrow.flow',A('rutas-golfo'),90.19,{via:sea,width:5,color:'accent'});
item('flujo-economico','money.flow',A('rutas-golfo'),90.19,{at:'Kharg',via:sea,count:4,scale:.5,period:7,routeVisible:false,note:'Símbolo económico; no cifra, cargamento ni destino histórico específico.'});
const toSirri=sea.slice(0,5).concat([[54.54,25.98]]);
item('mercante-crudo','naval.cargo',A('kharg-sirri'),90.19,{variant:'tanker',flag:'IR',scale:.62,label:'Crudo hacia Sirri',path:path(toSirri,A('kharg-sirri'),6.5,'line'),heading:'auto'});
item('sirri-terminal','site.port',A('kharg-sirri'),90.19,{at:'Sirri',label:'Sirri',scale:.75});
label('traslado-1985','1985 · Kharg → Sirri',A('kharg-sirri'),88.7);
label('compradores','Menor exposición de compradores',A('compradores'),90.19);
// 4 — Reactores y terminales. Stark: dos Exocet, sin fijar el avión discutido.
year('ano-1984','1984',90.19,98);
label('intensifica','La campaña se intensifica',A('intensificacion-1984'),102.4);
item('reactor-iraqui','air.jet',A('reactores-misiles'),111,{variant:'attack',flag:'IQ',scale:3,label:'Avión iraquí',path:path([[49.3,29.55],[50.1,29.05],[50.9,28.75]],A('reactores-misiles'),9),heading:'auto',sfx:[{sfx:'jet-pass',dur:3.2,gain_db:-27}]});
item('estela-reactor','trail.contrail',A('reactores-misiles'),111,{follow:'reactor-iraqui',width:3,life:1.8,particles:18});
label('antecedentes','Hubo ataques antes de 1984',A('antecedentes'),106,{screen:[.5,.74],size:31});
item('kharg-danado','site.port',104.87,115.37,{at:'Kharg',label:'Kharg · terminal',scale:1.2,states:[state('terminales-bajo-ataque','hit')]});
item('kharg-humo','fx.smoke',A('terminales-bajo-ataque'),114,{at:'Kharg',size:55,particles:20});
label('kharg-danos','Terminales bajo ataque',A('terminales-bajo-ataque'),114.2);
label('kharg-reparaciones','Daños y reparaciones',A('kharg-reparaciones'),116.5,{screen:[.5,.73]});
item('stark','naval.warship',115.37,133.81,{at:'Stark',variant:'frigate',flag:'US',scale:2,label:'USS Stark',heading:335,states:[state('stark-exocet','hit',.65)],source_facts:['G18','G19']});
label('stark-fecha','17 MAY 1987 · USS STARK',115.37,133.81);
label('stark-nombre','Fragata estadounidense',A('stark-fecha'),123.4,{screen:[.5,.73]});
for(let n=0;n<2;n++)item('stark-exocet-'+n,'strike.missile',A('stark-exocet',n*.38),126.2,{from:[51.32+n*.06,27.36],to:'Stark',flightDur:.65,fade:0,width:3,onHit:{fx:'fx.impact',variant:'water',size:45},sfx:[{sfx:'explosion-far',at:A('stark-exocet',n*.38+.65),dur:1.4,gain_db:-30}],note:'Lanzamiento aéreo fuera de campo; modelo del avión no fijado.'});
item('stark-documento','editorial.press',126,133.81,{at:'Stark',src:'assets/media/P03-soft.png',name:'Ronald Reagan',role:'Presidente de EE. UU.',date:'Foto: 7 feb 1981 · ataque: 17 may 1987',credit:'Michael Evans · Casa Blanca · PD',docSrc:'assets/media/A01.png',docText:'USS Stark · daños tras el ataque',docCredit:'U.S. Navy · DN-ST-89-01562 · PD',offset:[0,-240],scale:1.05});
label('stark-victimas','37 tripulantes murieron',A('stark-victimas'),132.07,{screen:[.5,.78],size:40});
label('stark-sobrevive','El buque sobrevive',A('stark-sobrevive'),133.81,{screen:[.5,.78]});
// 5 — Dos banderas sobre mercantes; tres helicópteros salen de Jarrett.
const convoyPath=path([[57.2,25.65],[56.8,26.2],[56.4,26.5],[55.95,26.46]],A('primer-convoy'),6.5);
for(const [n,id,name] of [[0,'bridgeton-julio','Bridgeton'],[1,'gas-prince','Gas Prince']]){
 const pp=structuredClone(convoyPath);if(n)pp.via=[[57.5,25.33],[57.08,26.12],[56.65,26.55],[56.15,26.55]];
 item(id,'naval.cargo',133.81,152.3,{variant:'tanker',flag:'KW',label:'',scale:.75,at:pp.via[0],path:pp,heading:'auto',name});
 item(id+'-flag-kw','flag.marker',133.81,A('reabanderamiento'),{at:id,flag:'KW',flagWidth:58,poleHeight:75});
 item(id+'-flag-us','flag.marker',A('reabanderamiento'),152.3,{at:id,flag:'US',flagWidth:58,poleHeight:75});
}
label('reabanderamiento','21 JUL 1987 · BANDERA ESTADOUNIDENSE',A('reabanderamiento'),144.5,{size:32});
label('dos-mercantes','Bridgeton y Gas Prince · rumbo a Kuwait',A('dos-mercantes'),152.3,{screen:[.5,.70],size:31});
label('salida-convoy','22 JUL 1987 · PRIMER CONVOY',A('primer-convoy'),148.69);
item('convoy-julio','naval.group',A('primer-convoy'),152.3,{leader:'bridgeton-julio',units:escortUnits.map(u=>({...u,label:''})),formation:'line',spacing:.55,path:convoyPath,scale:.62,heading:'auto'});
item('ormuz-ruta','route.sea',133.81,152.3,{via:convoyPath.via,width:2});
label('ormuz-esquema','Ormuz · formación y ruta esquemáticas',133.81,152.3,{screen:[.5,.79],size:26});
label('riesgo-mina','24 JUL · la mina revela el riesgo',A('mina-retorno'),152.3);
item('iran-ajr','naval.cargo',152.3,169.97,{at:'IranAjr',variant:'bulk',flag:'IR',label:'Iran Ajr · posaminas',scale:1.05,heading:330,states:[state('helicopteros','hit',.6)]});
item('jarrett','naval.warship',152.3,164.5,{at:[50.75,26.55],variant:'frigate',flag:'US',label:'USS Jarrett',scale:1.4,heading:20});
label('iran-ajr-fecha','21 SEP 1987 · IRAN AJR',152.3,164.5);
label('siembra-minas','Siembra de minas · posición aproximada',A('iran-ajr'),161.7,{screen:[.5,.75],size:30});
for(let n=0;n<3;n++)item('heli-'+n,'air.helicopter',154+n*.3,164.5,{at:'jarrett',variant:'utility',scale:2,flag:'US',label:'',path:path([[50.75,26.55],[50.9+n*.1,26.75+n*.08],[51.12+n*.12,26.68+n*.07]],154+n*.3,6),heading:'auto',sfx:n?false:[{sfx:'helicopter',dur:5.8,gain_db:-29}],note:'Silueta utility de biblioteca; roles y cantidad documentados G26.'});
for(let n=0;n<2;n++)item('cohetes-ajr-'+n,'strike.salvo',A('helicopteros',n*.18),164.5,{from:[51.02+n*.12,26.76+n*.07],to:'IranAjr',count:2,stagger:.16,flightDur:.55,spread:.015,fade:0,onHit:{fx:'fx.impact',size:36},note:'Cohetes esquemáticos; no misiles antibuque.'});
item('ajr-foto','callout.photo',164.5,169.97,{at:'IranAjr',src:'assets/media/A05.png',caption:'Minas en la cubierta del Iran Ajr',date:'22 sep 1987 · después del abordaje',credit:'PH3 H. Cleveland · U.S. Navy · PD',offset:[0,-340],scale:1.15});
label('nueve-minas','Nueve minas halladas a bordo',A('abordaje-nueve-minas'),169.97,{screen:[.5,.78],size:34});
// 6 — Pico 185–194; plataforma, grupo aeronaval, catapultas; daño sin celebración.
item('roberts','naval.warship',169.97,179.61,{at:'Roberts',variant:'frigate',flag:'US',scale:2,label:'USS Samuel B. Roberts',heading:320,states:[state('roberts-fecha','hit')]});
label('roberts-fecha','14 ABR 1988 · SAMUEL B. ROBERTS',169.97,179.61,{size:33});
impact('mina-roberts','Roberts',A('roberts-fecha'),85);
label('roberts-danos','Daños graves por una mina',A('roberts-dano'),179.61,{screen:[.5,.74]});
label('mantis','18 ABR 1988 · MANTIS RELIGIOSA',A('mantis',-2.8),188.75,{size:34});
for(const [id,at,from] of [['sassan','Sassan',[52.82,25.67]],['sirri','PlataformaSirri',[54.15,25.55]]]){
 item(id,'site.platform',179.61,188.75,{at,label:id==='sassan'?'Sassan':'Sirri',scale:1.12,states:[state('plataformas','hit'),state('plataformas','burning',.7)]});
 item(id+'-grupo','naval.group',179.61,188.75,{at:from,leader:{type:'naval.warship',variant:'destroyer',flag:'US'},units:['naval.warship:ff'],formation:'line',scale:.8,heading:65});
 item(id+'-tiro','strike.shell',A('plataformas',-.55),187.9,{from,to:at,flightDur:.55,fade:0,onHit:{fx:'fx.impact',size:65},sfx:[{sfx:'explosion-far',at:A('plataformas'),dur:1.8,gain_db:-27}]});
}
label('plataformas-aprox','Sassan y Sirri · ubicaciones aproximadas',A('plataformas'),188.75,{screen:[.5,.76],size:28});
item('enterprise','naval.carrier',188.75,198.25,{at:[60.1,23.65],variant:'supercarrier',flag:'US',label:'USS Enterprise · CVN-65',heading:'auto',scale:1.55,path:path([[60.1,23.65],[60.03,23.73],[59.91,23.79]],188.75,8),deck:{aircraft:12},spacing:.65,escorts:{formation:'diamond',units:['naval.warship:cg','naval.warship:ddg','naval.warship:ff']},states:[state('enterprise-despegue','flightops')],sfx:[{sfx:'naval-engine-low',dur:7,gain_db:-30}],note:'G31; al este de Ormuz. Derrota, escoltas y 12 figuras en cubierta son composición simbólica, no inventario histórico.'});
label('enterprise-este','AL ESTE DE ORMUZ · MAR ARÁBIGO',A('enterprise-ubicacion',-2.5),198.25,{size:33});
item('salida-intruder','air.launch',A('enterprise-despegue'),198.25,{at:'enterprise',carrier:'enterprise',unit:'air.jet:a6',to:[59.2,24.4],count:2,interval:.7,deckDur:.65,flightDur:2.8,scale:1.25,fade:0,sfx:[{sfx:'jet-pass',at:A('enterprise-despegue'),dur:2.9,gain_db:-26}],note:'G32. A-6 de biblioteca; dos salidas ilustrativas, no recuento total de misión. Acción agregada, no vista en ref5.'});
label('intruder','A-6E Intruder · aviones de ataque',A('enterprise-despegue'),198.25,{screen:[.5,.77],size:32});
for(const [id,place,variant,scale] of [['sahand','Sahand','frigate',1.6],['joshan','Joshan','frigate',.85]]){
 item(id,'naval.warship',198.1,202.9,{at:place,variant,scale,flag:'IR',label:id==='sahand'?'Sahand · fragata':'Joshan · lancha misilera',heading:310,states:[{at:199.45,state:'hit',dur:.2},{at:199.7,state:'burning',dur:.3},state('sahand-joshan','sunk',0,1.5)],note:id==='joshan'?'G33. Silueta reducida de biblioteca: no hay Kaman/Combattante II específica.':'G34. Secuencia de estados comprimida, no duración histórica.'});
 item(id+'-ataque','strike.missile',199.05,201.2,{from:id==='sahand'?[56.6,26.3]:[54.1,25.65],to:place,flightDur:.4,fade:0,onHit:{fx:'fx.impact',size:50}});
}
label('hundimientos','Sahand y Joshan se hunden',A('sahand-joshan'),203,{screen:[.5,.18],size:36});
item('sabalan','naval.warship',202.2,207.9,{at:'Sabalan',variant:'frigate',flag:'IR',scale:1.7,label:'Sabalan',heading:290,states:[state('sabalan','hit')],wake:false,note:'G35. Detenida y dañada; nunca sunk.'});
item('bomba-sabalan','air.drop',A('sabalan',-1),205.4,{at:'Sabalan',to:'Sabalan',count:1,fallDur:1,height:100,fade:0,note:'G35. Bomba guiada esquemática; caída visual agregada.'});
label('sabalan-estado','Sabalan · inmovilizada y remolcada',A('sabalan'),207.9,{screen:[.5,.2],size:34});
item('al-faw-avance','army.advance',207.9,215.67,{at:[48.28,30.17],flag:'IQ',count:12,columns:4,radius:23,spacing:53,scale:.7,label:'',path:path([[48.28,30.17],[48.47,29.98]],A('irak-recupera'),4.5),heading:'auto'});

label('tierra-1988','ABR 1988 · OFENSIVA EN TIERRA',A('irak-recupera'),215.67,{size:33});
label('al-faw','Al-Faw · campaña distinta de Mantis',A('al-faw'),215.67,{screen:[.5,.72],size:34});
label('al-faw-aprox','Frente y movimientos aproximados',207.9,215.67,{screen:[.5,.78],size:27});
// 7 — Documento retrospectivo, vuelo civil y alto el fuego.
item('resolucion-598','editorial.press',A('resolucion'),225.87,{at:[52.8,27],src:'assets/media/A09.png',name:'Consejo de Seguridad de la ONU',role:'Resolución 598 (1987)',date:'20 jul 1987 · retrospectiva',credit:'Naciones Unidas · documento oficial · PD',docSrc:'assets/media/A09.png',docText:'Resolución 598 (1987)',docCredit:'ONU · S/RES/598(1987)',offset:[0,0],scale:1.2,tilt:-4});
label('resolucion-anterior','Una resolución del año anterior',215.67,222.61,{size:34});
label('resolucion-fecha','20 JUL 1987 · ADOPCIÓN',A('resolucion-fecha'),225.87);
item('ruta-civil','arrow.route',225.87,236.63,{via:[[56.35,27.2],[56.2,26.6],[55.4,25.3]],width:1.4,color:'text',reveal:0, note:'Ruta civil esquemática, sin representar el punto exacto del derribo. G38.'});
label('vuelo-civil','3 JUL 1988 · IRAN AIR 655',225.87,236.63,{size:36});
label('derribo-civil','Vincennes derriba el vuelo civil',A('iran-air-655'),233.5,{screen:[.5,.39],size:36});
label('victimas-civiles','290 personas murieron',A('iran-air-victimas'),236.63,{screen:[.5,.52],size:45});
label('aceptacion','JUL 1988 · IRÁN ACEPTA LA RESOLUCIÓN',A('aceptacion'),241.6,{size:33});
label('alto-fuego','20 AGO 1988 · ALTO EL FUEGO',A('alto-el-fuego'),254.84,{size:36});
item('frente-final','front.line',236.63,254.84,{via:front1982,width:3,color:'danger',reveal:.2,note:'G37/G41. Esquema regional de posiciones pendientes, separado de las fronteras de referencia.'});
label('frente-final-aprox','Frente aproximado · frontera de referencia',236.63,247.8,{screen:[.5,.77],size:27});
label('retirada-posterior','La retirada completa todavía llevará tiempo',A('retirada-posterior'),254.84,{screen:[.5,.75],size:32});
item('bridgeton-final','callout.photo',A('callback-bridgeton'),254.84,{at:[51.6,28.1],src:'assets/media/A02.png',caption:'Bridgeton · el mercante sobrevivió',date:'Foto: 22 ago 1987 · Earnest Will',credit:'PH3 H. Cleveland · U.S. Navy · PD',offset:[0,0],scale:.9,beam:false});
item('cierre','outro.channel',254.84,262.84,{channel:'NODEHISTORY',handle:'youtube.com/@nodehistory',fade:0,out:262.84,dim:.20});
const camera=[
 {t:0,center:hookPath.via[0],zoom:8.3,bearing:-22,pitch:0},
 {t:4.85,follow:'bridgeton',zoom:8.3,dur:17,bearing:-22},
 {t:23.2,zoomThrough:{to:[48.6,32.3],zoom:5.35,spin:22},dur:2.5,ease:'inOut'},
 {t:34.8,zoomThrough:{to:[48.25,30.65],zoom:8.5,spin:8},dur:2.3,ease:'inOut'},
 {t:49.63,center:[48.2,30.65],zoom:8.7,bearing:0,dur:1.8,arc:0},
 {t:59.03,center:[48,30.65],zoom:8.6,bearing:-8,dur:2,arc:0},
 {t:66.05,zoomThrough:{to:'Kharg',zoom:7.4,spin:8},dur:2.2,ease:'inOut'},
 {t:75.29,center:[53.7,27],zoom:6.2,dur:2.4,bearing:-45,ease:'inOut',arc:0},
 {t:90.19,zoomThrough:{to:[50.25,28.95],zoom:7.5,spin:45},dur:2.6,ease:'inOut'},
 {t:104.87,center:[50.32,29.20],zoom:8,bearing:0,dur:2,arc:0},
 {t:115.37,zoomThrough:{to:'Stark',zoom:8.4,spin:-15},dur:2.1,ease:'inOut'},
 {t:133.81,zoomThrough:{to:[57.2,25.6],zoom:8.1,spin:15},dur:2.5,ease:'inOut'},
 {t:145.13,follow:'bridgeton-julio',zoom:8.1,dur:6.5,bearing:0},
 {t:152.3,zoomThrough:{to:[51.05,26.65],zoom:8.3,spin:-12},dur:2.5,ease:'inOut'},
 {t:169.97,center:places.Roberts,zoom:8.3,bearing:0,dur:2.2,arc:0},
 {t:179.61,reframe:['Sassan','PlataformaSirri'],pad:.7,dur:2.8,bearing:0,ease:'inOut'},
 {t:188.4,zoomThrough:{to:[60.04,23.73],zoom:8.3,spin:-22},dur:2.3,ease:'inOut'},
 {t:191.59,follow:'enterprise',zoom:8.3,dur:6.3,bearing:-22},
 {t:197.9,reframe:['Sahand','Joshan'],pad:.5,dur:1.1,bearing:0,ease:'inOut'},
 {t:202.1,zoomThrough:{to:'Sabalan',zoom:8.6,spin:0},dur:1.5,ease:'inOut'},
 {t:207.9,zoomThrough:{to:[48.42,30.1],zoom:8.4,spin:12},dur:2.3,ease:'inOut'},
 {t:215.67,center:[52.8,27],zoom:5.8,bearing:0,dur:2,arc:0},
 {t:225.87,center:[56.2,26.4],zoom:7.4,bearing:0,dur:2.2,arc:0},
 {t:236.63,center:[49,31.5],zoom:5.55,bearing:0,dur:2.8,arc:0},
];
item('bridgeton-us','flag.marker',5.5,25.23,{at:'bridgeton',flag:'US',flagWidth:62,poleHeight:88});
label('helicopteros-observa','1 MH-6 · observación',159.25,164.5,{screen:[.5,.24],size:32});
label('helicopteros-atacan','2 AH-6 · ataque',A('helicopteros'),164.5,{screen:[.5,.30],size:32});
for(const id of ['bridgeton','salida-intruder'])delete items.find(i=>i.id===id).sfx;
const cues=[{sfx:'whoosh',at:23.2,dur:1.2,gain_db:-34},{sfx:'industrial-hum',at:A('kharg-exporta'),dur:19,gain_db:-37},{sfx:'whoosh',at:188.4,dur:1.7,gain_db:-32}];
const scene={format:'atlas-v1',title:'La guerra de los petroleros',duration:262.84,end:262.84,width:1080,height:1920,fps:30,lang:'es',lyricsUrl:'lyrics.json',intro:false,outro:false,captions:{"enabled":true,"maxWords":3,"size":45,"reductionPercent":35.6,"y":0.9,"yLandscape":0.915,"yOffsetLandscape":10,"font":"AtlasDisplay, sans-serif","color":"#ffffff","stroke":true,"strokeColor":"#000000","background":""},planoLook:'tactico',tiles:{provider:'gibs-bluemarble',manifest:'work/escena/cache-inventory.json'},motionBlur:{samples:4,fps:30,shutter:.5,thresholdPx:2,mode:'affine'},defs:{fonts:{label:'AtlasDisplay, sans-serif',display:'AtlasDisplay, sans-serif'},palette:{background:'#081e2c',paper:'#e9e3ba',accent:'#f6edb4',danger:'#d1495b',success:'#399e58',cyan:'#66c6e3',text:'#e9e3ba',dark:'#081e2c'}},places,camera,layers:[],items,sound:{mix:'assets/mix.mp3',cues},blocks:measured.blocks,editorial:{sources:'work/research/HECHOS.md',anchors:'work/voz/anclas.json',positions:'Ciudades y hechos según HECHOS; rutas, formaciones y frentes esquemáticos. Sahand/Sabalan desplazados dentro del sector para no situarlos sobre Qeshm en Natural Earth.',omissions:'No submarinos, torpedos, tsunami, inventarios nacionales ni plataformas ajenas a Mantis: ESTRUCTURA excluye incorporarlos por completar el catálogo.'}};
write('assets/scene.json',scene);
write('assets/config.json',{activeId:'default',configs:[{id:'default',sceneUrl:'assets/scene.json',lyricsUrl:'assets/lyrics.json',audio:{src:'assets/mix.mp3'}}]});
write('work/escena/anclas-resueltas.json',{lyrics:'assets/lyrics.json',anchors:Object.values(anchors).map(a=>({id:a.id,ref:a.ref,start:a.start,end:a.end,phrase:a.script_phrase,source_facts:a.source_facts})),blocks:measured.blocks});
console.log(JSON.stringify({items:items.length,types:new Set(items.map(x=>x.type)).size,anchors:Object.keys(anchors).length,duration:scene.duration}));
