"""Migra assets/scene.json (texto con label.chip libre) a componentes de estilo con ranuras (V4).
Uso: python3 estilo_migrate.py <carpeta del prototipo>. Idempotente: parte de assets/scene.clasico.json (copia del original)."""
import json,os,re,sys,shutil
R=sys.argv[1]
src=R+'/assets/scene.clasico.json'
if not os.path.exists(src): shutil.copy(R+'/assets/scene.json',src)
d=json.load(open(src,encoding='utf-8'))
HEADER={'fecha-bridgeton','invasion','rompe-cerco','recupera-jorramchar','traslado-1985','stark-fecha','reabanderamiento','salida-convoy','riesgo-mina','iran-ajr-fecha','roberts-fecha','mantis','enterprise-este','tierra-1988','resolucion-fecha','vuelo-civil','aceptacion','alto-fuego'}
LEGEND={'frente-aprox','frente-final-aprox','al-faw-aprox','rutas-esquema','ormuz-esquema','plataformas-aprox','siembra-minas'}
NOTA={'intensifica','helicopteros-atacan','instalaciones-distintas'}
JUMP={'retroceso'}
# cada país con su propio punto dentro de su territorio (separados de las fichas de retrato)
LABEL_AT={'iran-nombre':[54.5,33.8],'iraq-nombre':[44.0,33.4]}
out=[];stats={}
PAIR=None
def keep(i,drop=('screen','width','size','offset','color')):
    n={k:v for k,v in i.items() if k not in drop}
    return n
for i in d['items']:
    t=i['type'];n=i.get('id','')
    if t=='label.chip':
        y=(i.get('screen') or [.5,.2])[1];text=i['text']
        if n in HEADER:
            a,_,b=text.partition(' · ');m=keep(i,('screen','width','size','text','color'));m.update(type='header.date',fecha=a,lugar=b);k='header'
        elif n in JUMP:
            m=keep(i,('screen','width','size','color'));m['type']='statement.jump';k='jump'
        elif n in LEGEND:
            m=keep(i,('screen','width','size','color'));m['type']='legend.front';m['muestra']=n.startswith('frente');k='legend'
        elif y>=.34 or n in NOTA:
            m=keep(i,('screen','width','size','color'));m['type']='statement.title';m['slot']='nota';k='nota'
        else:
            m=keep(i,('screen','width','size','color'));m['type']='statement.title';k='titular'
        stats[k]=stats.get(k,0)+1;out.append(m);continue
    if t=='portrait.badge' and n in('sadam','jomeini'):
        side='left' if n=='sadam' else 'right'
        if PAIR is None:
            PAIR={'id':'retratos-1980','type':'portrait.pair','t':i['t'],'dur':i['dur'],'out':i.get('out'),'fade':i.get('fade',.3),'sfx':False};out.append(PAIR)
        PAIR[side]={k:i[k] for k in('src','name','role','date','credit')};stats['retratos']=stats.get('retratos',0)+1;continue
    if t=='text.year':
        m=keep(i,('screen','width','size','color'));m['type']='year.big';out.append(m);stats['year']=stats.get('year',0)+1;continue
    if t=='label.neon':
        m=keep(i,('size','color','screen'));m['type']='label.country';m['at']=LABEL_AT.get(n,i.get('at'));out.append(m);stats['pais']=stats.get('pais',0)+1;continue
    if t=='territory.flag' and i.get('flagMode')=='fill':
        m={k:v for k,v in i.items() if k not in('flag','flagMode','opacity')};m['type']='territory.fill';m['bando']='otro' if i.get('region')=='IR' else 'irak';out.append(m);stats['territorio']=stats.get('territorio',0)+1;continue
    if t in('naval.cargo',) or n in ('stark','roberts','samuel-roberts','vincennes'):
        i=dict(i);i['main']=True;i['labelFlag']=True
    if t=='site.refinery':
        i=dict(i);i['labelSide']='der'
    out.append(i)
# las escoltas pasan de rombo a línea detrás del buque grande con un desplazamiento continuo (antes: dos grupos que se cambiaban de golpe)
g=next((i for i in out if i.get('id')=='escoltas-inicio'),None);e=next((i for i in out if i.get('id')=='escoltas-estela'),None)
if g and e:
    g.update(out=e['out'],dur=25.2,formationTo='line',spacingTo=e['spacing'],formationAt=15.6,formationDur=4.2);out.remove(e)
# control territorial: tiñe cada lado del frente (rojo atacante, verde Irán) y cambia cuando el frente retrocede
fr=next((i for i in out if i.get('id')=='frente'),None)
if fr:
    out.insert(out.index(fr),{'id':'control-territorial','type':'territory.control','t':fr['t'],'dur':fr['dur'],'out':fr.get('out'),'fade':.5,'sfx':False,'region':'IR','via':fr['via'],'states':fr.get('states',[])})
d['items']=out
# transcripción de estilo (izquierda, 3 palabras) en lugar de los subtítulos clásicos
d['captions']={**d.get('captions',{}),'enabled':False}
d['items'].append({'id':'transcripcion','type':'caption.transcript','t':0,'dur':d['duration'],'fade':0,'lyricsUrl':'assets/lyrics.json'})
d['estilo']='v4-atlas'
json.dump(d,open(R+'/assets/scene.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(stats,len(out))
