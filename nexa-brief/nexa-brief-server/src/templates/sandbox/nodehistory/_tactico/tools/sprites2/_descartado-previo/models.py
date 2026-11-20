"""Modelado original procedural. +Y = proa; +X = estribor; sin texto ni insignias."""

import math
import random

import bpy
from mathutils import Vector

M = {}


def material(name, gray, metal=.25, rough=.6, texture=True):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (gray, gray, gray, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (gray, gray, gray, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    if texture:
        coord = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 65
        noise.inputs["Detail"].default_value = 3
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = .1
        ramp.color_ramp.elements[0].color = (gray*.74,)*3+(1,)
        ramp.color_ramp.elements[1].position = .9
        ramp.color_ramp.elements[1].color = (min(1, gray*1.16),)*3+(1,)
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .18
        bump.inputs["Distance"].default_value = .035
        links.new(coord.outputs["Generated"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def materials():
    for name, g, metallic, rough in [
        ("hull", .15, .55, .47), ("edge", .08, .45, .6),
        ("deck", .23, .3, .74), ("flight", .11, .1, .85),
        ("steel", .38, .48, .48), ("light", .54, .25, .58),
        ("white", .72, .05, .7), ("dark", .035, .2, .6),
        ("glass", .018, .65, .19), ("seam", .07, .25, .7),
        ("rubber", .022, .02, .9), ("panel", .28, .32, .65),
    ]:
        M[name] = material(name, g, metallic, rough)
    for i, g in enumerate([.18, .27, .34, .44, .51]):
        M[f"cargo{i}"] = material(f"container-gray-{i}", g, .35, .7)


def assign(obj, mat):
    obj.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    return obj


def bevel(obj, amount=.15, segments=2):
    mod = obj.modifiers.new("Cantos físicos", "BEVEL")
    mod.width = amount
    mod.segments = segments
    mod = obj.modifiers.new("Normales", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    return obj


def box(name, loc, size, mat="steel", edge=.12, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler.z = angle
    assign(o, mat)
    if edge:
        bevel(o, edge)
    return o


def polygon(name, points, z, height, mat="steel", edge=.08):
    if sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))<0:
        points=list(reversed(points))
    n = len(points)
    verts = [(x,y,z) for x,y in points] + [(x,y,z+height) for x,y in points]
    faces = [tuple(range(n-1,-1,-1)), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    if edge:
        bevel(o, edge)
    return o


def rod(name, a, b, r=.1, mat="steel", vertices=10):
    a, b = Vector(a), Vector(b)
    d = b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=d.length, location=(a+b)/2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    assign(o, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def ellipsoid(name, loc, size, mat="steel"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def line(name, points, z, r=.07, mat="white"):
    c = bpy.data.curves.new(name, "CURVE")
    c.dimensions = "3D"
    c.bevel_depth = r
    c.bevel_resolution = 1
    s = c.splines.new("POLY")
    s.points.add(len(points)-1)
    for p, (x,y) in zip(s.points, points):
        p.co = (x,y,z,1)
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    return o


def ring(name, x, y, z, r, width=.1, mat="white"):
    return line(name, [(x+math.cos(i*math.tau/64)*r, y+math.sin(i*math.tau/64)*r) for i in range(65)], z, width, mat)


def loft(name, stations, mat="hull", sides=24):
    # Secciones elípticas longitudinales, para casco/fuselaje sin caras triangulares visibles.
    verts=[]
    for y, w, h, z in stations:
        verts.extend((w*math.cos(i*math.tau/sides), y, z+h*math.sin(i*math.tau/sides)) for i in range(sides))
    faces=[]
    for j in range(len(stations)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,a+sides,b+sides,b))
    faces += [tuple(range(sides)), tuple(range(len(stations)*sides-1,(len(stations)-1)*sides-1,-1))]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); assign(o,mat)
    for p in mesh.polygons: p.use_smooth=True
    return o


def ship_hull(width=14):
    w=width/2
    outline=[(-w*.83,-49),(-w,-40),(-w,19),(-w*.8,33),(-w*.42,44),(0,50),
             (w*.42,44),(w*.8,33),(w,19),(w,-40),(w*.83,-49)]
    polygon("Obra muerta",outline,-1.3,3.4,"hull",.32)
    polygon("Canto oscuro",[(x*.99,y*.99) for x,y in outline],2.03,.4,"edge",.14)
    polygon("Cubierta",[(x*.95,y*.986) for x,y in outline],2.36,.18,"deck",.1)
    line("Regala",[(x*.96,y*.988) for x,y in outline]+[(outline[0][0]*.96,outline[0][1]*.988)],2.8,.09,"light")
    for x in [-w*.65,w*.65]:
        for y in [-44,-37,31,36]:
            box("Bita",(x,y,2.9),(.42,.8,.52),"dark",.08)
    # Cabrestantes y anclas de proa.
    for x in [-1.3,1.3]:
        rod("Cabrestante",(x,38,2.6),(x,38,3.2),.46,"steel")
        line("Cadena",[(x,38),(x*1.7,42),(x*1.9,44)],2.7,.12,"dark")
    return 2.6


def rail(x1,y1,x2,y2,z=3.2):
    rod("Pasamanos",(x1,y1,z),(x2,y2,z),.065,"light",6)
    n=max(2,int(math.hypot(x2-x1,y2-y1)/2.8))
    for i in range(n+1):
        u=i/n; x=x1+(x2-x1)*u; y=y1+(y2-y1)*u
        rod("Puntal",(x,y,z-.7),(x,y,z),.045,"steel",6)


def turret(x,y,z=2.6,size=1):
    rod("Barbeta",(x,y,z),(x,y,z+.65*size),1.3*size,"seam",24)
    pts=[(-1.25,-1.1),(-1.45,.6),(-.7,1.45),(.7,1.45),(1.45,.6),(1.25,-1.1)]
    polygon("Torre artillería",[(x+a*size,y+b*size) for a,b in pts],z+.5*size,1.35*size,"light",.16*size)
    rod("Cañón",(x,y+.7*size,z+1.35*size),(x,y+5.4*size,z+1.45*size),.18*size,"steel",12)
    rod("Boca oscura",(x,y+5.1*size,z+1.45*size),(x,y+5.5*size,z+1.45*size),.205*size,"dark",12)


def cells(x,y,nx,ny,z=2.8):
    box("Plataforma VLS",(x,y,z),(nx*.69+.5,ny*.83+.5,.22),"seam")
    for i in range(nx):
        for j in range(ny):
            box("Tapa VLS",(x+(i-(nx-1)/2)*.69,y+(j-(ny-1)/2)*.83,z+.18),(.54,.68,.16),"panel",.035)


def mast(x,y,z=8,large=False):
    rod("Mástil",(x,y,z),(x,y,z+7),.18,"light")
    for dz,r in [(1.5,1.8),(3.2,2.6),(5.4,1.5)]:
        rod("Cruceta",(x-r,y,z+dz),(x+r,y,z+dz),.12,"steel")
    box("Radar matriz",(x,y,z+6),(4.5 if large else 3,.6,1.6),"dark",.07,angle=.18)
    for dx in [-1,1]:
        rod("Antena",(x+dx,y,z+4),(x+dx,y,z+7.6),.055,"light",6)


def bridge(x,y,width=6,length=9,z=2.7,height=4):
    polygon("Puente principal",[(x-width/2,y-length/2),(x-width/2,y+length*.28),
            (x-width*.28,y+length/2),(x+width*.28,y+length/2),(x+width/2,y+length*.28),(x+width/2,y-length/2)],
            z,height,"steel",.22)
    box("Techo puente",(x,y,z+height+.2),(width*.87,length*.83,.42),"light",.13)
    for dx in [-.32,0,.32]:
        box("Ventanal frontal",(x+dx*width,y+length*.30,z+height+.45),(width*.21,.8,.09),"glass",.04)
    for dy in [-.17,.04,.25]:
        for sign in [-1,1]:
            box("Ventanal lateral",(x+sign*width*.405,y+dy*length,z+height+.45),(.5,length*.13,.08),"glass",.03)
    return z+height+.45


def helipad(x=0,y=-36,w=10,z=2.9):
    box("Plataforma vuelo",(x,y,z-.2),(w,w*1.55,.28),"flight",.05)
    ring("Círculo toma",x,y,z,w*.37,.08,"white")
    line("Eje toma",[(x,y-w*.7),(x,y+w*.7)],z,.07,"white")
    for dx in [-.42,.42]:
        line("Borde toma",[(x+w*dx,y-w*.7),(x+w*dx,y+w*.7)],z,.06,"light")


def warship(variant):
    w={"destroyer":13,"frigate":11.7,"cruiser":15.8}[variant]
    ship_hull(w)
    turret(0,29, size=1.15 if variant=="cruiser" else 1)
    cells(0,19,6 if variant!="frigate" else 4,7 if variant=="destroyer" else 4)
    if variant=="cruiser":
        box("Castillo",(0,9,4),(11.4,16,3),"steel",.25)
        bridge(0,9,9.2,13,5.6,3.8)
        cells(0,-20,8,6)
        turret(0,-34, size=1.1)
    else:
        bridge(0,7,7.8 if variant=="destroyer" else 6.4,13,2.6,4.3)
        box("Hangar",(0,-19,4.5),(9 if variant=="destroyer" else 8,13,3.7),"steel",.26)
        box("Techo hangar",(0,-19,6.5),(9.3 if variant=="destroyer" else 8.2,13.1,.3),"light",.07)
        helipad(w=w*.82)
    mast(0,5,8.2,variant!="frigate")
    for yy in [-5,-11]:
        box("Chimenea",(0,yy,6),(4.1,3,5.5),"steel",.3)
        box("Escape",(0,yy,9),(3.1,2.1,.25),"dark",.15)
        for dx in [-.8,.8]: box("Ducto",(dx,yy,9.2),(.8,1.8,.3),"rubber",.1)
    for x in [-w*.42,w*.42]:
        ellipsoid("Lancha",(x,-7,3.1),(.75,3.1,.7),"light")
        for yy in [-17,-13]: box("Equipo lateral",(x,yy,3.1),(1,1.8,.85),"panel")
    if variant=="frigate":
        for x in [-2,2]:
            for y in [-11,-14]: box("Lanzador inclinado",(x,y,6),(1.4,2.2,1.2),"light",.09,angle=-.25 if x<0 else .25)
    if variant=="destroyer":
        # Paneles inclinados de radar y dos balsas en cada banda.
        for x in [-3.2,3.2]:
            box("Radar multifunción",(x,9.5,7.1),(1.5,2.1,.3),"panel",.04,angle=.5 if x>0 else -.5)
            for yy in [-24,-21]: ellipsoid("Balsa cápsula",(x,yy,7),(.5,1,.5),"white")
    if variant=="cruiser":
        mast(0,-9,9,True)
        for x in [-4,4]:
            for yy in [0,3]: box("Contenedor misil",(x,yy,7),(1.5,3.8,1.3),"light",.1,angle=x*.05)
    for x in [-w*.47,w*.47]: rail(x,-27,x,18)


def tiny_jet(x,y,z,scale=1,angle=0):
    before=set(bpy.context.scene.objects)
    ellipsoid("Avión en cubierta",(0,.1,0),(.38,2.7,.28),"light")
    polygon("Alas plegadas",[(-.3,.6),(-1.65,-1.05),(-1.6,-1.5),(-.25,-.9),(.25,-.9),(1.6,-1.5),(1.65,-1.05),(.3,.6)],-.05,.16,"steel",.04)
    polygon("Cola avión",[(-.2,-1.7),(-1,-2.3),(1,-2.3),(.2,-1.7)],.02,.1,"light",.02)
    ellipsoid("Carlinga avión",(0,.7,.28),(.23,.65,.12),"glass")
    for dx in [-.18,.18]: box("Deriva avión",(dx,-2,.4),(.07,.8,.65),"steel",.02)
    c,s=math.cos(angle),math.sin(angle)
    for o in set(bpy.context.scene.objects)-before:
        a,b,zz=o.location
        o.location=(x+scale*(c*a-s*b),y+scale*(s*a+c*b),z+scale*zz)
        o.rotation_euler.z+=angle; o.scale*=scale


def carrier(variant):
    if variant=="stovl":
        ship_hull(20)
        pts=[(-10,-49),(-11,-39),(-11,34),(-8,49),(6,49),(10,35),(10,-43),(6,-49)]
    else:
        ship_hull(20)
        pts=[(-10,-49),(-14,-39),(-15,-15),(-11,8),(-10,37),(-6,50),
             (6,50),(10,40),(10,23),(14,16),(14,-29),(11,-43),(9,-49)]
    polygon("Voladizo cubierta",pts,3,1.2,"edge",.22)
    polygon("Cubierta de vuelo",[(x*.99,y*.998) for x,y in pts],4.2,.16,"flight",.10)
    line("Límite cubierta",pts+[pts[0]],4.4,.11,"light")
    if variant=="stovl":
        # La rampa tiene curvatura real y líneas que la hacen legible desde cenital.
        for i in range(18):
            yy=30+i*1.03; zz=4.35+((i+1)/18)**2*3.7
            box("Rampa esquí",(-2,yy,zz),(12.7,1.14,.3),"flight",.025)
            for xx in [-7.7,3.7]: box("Borde rampa",(xx,yy,zz+.2),(.16,1.1,.1),"white",.01)
        line("Eje despegue",[(-2,-43),(-2,29)],4.46,.11,"white")
        for yy in range(-42,30,8):
            box("Centro discontinuo",(-2,yy,4.5),(.2,3.4,.04),"white",0)
        for yy in [-32,-22,-12,-2,18,29]: tiny_jet(7,yy,4.7,.86,.10)
        bridge(7.1,7,4.2,17,4.4,5.2); mast(7,7,10.1)
    else:
        # Pista angulada: extremo de proa desplazado a babor.
        line("Borde pista babor",[(-5,-46),(-10,22)],4.48,.14,"white")
        line("Borde pista estribor",[(4,-46),(-1,22)],4.48,.14,"white")
        for yy in range(-43,23,7):
            xx=-.5-(yy+46)*5/68
            line("Eje pista",[(xx,yy),(xx-.3,yy+3)],4.5,.10,"white")
        for yy in [-28,-24,-20,-16]:
            xx=-.5-(yy+46)*5/68
            line("Cable de frenado",[(xx-4,yy),(xx+4,yy+.8)],4.57,.08,"steel")
        for xx in [-4,3]:
            line("Catapulta proa",[(xx,19),(xx,45)],4.48,.09,"white")
            line("Carril catapulta",[(xx+.55,19),(xx+.55,45)],4.48,.055,"steel")
        for xx in [-3.7,-2.8,-1.9,-1,.1,1,1.9,2.8]:
            box("Umbral pista",(xx,-44.5,4.5),(.28,2,.04),"white",0)
        # Puntos de amarre y juntas: detalle visible al acercar, sin insignias ni numerales.
        for xx in [-7,-2,3,8]:
            for yy in range(-35,38,6):
                ring("Amarre cubierta",xx,yy,4.46,.115,.035,"panel")
        for yy in [-35,-8,16,35]:
            line("Junta cubierta",[(-8,yy),(8,yy)],4.42,.027,"seam")
        for xx,yy in [(9,-30),(9,-3),(-11,-22)]:
            box("Ascensor",(xx,yy,4.48),(4.7,7,.07),"deck",.06)
            line("Borde ascensor",[(xx-2.2,yy-3.3),(xx+2.2,yy-3.3),(xx+2.2,yy+3.3),(xx-2.2,yy+3.3),(xx-2.2,yy-3.3)],4.55,.055,"light")
        bridge(8.3,7,4.4,16,4.5,5)
        box("Isla superior",(8.4,7,10.4),(3.1,9,1.5),"light",.2)
        mast(8.4,6,11.3,True)
        if variant!="supercarrier-empty":
            spots=[(10.6,y,.10) for y in [-34,-26,-18,-10,20,28,36]]
            spots += [(-8,32,-.12),(-6,41,-.12),(-9,-37,.22),(-4,-40,.22),(1,-39,.22)]
            for x,y,a in spots: tiny_jet(x,y,4.75,.95,a)
    for x,y in [(12,-18),(-12,-27),(-9,18)]:
        box("Defensa cercana",(x,y,5),(1.4,1.6,1.4),"light",.2)
    for y in [-43,-38,-33]:
        for x in [-9,9]: box("Balsa cápsula",(x,y,3.2),(.9,1.8,.7),"white",.3)


def cargo(variant):
    ship_hull({"tanker":22.5,"container":25,"bulk":23}[variant])
    bridge(0,-38,15,12,2.7,7.4)
    box("Caseta superior",(0,-40,11.2),(10,6,1.6),"white",.2)
    box("Chimenea mercante",(3.7,-43,13),(3,3.5,4.7),"steel",.24)
    box("Escape mercante",(3.7,-43,15.5),(2.5,3,.3),"dark",.13)
    mast(-2.8,-39,12)
    if variant=="tanker":
        for x in [-5.8,5.8]:
            for yy in [-23,-10,3,16,29]:
                box("Tanque integrado",(x,yy,3.1),(8.8,11.4,.9),"panel",.3)
                rod("Tapa tanque",(x,yy,3.5),(x,yy,4),1.1,"light",24)
                ring("Junta tanque",x,yy,4.04,1.12,.07,"dark")
        for x in [-1.2,0,1.2]:
            rod("Tubería longitudinal",(x,-29,4.4),(x,35,4.4),.22,"steel",12)
        for yy in [-21,-8,5,18,31]:
            rod("Colector transversal",(-8.5,yy,4.5),(8.5,yy,4.5),.26,"light",12)
            for x in [-6,6]:
                rod("Válvula",(x,yy,4.5),(x,yy,5.1),.22,"steel")
                ring("Volante",x,yy,5.2,.56,.095,"dark")
        for x in [-10.1,10.1]:
            line("Pasarela",[(x,-28),(x,35)],3.6,.2,"light")
            rail(x,-28,x,35,4.2)
    elif variant=="container":
        rng=random.Random(701)
        for yi,yy in enumerate([-24,-15,-6,3,12,21,30]):
            for xi,xx in enumerate([-8,-4,0,4,8]):
                height=rng.choice([3.5,5,6.5])
                mat=f"cargo{rng.randrange(5)}"
                for k in range(int(height/1.5)):
                    box("Contenedor",(xx,yy,3.4+k*1.5),(3.65,8.3,1.4),mat,.055)
                z=3.4+(int(height/1.5)-1)*1.5+.73
                for dx in [-1.35,-.8,-.25,.3,.85,1.4]:
                    line("Corrugado contenedor",[(xx+dx,yy-3.7),(xx+dx,yy+3.7)],z,.045,"light" if xi%2 else "panel")
                for dx in [-1.6,1.6]:
                    for dy in [-3.8,3.8]: box("Esquinero",(xx+dx,yy+dy,z+.04),(.22,.22,.09),"light",0)
    else:
        for yy in [-23,-9,5,19,32]:
            box("Bodega oscura",(0,yy,3.0),(17.8,11.5,.65),"seam",.1)
            box("Escotilla granel",(0,yy,3.5),(16.9,10.8,.6),"steel",.16)
            for xx in [-5.5,0,5.5]:
                line("Junta escotilla",[(xx,yy-5.2),(xx,yy+5.2)],3.83,.075,"dark")
            for xx in [-7.3,7.3]:
                for dy in [-4.4,4.4]: box("Cierre escotilla",(xx,yy+dy,3.95),(.65,.55,.23),"light",.05)
        for yy in [-16,-2,12,26]:
            rod("Pedestal grúa",(-8.5,yy,2.8),(-8.5,yy,8),.7,"light",16)
            rod("Brazo grúa",(-8.5,yy,8),(6.9,yy+2,5),.35,"steel",8)
            rod("Tirante grúa",(-8.5,yy,9),(6.9,yy+2,5),.09,"dark",6)
            rod("Cable grúa",(6.9,yy+2,5),(6.9,yy+2,3.8),.06,"dark",6)


def submarine():
    loft("Casco presión",[(-50,.15,.15,2),(-48,2,1.9,2),(-42,4.6,3.8,2),(-31,5.5,4.3,2),
         (28,5.5,4.3,2),(39,4.9,3.9,2),(46,3.5,3,2),(50,.1,.1,2)],"hull",48)
    polygon("Cubierta submarino",[(-2.1,-39),(-2.6,25),(-1.4,40),(1.4,40),(2.6,25),(2.1,-39)],6.1,.18,"deck",.10)
    box("Vela",(0,11,8),(3.5,10.5,5.1),"steel",1.1)
    box("Techo vela",(0,11,10.65),(2.8,8,.4),"panel",.45)
    for x,y in [(-.55,12),(.5,10.4),(0,8.5)]:
        rod("Periscopio",(x,y,10.8),(x,y,14),.13,"light")
        box("Cabeza periscopio",(x,y+.2,14),(.38,.65,.3),"dark",.08)
    for yy in [-28,-23,-18,-13,-8,-3]:
        for x in [-1.15,1.15]:
            box("Escotilla misil",(x,yy,6.36),(1.6,3.6,.13),"panel",.22)
            line("Junta escotilla",[(x-.7,yy-1.6),(x+.7,yy-1.6)],6.46,.04,"light")
    for sign in [-1,1]:
        polygon("Plano proa",[(sign*3.8,23),(sign*10,20),(sign*10,17),(sign*3.8,18)],3,.55,"steel",.12)
        polygon("Plano popa",[(sign*2.8,-38),(sign*10.5,-43),(sign*10,-47),(sign*2,-43)],2.4,.55,"steel",.1)
    box("Timón",(0,-43,5),(.65,9,4),"steel",.14)
    for y in [-35,30]: ring("Escotilla circular",0,y,6.42,1,.08,"light")


def fuselage(length=100,width=6,mat="steel"):
    half=length/2
    return loft("Fuselaje",[(-half,.7,.6,2),(-half*.82,width*.65,width*.55,2),(-half*.55,width,width*.72,2),
         (half*.30,width,width*.8,2),(half*.65,width*.72,width*.65,2),(half*.89,width*.28,width*.28,2),(half,.06,.06,2)],mat,40)


def mirror_wing(points,z=2.7,mat="steel",height=.5):
    for sign in [-1,1]:
        polygon("Ala",[(x*sign,y) for x,y in points],z,height,mat,.15)
        # Junta de flaps dibujada en geometría para que reciba la misma luz.
        if len(points)>=4:
            p=points[2]; q=points[3]
            line("Junta flap",[(p[0]*sign*.92,p[1]+.7),(q[0]*sign,q[1]+.7)],z+height+.03,.085,"seam")


def cockpit(x=0,y=24,z=6,w=2.1,l=6):
    ellipsoid("Carlinga",(x,y,z),(w,l,.65),"glass")
    line("Marco carlinga",[(x,y-l*.8),(x,y+l*.8)],z+.62,.09,"light")


def jet(variant):
    if variant=="jet-attack":
        fuselage(100,7,"steel")
        mirror_wing([(4,16),(39,-1),(38,-12),(5,-8)],3,"panel",.65)
        mirror_wing([(3,-31),(19,-39),(18,-45),(3,-41)],3.4,"steel")
        cockpit(y=24,z=7.8,w=3.5,l=8)
        for x in [-6.3,6.3]:
            ellipsoid("Toma lateral",(x,10,4.3),(2.1,5,1.4),"dark")
            ellipsoid("Motor",(x,-22,3.5),(2.7,21,2),"steel")
            box("Tobera",(x,-42.5,3),(4.2,3.4,2.3),"dark",.6)
        box("Deriva central",(0,-36,6),(.9,16,7.5),"panel",.3)
    else:
        fuselage(100,4.8,"light")
        mirror_wing([(3,12),(37,-20),(35,-27),(7,-16)],3,"steel",.55)
        mirror_wing([(4,-30),(21,-39),(20,-45),(4,-41)],3.4,"panel",.5)
        cockpit(y=27,z=6.2,w=2.7,l=8)
        for x in [-5.2,5.2]:
            loft("Góndola motor",[(-47,1.5,1.4,2.3),(-40,2.5,2,2.3),(-9,2.6,1.9,2.3),(4,2,1.5,2.3)],"steel",24).location.x=x
            box("Toma rectangular",(x,2,4),(3.6,6,1.4),"dark",.3)
            box("Tobera",(x,-46,2.5),(3.1,4,1.8),"dark",.6)
            fin=box("Deriva doble",(x,-30,6.3),(.75,16,8),"panel",.25,angle=-.12 if x<0 else .12)
        for x in [-12,12]:
            rod("Misil alar",(x,-8,2.8),(x,5,2.8),.6,"white",12)
    for y in [-10,-22]: line("Panel fuselaje",[(-3,y),(3,y)],6,.06,"seam")


def bomber(variant):
    if variant=="bomber-wing":
        pts=[(0,24),(-50,-8),(-29,-17),(-20,-11),(-11,-22),(0,-16),(11,-22),(20,-11),(29,-17),(50,-8)]
        polygon("Ala volante",pts,1.5,1.25,"panel",.35)
        ellipsoid("Espina central",(0,4,2.8),(6.3,16,1.8),"steel")
        cockpit(y=13,z=4.4,w=3,l=3.2)
        for x in [-8,8]:
            polygon("Entrada motor",[(x-2,8),(x+2,8),(x+2,2),(x-2,2)],3,.3,"dark",.1)
            box("Salida motor",(x,-10,3),(5,4,.4),"dark",.15)
        for sign in [-1,1]:
            line("Panel ala",[(sign*8,12),(sign*44,-7),(sign*28,-12)],2.85,.09,"seam")
            line("Panel interior",[(sign*12,2),(sign*20,-9)],2.9,.08,"light")
    else:
        fuselage(100,4.2,"light")
        mirror_wing([(3,17),(45,-12),(43,-20),(4,-2)],3.1,"steel",.75)
        mirror_wing([(2,-32),(20,-40),(19,-45),(2,-40)],3,"steel",.5)
        cockpit(y=31,z=5.6,w=2.3,l=5)
        for sign in [-1,1]:
            for x,y in [(18,-3),(32,-12)]:
                ellipsoid("Góndola motor",(sign*x,y,2),(2.5,8,2.4),"light")
                box("Entrada motor",(sign*x,y+6,3.5),(3.5,2,.65),"dark",.35)
                box("Tobera motor",(sign*x,y-6.5,2),(3,2,1.5),"dark",.45)
                line("Pilón motor",[(sign*x,y-2),(sign*x,y+3)],4.5,.23,"steel")
        box("Deriva bombardero",(0,-35,6),(.9,16,8),"steel",.3)
        for y in [-25,-8,12]: line("Costilla fuselaje",[(-2.2,y),(2.2,y)],5.5,.08,"seam")


def helicopter(rotor=False):
    if rotor:
        rod("Buje rotor",(0,0,1),(0,0,3),3,"steel",32)
        for i in range(4):
            a=i*math.pi/2+.18; c,s=math.cos(a),math.sin(a)
            pts=[(-1,3),(-2,46),(.2,49),(2.4,47),(1.5,7)]
            polygon("Pala rotor",[(c*x-s*y,s*x+c*y) for x,y in pts],1.5,.35,"dark",.12)
            pp=[(-2,44),(-2,46),(.2,49),(2.4,47),(2.1,45)]
            polygon("Punta pala",[(c*x-s*y,s*x+c*y) for x,y in pp],1.88,.03,"light",.02)
        return
    ellipsoid("Cabina helicóptero",(0,17,4),(10,20,6),"steel")
    ellipsoid("Morro helicóptero",(0,31,4),(8,12,5.5),"light")
    for sign in [-1,1]:
        polygon("Parabrisas",[(sign*1,30),(sign*7,29),(sign*6,37),(sign*.8,39)],8.6,.22,"glass",.3)
        ellipsoid("Motor helicóptero",(sign*6.7,13,10),(2.7,10,3.1),"panel")
        box("Escape helicóptero",(sign*6.7,4,11),(3.2,3,1.1),"dark",.5)
        rod("Patín",(sign*12,-1,1),(sign*12,32,1),.8,"dark",12)
        for yy in [4,24]: rod("Soporte patín",(sign*7,yy,3),(sign*12,yy,1),.55,"steel")
        line("Puerta",[(sign*8.3,9),(sign*8.8,21)],8.4,.1,"seam")
    loft("Botalón cola",[(-49,.6,.7,3),(-40,1.5,1.8,3),(-10,3.6,3.4,3),(4,5,4,3)],"steel",24)
    mirror_wing([(1,-34),(12,-38),(12,-42),(1,-40)],4,"light",.45)
    box("Deriva cola",(0,-43,6),(.9,13,7),"panel",.3)
    rod("Buje principal",(0,16,10),(0,16,14),1.7,"dark",24)
    # El rotor principal se exporta aparte; este detalle es solo el de cola.
    rod("Rotor cola",(-.5,-45,5),(-7,-45,5),.45,"dark")
    for angle in [0,math.pi/2]:
        rod("Pala cola",(-6,-45-5*math.cos(angle),5-5*math.sin(angle)),(-6,-45+5*math.cos(angle),5+5*math.sin(angle)),.4,"light")


def transport():
    fuselage(74,5.8,"light")
    mirror_wing([(3,12),(50,7),(49,-3),(4,-1)],5,"steel",.75)
    mirror_wing([(2,-24),(20,-29),(20,-35),(2,-32)],3.8,"steel",.65)
    cockpit(y=23,z=6.8,w=3.6,l=4.6)
    box("Deriva transporte",(0,-26,7),(.9,15,10),"panel",.35)
    for sign in [-1,1]:
        for x in [18,34]:
            ellipsoid("Motor turbohélice",(sign*x,8,4),(2.8,10,2.8),"light")
            rod("Eje hélice",(sign*x,16,4),(sign*x,20,4),.55,"dark",12)
            rod("Hélice",(sign*x-6.5,18,4),(sign*x+6.5,18,4),.37,"dark",8)
            for dx in [-6,6]: box("Punta hélice",(sign*x+dx,18,4),(.9,.7,.7),"white",.1)
    for y in [-19,-9,2]: line("Panel transporte",[(-3.3,y),(3.3,y)],7.4,.08,"seam")


def build_legacy(sprite_id, spec):
    materials()
    family,variant=spec["family"],spec["variant"]
    if family=="carrier": carrier(variant)
    elif family=="warship": warship(variant)
    elif family=="cargo": cargo(variant)
    elif family=="submarine": submarine()
    elif variant.startswith("bomber-"): bomber(variant)
    elif variant.startswith("jet-"): jet(variant)
    elif variant.startswith("helicopter-"): helicopter(variant.endswith("rotor"))
    else: transport()

# Extension library: all geometry below is original, using the copied primitives.
def hatch(x,y,z,r=2):
    rod('Escotilla',(x,y,z),(x,y,z+.45),r,'edge',32)
    rod('Tapa escotilla',(x,y,z+.45),(x,y,z+.65),r*.88,'panel',32)
    rod('Asa',(x-.6,y,z+.9),(x+.6,y,z+.9),.18,'light')


def grille(x,y,z,w=10,l=10):
    box('Rejilla oscura',(x,y,z),(w,l,.2),'dark',.1)
    for i in range(max(3,int(l/1.1))):
        yy=y-l/2+.5+i*1.1
        line('Lama',[(x-w*.47,yy),(x+w*.47,yy)],z+.18,.18,'steel')


def tracks(width=35,length=66,y=-8):
    for sign in [-1,1]:
        x=sign*(width/2-3.5)
        box('Cadena continua',(x,y,3),(7,length,5),'rubber',2.2)
        for j in range(int(length/2.15)):
            yy=y-length/2+1.5+j*2.15
            box('Eslabón de oruga',(x,yy,5.4),(7.5,1.6,.8),'edge',.22)
            box('Diente de acero',(x,yy,5.95),(5.2,.55,.35),'steel',.08)
        for yy in [-.36*length,-.18*length,0,.18*length,.36*length]:
            rod('Rueda lateral',(x-sign*3,y+yy,3),(x+sign*3,y+yy,3),2.4,'steel',16)
        box('Guardabarros',(x-sign*2,y,7.2),(4.8,length-2,1.1),'panel',.45)


def tank(rounded=False,light=False,howitzer=False):
    width=35 if not light else 32
    tracks(width,67,-11)
    polygon('Casco blindado',[(-12,-45),(-14,12),(-10,25),(10,25),(14,12),(12,-45)],5,7,'hull',1.1)
    polygon('Glacis',[(-12,11),(-10,25),(10,25),(12,11)],12,.6,'panel',.5)
    grille(0,-31,12.6,18,17)
    for x in [-10,10]:
        box('Caja posterior',(x,-39,13.8),(5,8,3),'steel',.5)
        rod('Escape',(x,-42,9),(x,-47,9),1.1,'dark')
    if howitzer:
        polygon('Torre de obús',[(-11,-19),(-12,3),(-8,14),(8,14),(12,3),(11,-19)],13,11,'steel',1)
        gun_z=19; gun_end=50
    elif rounded:
        ellipsoid('Torreta fundida',(0,-1,15),(12,15,6),'steel')
        gun_z=16; gun_end=50
        for sign in [-1,1]:
            for y in [-11,-7,-3]: box('Blindaje lateral',(sign*10,y,18),(4,3,2),'panel',.4,angle=sign*.15)
    else:
        polygon('Torreta facetada',[(-10,-17),(-13,-8),(-10,7),(-4,14),(4,14),(10,7),(13,-8),(10,-17)],13,7,'steel',.8)
        polygon('Techo torreta',[(-9,-15),(-10,-6),(-7,6),(7,6),(10,-6),(9,-15)],20,.5,'panel',.3)
        gun_z=17; gun_end=50
        for sign in [-1,1]:
            for y in [-12,-7,-2,3]: box('Blindaje reactivo',(sign*10,y,19),(4,3.2,1.2),'light',.3,angle=sign*.23)
    box('Mantelete',(0,11,gun_z),(7,7,5),'panel',1)
    rod('Tubo principal',(0,12,gun_z),(0,gun_end,gun_z),1.0 if light else 1.3,'steel',20)
    rod('Manguito térmico',(0,19,gun_z),(0,34,gun_z),1.6,'panel',20)
    box('Freno de boca',(0,48.5,gun_z),(3.1,3.2,2.8),'edge',.35)
    for yy in [47.8,49.1]: line('Ranura freno',[(-1.55,yy),(1.55,yy)],gun_z+1.45,.18,'dark')
    hatch(-5,-5,22.5 if howitzer else 21,2.7); hatch(5,-7,22.5 if howitzer else 21,2.1)
    rod('Arma de techo',(-5,-3,24),(-5,5,24),.35,'dark')
    rod('Antena',(8,-13,19),(8,-13,29),.14,'dark')
    for sign in [-1,1]:
        line('Cable de remolque',[(sign*10,-42),(sign*12,-28),(sign*12,-18)],13,.23,'light')
        for y in [-18,-10,0,9]: box('Perno',(sign*12,y,13.3),(.65,.65,.45),'light',.05)


def wheels(ylist,width=29):
    for y in ylist:
        for sign in [-1,1]:
            x=sign*(width/2-1.7)
            rod('Neumático',(x-sign*2,y,3),(x+sign*2,y,3),4.4,'rubber',24)
            rod('Llanta',(x,y,3),(x+sign*2.2,y,3),2.4,'steel',20)
            for k in range(5):
                box('Dibujo neumático',(x,y-3.2+k*1.6,6.6),(4.3,.55,.6),'edge',.1)
    box('Bastidor',(0,-3,4),(width-6,81,3),'edge',.6)


def cab(y=28,width=27,white=False):
    mat='white' if white else 'steel'
    box('Cabina',(0,y,10),(width,24,14),mat,2)
    polygon('Parabrisas',[(-width*.42,y+5),(-width*.38,y+10),(width*.38,y+10),(width*.42,y+5)],17.15,.3,'glass',.45)
    line('Marco central',[(0,y+5),(0,y+10)],17.5,.2,mat)
    box('Capó',(0,y+16,8),(width-3,10,8),mat,1.4)
    box('Paragolpes',(0,y+22,4),(width+1,2,3),'edge',.5)
    for sign in [-1,1]:
        box('Espejo',(sign*(width/2+2),y+6,13),(2.5,3,1.2),'dark',.45)
        rod('Soporte espejo',(sign*width/2,y+4,12),(sign*(width/2+2),y+6,13),.2,'steel')
        box('Faro',(sign*width*.35,y+20,9),(3,1,2),'white',.3)
        line('Puerta',[(sign*width*.47,y-7),(sign*width*.47,y+2)],16.6,.15,'seam')
    box('Techo cabina',(0,y-3,17.4),(width-3,13,.9),mat,.8)


def truck(kind):
    wheels([-33,-19,27],29); cab(26)
    box('Plataforma',(0,-16,7),(28,54,3),'hull',.8)
    if kind=='canvas':
        box('Caja carga',(0,-16,11),(28,53,8),'steel',.7)
        loft('Lona tensada',[(-43,12,5,15),(-41,13.5,6,15),(8,13.5,6,15),(10,12,5,15)],'panel',32)
        for yy in [-39,-29,-19,-9,1,8]:
            line('Costura lona',[(-12.8,yy),(12.8,yy)],20.8,.15,'light')
            for sign in [-1,1]: rod('Amarre lona',(sign*13,yy,16),(sign*13,yy,11),.2,'dark')
    elif kind=='fuel':
        loft('Depósito cisterna',[(-43,2,2,16),(-40,11.5,8.5,16),(-36,12,9,16),(3,12,9,16),(8,10,8,16),(10,1,1,16)],'light',40)
        for yy in [-33,-11,5]:
            line('Cincha tanque',[(-10,yy),(10,yy)],24,.45,'steel')
        for yy in [-28,-12,3]: hatch(0,yy,25,2)
        line('Tubería',[(13,-39),(13,4)],16,.5,'dark')
        box('Bomba',(0,-42,13),(13,3,7),'panel',.4)
    else:
        # Four long canisters on a low elevating rack, stowed facing forward.
        box('Plataforma lanzador',(0,-12,13),(26,53,4),'panel',.7)
        for x in [-9,-3,3,9]:
            rod('Tubo lanzamisiles',(x,-40,18),(x,12,18),2.6,'steel',24)
            rod('Tapa frontal',(x,11.5,18),(x,13,18),2.8,'light',24)
            for yy in [-31,-10,7]: box('Abrazadera',(x,yy,20.8),(5.5,1.5,1),'edge',.15)
        for sign in [-1,1]:
            box('Estabilizador',(sign*17,-25,5),(10,4,2),'steel',.4)
            rod('Pata',(sign*21,-25,1),(sign*21,-25,6),1.8,'dark')


def apc():
    wheels([-31,-12,10,29],40)
    polygon('Casco 8x8',[(-15,-45),(-18,-30),(-17,31),(-10,45),(10,45),(17,31),(18,-30),(15,-45)],6,10,'steel',1.3)
    polygon('Glacis APC',[(-16,25),(-10,45),(10,45),(16,25)],16,.6,'panel',.6)
    for x in [-7,7]: box('Periscopio',(x,29,17.2),(8,4,1.6),'glass',.4)
    hatch(-7,18,17,3); hatch(8,-26,17,3.5)
    turret(0,-2,17,2.6)
    grille(0,-33,16.8,16,9)
    for sign in [-1,1]:
        for yy in [-28,-12,4,18]: box('Placa blindaje',(sign*16,yy,17),(4.5,10,2),'panel',.4)
        line('Barra longitudinal',[(sign*12,-37),(sign*12,-17)],18,.35,'light')


def jeep():
    wheels([-29,27],42)
    box('Carrocería utilitaria',(0,-1,8),(35,78,9),'steel',2)
    box('Capó jeep',(0,29,14),(33,27,6),'panel',1.5)
    box('Techo jeep',(0,-5,21),(34,35,2),'steel',1)
    box('Cristal frontal',(0,14,20),(31,5,1),'glass',.5)
    box('Cristal trasero',(0,-25,18),(29,4,1),'glass',.4)
    box('Paragolpes jeep',(0,45,5),(40,3,3),'edge',.5)
    rod('Rueda repuesto',(0,-43,10),(0,-48,10),7,'rubber',28)
    box('Tapa rueda',(0,-46,15),(8,3,4),'panel',.5)
    for x in [-11,11]:
        line('Nervio capó',[(x,20),(x,38)],17.2,.3,'light')
        box('Faro jeep',(x,43,10),(5,2,3),'white',.4)


def ambulance(crescent=False):
    wheels([-26,29],35); cab(25,31,True)
    box('Módulo sanitario',(0,-16,15),(33,57,23),'white',1.5)
    box('Techo sanitario',(0,-16,27),(32,55,1.3),'white',.8)
    for yy in [-35,4]: box('Ventilación',(0,yy,28),(11,5,1),'light',.5)
    box('Barra emergencia',(0,9,28),(25,3,1.5),'glass',.5)
    for x in [-10,10]: box('Luz de emergencia',(x,9,29),(5,3,1),'light',.5)
    for sign in [-1,1]:
        line('Junta puertas',[(sign*14,-42),(sign*14,-4)],27.8,.12,'seam')
    if crescent:
        # A crescent mesh, never a disk with a white patch over it.
        outer=[]; inner=[]; offset=3.3
        ix=(8**2-7**2+offset**2)/(2*offset)
        iy=math.sqrt(8**2-ix**2)
        a0=math.atan2(iy,ix); b0=math.atan2(iy,ix-offset)
        for i in range(49):
            a=a0+(math.tau-2*a0)*i/48
            b=b0+(math.tau-2*b0)*i/48
            outer.append((8*math.cos(a),-17+8*math.sin(a)))
            inner.append((offset+7*math.cos(b),-17+7*math.sin(b)))
        for i in range(48):
            polygon('Segmento media luna',[outer[i],outer[i+1],inner[i+1],inner[i]],27.78,.04,'medical',0)
    else:
        box('Cruz sanitaria vertical',(0,-17,27.8),(5.2,18,.12),'medical',.05)
        box('Cruz sanitaria horizontal',(0,-17,27.81),(18,5.2,.12),'medical',.05)


def howitzer():
    # Spade trails open towards the rear; bore points +Y.
    for sign in [-1,1]:
        rod('Rueda obús',(sign*17,-6,4),(sign*23,-6,4),8,'rubber',32)
        rod('Llanta obús',(sign*21,-6,4),(sign*23.2,-6,4),4.8,'steel',24)
        box('Brazo afuste',(sign*12,-23,4),(4,39,4),'steel',.5,angle=sign*.32)
        box('Reja de anclaje',(sign*18,-43,3),(9,5,3),'edge',.5)
    box('Plataforma cureña',(0,-3,6),(26,21,5),'hull',1)
    polygon('Escudo obús',[(-20,-8),(-18,8),(-5,13),(5,13),(18,8),(20,-8)],9,3,'panel',.65)
    box('Cuna',(0,5,14),(9,19,7),'steel',.6)
    rod('Tubo obús',(0,6,17),(0,49,17),1.5,'steel',24)
    rod('Recuperador',(4,0,17),(4,25,17),1.0,'panel',20)
    box('Freno de boca obús',(0,47,17),(5,6,4),'edge',.6)
    for yy in [45.5,48]: line('Abertura freno',[(-2.4,yy),(2.4,yy)],19.1,.28,'dark')
    hatch(-10,-4,13,2)
    ring('Volante puntería',10,-6,14,3,.45,'dark')


def bulldozer():
    tracks(44,70,-2)
    box('Bloque motor',(0,22,11),(24,31,17),'steel',1.5)
    grille(0,24,20,19,20)
    box('Cabina ingeniero',(0,-10,19),(27,27,25),'panel',1)
    box('Techo ingeniero',(0,-10,32),(31,30,2),'steel',.7)
    for x in [-11,11]: box('Cristal lateral',(x,-10,30),(3,20,1),'glass',.35)
    box('Cristal delantero',(0,3,29),(24,4,1),'glass',.3)
    for sign in [-1,1]:
        rod('Brazo pala',(sign*16,-10,6),(sign*22,41,5),1.7,'steel',16)
        rod('Pistón pala',(sign*11,24,15),(sign*22,41,9),.9,'light',16)
    polygon('Hoja topadora',[(-31,37),(-34,44),(-25,49),(25,49),(34,44),(31,37)],3,14,'light',1)
    line('Cuchilla',[(-31,47),(31,47)],4,.6,'edge')
    for x in [-10,10]: rod('Soporte ripper',(x,-29,8),(x,-44,6),1.2,'steel')
    box('Ripper',(0,-44,6),(32,5,5),'edge',.5)
    for x in [-12,0,12]: box('Diente ripper',(x,-47,3),(3,7,5),'steel',.4)


def new_ship(kind):
    if kind=='amphibious':
        ship_hull(20)
        outline=[(-10,-47),(-10,29),(-7,43),(0,48),(7,43),(10,29),(10,-47)]
        polygon('Cubierta anfibia',outline,3,1,'flight',.4)
        line('Borde cubierta',outline+[outline[0]],4.1,.15,'light')
        for yy in [-32,-12,8,29]:
            ring('Zona de toma',-2,yy,4.2,5.5,.14,'light')
            # Deck marks are geometric, no text or national emblems.
            for x in [-3.5,-.5]: line('Marca toma',[(x,yy-2),(x,yy+2)],4.25,.13,'white')
            line('Barra toma',[(-3.5,yy),(-.5,yy)],4.25,.13,'white')
        box('Isla anfibia',(6,9,7),(5.5,30,6),'steel',.5)
        box('Puente anfibio',(6,20,10.5),(6,8,2),'light',.4)
        grille(6,9,10.3,3.5,7)
        for yy in [1,10]: box('Chimenea',(6,yy,12),(3.5,4,3),'panel',.35)
        mast(6,13,11,True)
        for x in [-7,7]: box('Defensa de cubierta',(x,-37,4.3),(2,4,1.3),'steel',.3)
    elif kind=='patrol':
        ship_hull(23)
        box('Cabina patrullera',(0,-2,7),(15,35,8),'steel',1.5)
        polygon('Techo patrullera',[(-7,-18),(-7,7),(-4,15),(4,15),(7,7),(7,-18)],11,1,'light',.5)
        box('Cristales puente',(0,12,10),(13,3,2),'glass',.35)
        turret(0,30,2.8,1.6)
        mast(0,-7,12)
        for x in [-6,6]: ellipsoid('Balsa salvavidas',(x,-26,4),(2.2,4,1.5),'white')
        box('Bote auxiliar',(0,-35,4),(10,14,2),'edge',1.6)
        rail(-9,-25,-9,12); rail(9,-25,9,12)
    elif kind=='tug':
        ship_hull(42)
        for sign in [-1,1]:
            for yy in [-40,-25,-10,6,22]:
                ellipsoid('Defensa caucho',(sign*20,yy,2.8),(2.5,5,2.8),'rubber')
        box('Alojamiento remolcador',(0,10,6),(28,38,7),'steel',1.6)
        box('Puente remolcador',(0,14,11),(23,19,6),'light',1.2)
        box('Ventanal puente',(0,23,13),(21,3,2),'glass',.4)
        box('Techo puente',(0,14,14.3),(25,20,1),'white',.7)
        for x in [-12,12]: box('Chimenea remolcador',(x,-7,11),(4,7,8),'panel',.5)
        rod('Tambor remolque',(-9,-23,6),(9,-23,6),4.5,'edge',32)
        for x in [-8,8]: rod('Placa tambor',(x-.5,-23,6),(x+.5,-23,6),5,'light',24)
        line('Cable remolque',[(0,-23),(0,-42)],5,.5,'steel')
        mast(0,8,15)
    else:
        # Reuse the detailed tanker and add long cargo manifold/pipes.
        cargo('tanker')
        for x in [-2.4,2.4]:
            line('Conducto VLCC',[(x,-23),(x,37)],4.6,.23,'light')
        for yy in [-14,2,18,31]:
            for x in [-6,6]: hatch(x,yy,3.6,.65)
        for x in [-8.5,8.5]:
            rail(x,-25,x,35,4.2)


def platform():
    box('Cubierta plataforma',(0,0,7),(72,66,9),'hull',1)
    box('Piso plataforma',(0,0,12),(71,65,1),'deck',.5)
    for x in [-30,30]:
        for yy in [-27,27]:
            rod('Pata plataforma',(x,yy,-7),(x,yy,13),3,'steel',20)
    box('Módulo alojamiento',(-17,-13,17),(26,25,10),'light',.7)
    box('Techo alojamiento',(-17,-13,22.5),(27,26,1),'white',.4)
    for yy in [-20,-14,-8]: grille(-17,yy,23,20,3)
    # Offshore drill derrick with nested frames, visibly three-dimensional from above.
    for z,size in [(13,22),(23,17),(33,12),(44,6)]:
        pts=[(-size/2+12,-size/2+8),(size/2+12,-size/2+8),(size/2+12,size/2+8),(-size/2+12,size/2+8)]
        line('Aro torre',pts+[pts[0]],z,.55,'light')
    for sx in [-1,1]:
        for sy in [-1,1]:
            rod('Montante torre',(12+sx*11,8+sy*11,13),(12+sx*3,8+sy*3,44),.8,'steel')
            rod('Diagonal torre',(12+sx*11,8+sy*11,13),(12-sx*6,8+sy*6,33),.4,'light')
    for yy in [-20,-9,2]:
        box('Equipo de proceso',(16,yy,15),(19,6,5),'panel',.6)
        line('Conducto proceso',[(3,yy),(28,yy)],18,.6,'light')
    polygon('Helipuerto',[(-37,17),(-37,43),(-11,43),(-11,17)],13,1,'panel',.4)
    ring('Círculo helipuerto',-24,30,14.2,10,.25,'white')
    for x in [-27,-21]: line('Barras helipuerto',[(x,26),(x,34)],14.3,.3,'white')
    line('Barra helipuerto',[(-27,30),(-21,30)],14.3,.3,'white')
    rod('Grúa pedestal',(29,24,13),(29,24,26),2,'steel',20)
    rod('Grúa brazo',(29,24,26),(43,39,22),1.2,'light')
    rod('Tirante grúa',(29,24,30),(43,39,22),.35,'dark')
    rod('Conducto antorcha',(-29,-26,14),(-41,-43,20),.7,'light')
    rail(-34,-30,34,-30,14); rail(34,-30,34,30,14)


def engine_pod(x,y,z=1.8,size=1):
    ellipsoid('Motor a reacción',(x,y,z),(2.4*size,8*size,2.5*size),'steel')
    box('Entrada motor',(x,y+6.5*size,z+1.5*size),(3.7*size,2*size,.8*size),'dark',.35*size)
    box('Salida motor',(x,y-7*size,z),(3.4*size,2*size,2*size),'edge',.4*size)
    line('Pilón motor',[(x,y-3*size),(x,y+3*size)],z+2.6*size,.3*size,'panel')


def new_air(kind):
    if kind in ['heavy','transport']:
        span=125 if kind=='heavy' else 96
        fuselage(100,4.7 if kind=='heavy' else 7,'light')
        if kind=='heavy':
            wing=[(3,15),(span/2,-9),(span/2-1,-16),(5,-1)]
        else: wing=[(5,12),(span/2,-11),(span/2-2,-21),(5,-7)]
        mirror_wing(wing,4,'panel',.8)
        mirror_wing([(2,-31),(23,-40),(22,-46),(2,-40)],4,'steel',.6)
        cockpit(y=32,z=7 if kind=='transport' else 6,w=3,l=4)
        for sign in [-1,1]:
            for x,y in [(18,1),(36,-7)]: engine_pod(sign*x,y,1.5,1.1)
        box('Deriva central',(0,-36,8),(.9,17,10),'steel',.3)
        for y in [-24,-13,0,14]: line('Panel fuselaje',[(-3.7,y),(3.7,y)],7.6,.075,'seam')
        for sign in [-1,1]:
            line('Larguero alar',[(sign*8,9),(sign*(span/2-3),-12)],5,.12,'light')
        if kind=='transport':
            for yy in [-25,-18,-11,-4,3,10,17]:
                for sign in [-1,1]: box('Ventanilla',(sign*5.8,yy,7.3),(.6,1.1,.15),'glass',.1)
    elif kind=='tactical':
        fuselage(100,6,'steel')
        mirror_wing([(4,14),(46,-18),(43,-26),(5,-4)],3.8,'panel',.8)
        mirror_wing([(3,-30),(22,-43),(21,-48),(3,-40)],4,'steel',.6)
        cockpit(y=28,z=7,w=3.2,l=7)
        for x in [-6,6]:
            loft('Motor integrado',[(-48,2.6,2.4,3),(-40,3.6,3.2,3),(-4,3.2,2.8,3),(9,2,2,3)],'light',32).location.x=x
            box('Toma superior',(x,7,6),(4.5,8,2),'dark',.5)
            box('Tobera táctica',(x,-47,3),(4.2,3,2.8),'dark',.5)
        box('Deriva táctica',(0,-34,9),(1.2,19,11),'panel',.4)
    elif kind=='fighter':
        fuselage(100,5,'light')
        mirror_wing([(3,13),(33,-19),(31,-28),(5,-8)],3.4,'steel',.6)
        mirror_wing([(2,-31),(19,-43),(18,-48),(2,-42)],3.7,'panel',.5)
        cockpit(y=27,z=6.7,w=2.8,l=9)
        for x in [-5.5,5.5]:
            box('Entrada de aire',(x,6,4),(4,9,2),'dark',.6)
            line('Panel motor',[(x,-8),(x,-33)],5,.12,'seam')
        rod('Tobera única',(0,-42,2),(0,-50,2),3.4,'edge',28)
        box('Deriva cazabombardero',(0,-34,9),(1,17,10),'steel',.35)
    elif kind=='uav':
        fuselage(55,3.6,'light')
        mirror_wing([(2,7),(50,-2),(49,-7),(2,0)],4.5,'panel',.4)
        cockpit(y=15,z=5.7,w=1.5,l=2)
        for sign in [-1,1]:
            polygon('Cola en V',[(sign*2,-15),(sign*13,-22),(sign*12,-27),(sign*2,-23)],5,.5,'steel',.2)
        ellipsoid('Sensor EO',(0,22,4),(2.3,2.3,2.1),'dark')
        ellipsoid('Motor UAV',(0,-18,5),(2.6,7,2.5),'steel')
        rod('Hélice propulsora',(-7,-26,5),(7,-26,5),.4,'dark',10)
        for sign in [-1,1]: line('Panel UAV',[(sign*5,3),(sign*45,-4)],5,.08,'seam')
    else:
        # Static tandem rotors, with attachment metadata for future independent animation.
        loft('Fuselaje transporte lourd',[(-34,1,2,5),(-29,8,7,5),(-15,10,8,5),(18,10,8,5),(31,7,6,5),(36,1,1,5)],'steel',40)
        for sign in [-1,1]:
            ellipsoid('Motor helicóptero lourd',(sign*9,-15,10),(2.5,11,3),'panel')
            box('Escape lourd',(sign*9,-25,10),(3,4,2),'dark',.5)
            polygon('Cristal lourd',[(sign*1,24),(sign*7,23),(sign*5,31),(sign*.8,33)],10.8,.3,'glass',.3)
            for yy in [-15,-5,5,15]: box('Hublot',(sign*9,yy,11),(1.3,2.5,.4),'glass',.25)
            rod('Tren de aterrizaje',(sign*9,-16,1),(sign*13,-16,1),1.7,'rubber')
        for yy,phase in [(21,.15),(-23,.15+math.pi/3)]:
            rod('Mástil tandem',(0,yy,12),(0,yy,18),1,'edge',24)
            rod('Buje tandem',(0,yy,18),(0,yy,19),2.2,'steel',24)
            for i in range(3):
                a=phase+i*math.tau/3; c,s=math.cos(a),math.sin(a)
                pts=[(-.8,2),(-1.3,28),(.6,30),(1.4,28),(.9,4)]
                polygon('Pala tandem',[(c*x-s*y,yy+s*x+c*y) for x,y in pts],18.5,.35,'dark',.1)
                pp=[(-1.2,26),(-1.3,28),(.6,30),(1.4,28),(1.2,26)]
                polygon('Punta pala tandem',[(c*x-s*y,yy+s*x+c*y) for x,y in pp],18.88,.04,'light',.02)
        for yy in [-10,8]: line('Panel lourd',[(-5,yy),(5,yy)],13.2,.1,'seam')


def build(sprite_id,spec):
    materials()
    if sprite_id.startswith('tank-'):
        is_light=sprite_id.endswith('light')
        tank(rounded=sprite_id.endswith('rounded') or is_light,light=is_light)
        if is_light:
            for o in bpy.context.scene.objects:
                if o.type not in {'MESH','CURVE'}: continue
                o.location.x*=.8; o.scale.x*=.8
                if o.name.startswith(('Torreta','Tapa escotilla','Escotilla','Arma de techo','Mantelete')):
                    o.scale.x*=.82; o.scale.y*=.82
    elif sprite_id=='artillery-self-propelled': tank(howitzer=True)
    elif sprite_id=='artillery-towed': howitzer()
    elif sprite_id=='apc': apc()
    elif sprite_id.startswith('truck-'): truck('fuel' if sprite_id.endswith('fuel') else 'canvas')
    elif sprite_id=='missile-launcher': truck('launcher')
    elif sprite_id=='jeep': jeep()
    elif sprite_id.startswith('ambulance-'):
        mat=material('Rojo sanitario',.5,.03,.7,False)
        mat.diffuse_color=(.65,.008,.012,1)
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.65,.008,.012,1)
        M['medical']=mat
        ambulance(sprite_id.endswith('crescent'))
    elif sprite_id=='bulldozer-engineer': bulldozer()
    elif sprite_id=='ship-platform': platform()
    elif sprite_id.startswith('ship-'): new_ship(spec['variant'])
    else:
        kind={'air-bomber-heavy':'heavy','air-bomber-tactical':'tactical','air-transport-jet':'transport',
              'air-fighter-swept':'fighter','air-uav':'uav','air-helicopter-heavy':'helicopter'}[sprite_id]
        new_air(kind)
    # Frame every model from its evaluated geometry; prevent wing/antenna clipping.
    bpy.context.view_layer.update()
    points=[o.matrix_world @ Vector(c) for o in bpy.context.scene.objects if o.type in {'MESH','CURVE'} for c in o.bound_box]
    extent=max(max(abs(p.x),abs(p.y)) for p in points)
    bpy.context.scene.camera.data.ortho_scale=extent*2*1.14
