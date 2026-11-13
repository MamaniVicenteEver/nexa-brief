#!/usr/bin/env python3
"""Registra los contratos C en la fuente única, sin tocar entradas anteriores."""
import json
from pathlib import Path
N=Path(__file__).resolve().parents[1]
def p(typ,default,description,**kw):return dict(type=typ,default=default,description=description,**kw)
def main():
    path=N/'componentes.json';data=json.loads(path.read_text())
    common={
        't':p('number|string',0,'Entrada absoluta en segundos o ancla de voz @palabra.'),
        'out':p('number|string',None,'Inicio de salida absoluta; omitir conserva la pieza.'),
        'dur':p('number',.5,'Duración de entrada/trazado/viaje en segundos, función de t.'),
        'exit':p('number',.35,'Duración del fundido de salida en segundos.'),
        'scale':p('number',1,'Multiplicador de tamaño de diseño; no altera radios geográficos en km.'),
        'scalePortrait':p('number',1,'Multiplicador adicional en 9:16.'),
        'scaleLandscape':p('number',1,'Multiplicador adicional en 16:9.'),
        'font':p('string',None,'Familia de texto; omitir hereda hudTheme.fonts.ui.'),
        'weight':p('number',700,'Peso del texto; algunas etiquetas secundarias usan 500.'),
        'color':p('string','blue','Nombre de hudTheme.colors o color CSS/hex; el texto de tarjetas es blanco si se omite.'),
    }
    pos={
        'at':p('string|array',None,'Lugar de scene.places o [lon,lat]; sigue la proyección y se oculta detrás del globo.'),
        'x':p('number',None,'Centro horizontal; omitir usa .5 o .17 para timeline vertical, si no hay at.'),
        'y':p('number',None,'Centro vertical; por defecto depende de la pieza y orientación.'),
        'dx':p('number',0,'Desplazamiento horizontal del ancla en unidades de diseño.'),
        'dy':p('number',0,'Desplazamiento vertical del ancla en unidades de diseño.'),
    }
    def add(typ,label,uso,receta,fields,demo,variant=None,target='hud',position=True):
        name='noticiero.'+(variant or typ)
        params={'type':p('string',typ,'Tipo de pieza.'),**json.loads(json.dumps(common)),**(pos if position else {}),**fields}
        params['weight']['default'] = 600 if typ=='quote-card' else 500 if typ in ('geo-label','choropleth') else 700
        params['color']['default'] = 'white' if typ=='geo-label' else None if typ in ('quote-card','timeline','choropleth') else 'blue'
        component=dict(name=name,label=label,summary=uso,family='Mapa y geografía' if typ in ('range-ring','pulse','route-icon','front-line','geo-label','choropleth') else 'Narrativa',target=target,tags=['noticiero','original',typ],params=params,demo={'type':typ,'t':.2,'out':6.5,**demo},uso=uso,receta=receta)
        index=next((i for i,c in enumerate(data['components']) if c['name']==name),None)
        if index is None:data['components'].append(component)
        else:data['components'][index]=component
    add('range-ring','Radio de alcance','Mostrar un radio geográfico en kilómetros desde un lugar.','topic + city + range-ring + counter para alcance o área afectada.',{
        'radiusKm':p('number',1500,'Radio geodésico en km; 0 < radio < 20000.'),
        'rings':p('array',None,'De 1 a 8 radios en km; sustituye radiusKm y dibuja anillos concéntricos.'),
        'label':p('string',None,'Rótulo alternativo solo con un anillo; varios usan cifras es-ES + km.'),
        'size':p('number',26,'Tamaño del rótulo en unidades de diseño.'),
        'width':p('number',2,'Grosor del borde en unidades de diseño.'),
        'fillOpacity':p('number',.08,'Opacidad del relleno de cada anillo; 0–1. Al cruzar el horizonte se dibuja solo el borde visible para evitar cierres falsos.'),
    },dict(at=[-77,38.9],rings=[500,1000,1500],dur=2,color='yellow'))
    add('pulse','Pulso de radar','Marcar una señal, explosión o epicentro con ondas repetidas.','topic + pulse + range-ring + counter para desastre o explosión.',{
        'period':p('number',1.8,'Periodo positivo de repetición en segundos; tres ondas desfasadas, función pura de t.'),
        'r':p('number',110,'Radio máximo en unidades de diseño, no km; se aplana con pitch.'),
        'width':p('number',3,'Grosor de las ondas.'),
    },dict(at=[-77,38.9],color='orange',r=150,period=1.8))
    route={
        'from':p('string|array',None,'Lugar o [lon,lat] de origen.'),
        'to':p('string|array',None,'Lugar o [lon,lat] de destino.'),
        'via':p('array',[],'Hasta 16 lugares/[lon,lat] intermedios; tiempo repartido por longitud geodésica de cada tramo.'),
        'icon':p('string','plane','Nombre de biblioteca. Rumbo calibrado: plane, fighter-jet, ship (proa arriba), warship y tank (derecha). warship/tank se reflejan hacia el oeste para conservar su base abajo. Otros: ajustar iconAngle.'),
        'iconAngle':p('number',None,'Rumbo intrínseco del dibujo en grados desde la derecha; omitir usa calibración. ship es vista frontal, warship lateral facilita lectura del rumbo.'),
        'path':p('string','great-circle','great-circle, straight o curve; misma función de proyección y elevación que arc.'),
        'lift':p('number',100,'Elevación de pantalla del centro de cada tramo, unidades de diseño; 0 sigue el suelo.'),
        'size':p('number',30,'Semitamaño del icono en unidades de diseño.'),
        'width':p('number',3,'Grosor de la estela.'),
        'tail':p('number',.28,'Fracción de longitud total visible de estela; 0–1.'),
        'keep':p('boolean',True,'Conservar icono y estela al llegar hasta out; false los oculta al completar dur.'),
    }
    add('route-icon','Vehículo en ruta','Mostrar un vehículo que recorre un trayecto con rumbo y estela.','topic + city + route-icon; front-line para contexto de conflicto.',route,{'from':[-95,39],'via':[[-82,44]],'to':[-65,39],'icon':'plane','dur':5,'keep':True,'color':'yellow','size':34},position=False)
    for name,label,icon,a,b,color in [('route-icon-barco','Ruta marítima hacia el oeste','warship',[-65,34],[-95,37],'blue'),('route-icon-tanque','Ruta terrestre hacia el este','tank',[-85,34],[-71,39],'green')]:
        add('route-icon',label,'Mostrar un vehículo que recorre un trayecto con rumbo y estela.','city + route-icon parametrizado; comparte geometría y dibujante.',route,{'from':a,'to':b,'icon':icon,'dur':5,'keep':True,'color':color,'size':34},variant=name,position=False)
    add('front-line','Frente o frontera','Dibujar una línea discontinua de frente o frontera en disputa.','topic + highlight + front-line + city; rotular aproximado si la geometría lo es.',{
        'points':p('array',[],'2–256 puntos [lon,lat], interpolados por círculo máximo; dibujo progresivo por distancia.'),
        'label':p('string',None,'Rótulo opcional junto al extremo visible.'),
        'width':p('number',4,'Grosor de línea.'),'dash':p('number',12,'Longitud de guion.'),'gap':p('number',8,'Separación entre guiones.'),'glow':p('number',14,'Radio de resplandor.'),'size':p('number',26,'Tamaño del rótulo.'),
    },dict(points=[[-87,31],[-83,35],[-81,39],[-75,43]],color='red',label='FRENTE · ILUSTRATIVO',dur=3),position=False)
    add('geo-label','Rótulo geográfico','Identificar mares, estrechos o regiones con texto discreto.','topic + geo-label + city; route-icon para explicar un corredor.',{
        'text':p('string','','Nombre geográfico; se dibuja en mayúsculas y cursiva suave.'),'angle':p('number',0,'Ángulo de pantalla en grados.'),'tracking':p('number',5,'Espaciado de letras en unidades de diseño.'),'opacity':p('number',.5,'Opacidad 0–1.'),'size':p('number',30,'Tamaño de letra.'),
    },dict(at=[-65,32],text='ATLÁNTICO NORTE',angle=-18,color='white',size=34,opacity=.65))
    values={k:round(.4+i*.25,2) for i,k in enumerate('US CA MX GT HN NI CR PA CU HT DO JM CO VE EC PE BO BR PY UY AR CL GB FR ES PT DE IT NL BE NO SE FI JP AU'.split())}
    add('choropleth','Mapa de valores','Comparar valores de muchos países o estados con un solo relleno.','topic + choropleth + delta o bar-compare para sanciones, aranceles o impactos.',{
        'values':p('object',{},'Código de país ISO2/estado (US-TX) o scene.regions → valor finito; UNA colección/capa, propiedad value.'),
        'scale':p('array',['blue','yellow','red'],'2–3 colores del tema o hex; aquí scale es la escala de color, no de tamaño.'),
        'domain':p('array',None,'[mínimo,máximo] o tres umbrales crecientes para tres colores. Omitir deriva extremos de values; valores externos se saturan.'),
        'opacity':p('number',.65,'Opacidad del relleno 0–1, animada en t/out sin actualizar fuente.'),
        'unit':p('string','','Unidad de los extremos de la leyenda.'),'width':p('number',900,'Ancho de leyenda; se ajusta entero por encima de subtítulos.'),'size':p('number',28,'Tamaño de los extremos de leyenda.'),
    },dict(values=values,scale=['#2467c9','#ffd21a','#ef445c'],domain=[0,9],unit='%',y=.72),target='layers')
    add('quote-card','Cita atribuida','Mostrar una declaración breve atribuida, con retrato opcional.','topic + quote-card + timeline para cumbre con acuerdo.',{
        'text':p('string','','Cita de hasta 160 caracteres Unicode. Si excede: aviso único y 159 + ….'),'src':p('string',None,'Retrato opcional relativo a assets, precargado en ready; validar archivo y crédito.'),'name':p('string','','Nombre obligatorio de quien habla.'),'role':p('string','','Cargo opcional.'),'width':p('number',900,'Ancho del panel; ajuste íntegro al cuadro y por encima de y=.8.'),'size':p('number',40,'Tamaño de cita; revelado horizontal por dur. Textos excesivamente anchos se ajustan a cinco líneas.'),
    },dict(text='El acuerdo abre una nueva etapa de cooperación entre nuestros países.',name='DECLARACIÓN DE EJEMPLO',role='Cumbre internacional · ilustración',y=.42,color='yellow'))
    add('timeline','Cronología','Ordenar de tres a seis hitos y marcar el actual con anclas de voz.','topic + timeline + quote-card para cumbre; pulse + timeline para emergencia.',{
        'events':p('array',[],'3–6 hitos ordenados por tiempo; se iluminan y se marca el último activo.',fields={
            'date':p('string','','Fecha/hora corta visible.'),'label':p('string','','Descripción breve, hasta dos líneas.'),'icon':p('string',None,'Nombre opcional válido de la biblioteca.'),'t':p('number|string',None,'Ancla de voz absoluta o segundo; omitir usa t de pieza + índice × interval.')}),
        'interval':p('number',1.5,'Intervalo entre hitos sin t explícito.'),'width':p('number',None,'Ancho: 900 horizontal / 260 vertical. Vertical al lado izquierdo, centro y subtítulos libres.'),'size':p('number',28,'Tamaño del texto de hitos.'),
    },dict(events=[dict(date='08:00',label='Alerta',icon='radio',t=.3),dict(date='10:30',label='Reunión',icon='people',t=1.4),dict(date='12:00',label='Acuerdo',icon='handshake',t=2.3),dict(date='14:00',label='Firma',icon='doc',t=4.2)],color='yellow'))
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
