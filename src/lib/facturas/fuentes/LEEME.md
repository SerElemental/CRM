# Tipografías de las facturas

Son las tipografías de la marca Ser Elemental, las mismas del sitio web:

| Archivo | Tipografía | Uso en el PDF |
|---|---|---|
| `josefin-sans-{300,400,600,700}.ttf` | Josefin Sans | Texto, etiquetas y cifras |
| `rufina-{400,700}.ttf` | Rufina | Nombres del cliente y de la empresa |
| `mrs-saint-delafield-400.ttf` | Mrs Saint Delafield | Rúbrica |

Todas tienen licencia SIL Open Font License 1.1 (archivos `LICENCIA-*.txt`), que permite usarlas, incluirlas y modificarlas.

## Por qué no se usan tal cual vienen

Salen de los paquetes `@fontsource/*` (subconjunto «latin»), pero con una corrección. Un archivo de fuente declara en su tabla `maxp` cuántos puntos tiene, como máximo, cualquiera de sus glifos. En Josefin Sans ese dato venía mal: decía 94 y la **«@» tiene 95**.

La mayoría de los lectores de PDF ignoran ese dato. **Adobe Acrobat no**: al encontrar un glifo que supera el máximo declarado, no lo dibuja. El resultado era que en Acrobat los correos salían sin la arroba (`nombre gmail.com`), mientras que en Chrome o en Vista Previa se veían bien.

Aquí la tabla `maxp` está recalculada a partir de los glifos reales. La prueba `fuentes.test.ts` revisa que ningún glifo de ningún archivo supere lo que su fuente declara.

## Cómo regenerarlas

Con Python y `fontTools`, a partir de los `.woff` de `@fontsource`:

```python
from fontTools.ttLib import TTFont

f = TTFont("josefin-sans-latin-400-normal.woff")
for nombre in f.getGlyphOrder():
    f["glyf"][nombre]        # la tabla se carga glifo a glifo; hay que recorrerla entera
f["maxp"].recalc(f)          # límites reales
f.flavor = None              # TTF sin comprimir
f.save("josefin-sans-400.ttf")
```

Si algún día se cambia de tipografía, hay que pasar los archivos nuevos por este mismo paso y abrir un PDF de prueba **en Adobe Acrobat**, no solo en el navegador.
