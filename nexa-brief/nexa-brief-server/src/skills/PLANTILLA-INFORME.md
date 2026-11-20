# Plantilla del informe final

Obligatorio para todo contenido. Se guarda como `INFORME.md` en la carpeta del contenido y se resume en el chat. Ver `ORQUESTACION.md §5`. Lo desconocido se escribe «sin dato», nunca 0.

```markdown
# Informe: <título del contenido>

<ID> · <categoría/plantilla o diseño> · <duración> · estado: <listo para grabar | en preparación | bloqueado> · <fecha>
Ver: <URL o ruta en la web>

## Lo que no se cumplió
<al principio y sin maquillar; «nada» si todo se cumplió>

## 1. Consumo de modelos
| Pasada o paso | Modelo | Esfuerzo | Qué hizo | Tiempo | Tokens |
|---|---|---|---|---:|---:|
| … | | | | | |
| **Total** | | | | | |

Dentro del pipeline (servicios de la web):
| Paso | Modelo | Entrada | Caché | Salida | Razonamiento | Total |
|---|---|---:|---:|---:|---:|---:|

Orquestador (el agente del chat): <tokens si se conocen; «sin dato» si no>.
Coste en dinero: <por suscripción / por API con cifra / sin dato>.

## 2. Búsquedas y descargas
| Proveedor | Búsquedas | Descargas | Tiempo |
|---|---:|---:|---:|

## 3. Recursos usados
| ID | Tipo | Qué muestra | Fuente | Autor | Licencia |
|---|---|---|---|---|---|
Descartados (con motivo): <…>

## 4. Datos y fuentes
<cada cifra usada → dos fuentes con fecha del dato; descartados con motivo>

## 5. Puerta de calidad (CALIDAD.md §7)
1. Relleno: <no / dónde>
2. Cifras: <todas verificadas y actuales / excepciones>
3. Medios: <relevantes, reales cuando existían, sin marcas ajenas / excepciones>
4. Texto en pantalla: <correcto en 16:9 y 9:16 / excepciones>
5. Miniaturas: <se entienden / qué cambiar>
6. Créditos y licencias: <completos / faltan>

## 6. Decisiones y siguientes pasos
<qué decidió el orquestador y por qué; qué le toca decidir al humano>

## 7. Archivos
<carpeta, research.json, guion, capturas, hojas de contacto, miniaturas, usage.jsonl, RESULT de cada pasada>
```
