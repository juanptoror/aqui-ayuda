# Ayudas Colombia

Directorio de centros de acopio y ayuda humanitaria. Web app en Vite + React +
TypeScript sobre **cinco backends**:

| Fuente | Backend | Qué aporta | Dónde se ve |
|---|---|---|---|
| **Ayudas Pereira** | Supabase `yjkyzfuixdpuhgthoeua` | Centros de acopio, qué necesitan y su inventario | `/ciudades`, `/ciudad/:slug`, `/centro/:id`, `/que-falta` |
| **Corag** | `ayuda.corag.app` | Ayuda directa entre personas, con WhatsApp | `/ayuda-directa` |
| **Pereira Unida** | Supabase `ivnrelkbqqfebyullfeb` | Vecinos que piden y que ofrecen, con teléfono; arriendos de Risaralda | `/ayuda-directa`, `/vivienda` |
| **Encuéntralo a un Clic** | Supabase `jdxptkifjcewckbslpno` | Inmuebles en arriendo con foto, sobre todo del Quindío | `/vivienda` |
| **Pereira Responde** | `pereiraresponde.co` | Edificios afectados, vías cerradas y servicios abiertos | `/danos`, `/mapa` |

Viven en pantallas separadas a propósito: a un centro se le lleva una donación,
a una persona se le escribe, y de un edificio a punto de caerse hay que
apartarse.

**Cada dato lleva su sello de procedencia** ([Fuente.tsx](src/components/Fuente.tsx)):
amarillo para Ayudas Pereira, lima para Corag, naranja para Pereira Unida,
grafito para Pereira Responde. No es decoración — si un teléfono no responde o
una dirección está mal, hay que poder saber quién lo publicó y a quién reclamar.
Y las reglas difieren: los centros los publica un equipo local, las peticiones
de Corag las publica cualquiera sin registro. Un test falla si una tarjeta
aparece sin sello o con el de la fuente equivocada.

**En producción:** https://ayudas-colombia-web.vercel.app

Diseñada bajo un supuesto: **quien la usa acaba de pasar por un terremoto**. Se
entra, se dice dónde se está, y se ve qué centro está abierto, qué está pidiendo
y cómo llegar. Sin registro obligatorio.

```bash
npm install
npm run dev            # http://localhost:5180
```

---

## 1. Diagnóstico

### El hallazgo que condiciona toda la app

**`public.centros` tiene los permisos concedidos POR COLUMNA, no sobre la tabla.**

Consecuencia práctica, verificada contra la API:

```
GET /centros?select=*                       -> 401  42501 permission denied
GET /centros?select=id,nombre,direccion,…   -> 200  18 filas
GET /centros?select=id,telefono             -> 401  42501 permission denied
```

El rol público puede leer `id, ciudad_id, nombre, direccion, responsable, notas,
activo, created_at, lat, lng, foto, abierto`. **`telefono` está reservada a
sesiones iniciadas.**

Esto es una trampa fácil de pisar: `select('*')` no falla "un poco", **tumba la
consulta entera y la pantalla se queda sin ningún centro**. Por eso
[queries.ts](src/data/queries.ts) pide siempre columnas explícitas y añade
`telefono` solo cuando hay sesión, y hay un test dedicado que falla si alguien
lo revierte ([datos-y-acceso.spec.ts](e2e/datos-y-acceso.spec.ts)).

### Estado real de las fuentes

| Tabla | Sin sesión | Notas |
|---|---|---|
| `ciudades` | 78 filas | 4 inactivas o fusionadas |
| `centros` | legible por columnas | `telefono` requiere sesión |
| `necesidades` | ~310 filas | prioridad: urgente / alta / normal |
| `inventario` | ~310 filas | |
| `voluntarios`, `transportes`, `ofrecimientos`, `vehiculos` | legibles | no los usa esta versión |

Autenticación (`/auth/v1/settings`): **solo correo**. `anonymous_users: false`,
`mailer_autoconfirm: false`. De ahí que el acceso sea por código de un solo uso.

### Problemas de datos detectados

- `ciudad-prueba-no-usar` (`activa=false`) es una ciudad de pruebas en producción.
- `pereira` y `pareira` están fusionadas en `pereira-2`; `diaquebradas` en
  `dosquebradas`. La app **redirige** en lugar de mostrar una pantalla vacía
  ([Ciudad.tsx](src/pages/Ciudad.tsx), rama `redirigirA`).
- Ruido de captura: `Arg`, `Altagracias`, `Vereda aurora` y `Vereda aurora valle`
  como municipios distintos; algún centro llamado `Xxxx`. Se muestran tal cual:
  limpiarlo es trabajo de moderación, no de frontend.
- Nombres y direcciones llegan con espacios sobrantes del formulario; se
  normalizan en [useDatos.ts](src/data/useDatos.ts), no en cada vista.
- `ciudades` no guarda coordenadas, así que el orden por cercanía **entre
  municipios** usa el catálogo local de [geo.ts](src/lib/geo.ts). Los centros sí
  traen `lat`/`lng` reales. Las veredas sin ubicación fiable se muestran **sin
  distancia** en vez de inventarles una posición.

### Qué se corrigió respecto a la versión anterior

Comparado con la app en producción, revisada renderizada:

| Problema | Corrección |
|---|---|
| Emojis como iconografía (❤️ 🙌 🚗 🏠 🚨 🚚 🎁 📊) | Iconos SVG de trazo uniforme (lucide). Cero emojis. |
| "¿Cómo quieres ayudar?" **antes** de los datos | El resumen va primero; la decisión es un control aparte |
| Resumen en un bloque negro macizo | Cuatro KPIs sobre superficie clara, con etiqueta y contexto |
| Peso visual: bordes negros de 2px por todas partes | Bordes hairline de 1px + sombra compuesta |
| Fuente `system-ui` (la del sistema) | Archivo + Public Sans, autoalojadas |
| Sin ordenar por cercanía | Haversine sobre `lat`/`lng` reales, abiertos primero |
| No se distinguía un centro cerrado | Estado `abierto` en la tarjeta, atenuado y al final de la lista |

---

## 2. Dirección de diseño: "Puesto de Mando"

Un tablero de operaciones de emergencia, no una app de consumo. Definida en
[tokens.css](src/styles/tokens.css).

- **Identidad heredada, peso quitado.** La versión anterior era negro, rojo
  coral y verde. Se conserva esa paleta —grafito para la acción, coral para lo
  urgente, verde para lo que está en marcha— pero el negro pasa de bloques
  macizos y bordes de 2px a texto y botones sobre superficies claras.
- **El color semántico nunca decora.** El color de acción es grafito y no un
  azul de marca precisamente para que nada compita con el rojo: en una
  emergencia el rojo solo puede significar una cosa.
- **Profundidad real.** Borde hairline de 1px **y** sombra de dos o tres capas
  (`--shadow-1/2/3`). Nada plano.
- **Tipografía con intención.** *Archivo* para títulos y cifras; *Public Sans*
  —la tipografía del sistema de diseño del gobierno de EE. UU., hecha para
  servicios públicos— para el cuerpo. **Autoalojadas**: con red inestable, un
  CDN de fuentes es un punto de fallo.
- **Cifras tabulares**, para que los números no bailen al actualizarse.
- **Hover, `cursor: pointer` y anillo de foco** en todo lo interactivo.
- **Tema claro y oscuro completos**, aplicados antes del primer pintado por un
  script en [index.html](index.html) para evitar el destello de tema incorrecto.

---

## 3. Reglas anti "celular estirado"

| Regla | Dónde |
|---|---|
| Contenedor centrado con ancho máximo (1240px), nunca full-bleed | `.container` en [ui.css](src/styles/ui.css) |
| Escritorio con barra lateral, móvil con navegación inferior | [shell.css](src/styles/shell.css), corte en 1024px |
| Cabecera de página grande: antetítulo + título + subtítulo + acciones | `.page-header` |
| Grilla multi-columna con tarjetas de altura uniforme por fila | `.grid--cards` + `.card { height: 100% }` |
| Estados vacíos diseñados con tarjeta y CTA | `EmptyState` en [ui.tsx](src/components/ui.tsx) |
| La estructura (KPIs, secciones) visible durante la carga | `Kpi cargando` + `SkeletonTarjeta` |
| Diálogo centrado en escritorio, hoja inferior en móvil | `.overlay` / `.sheet`, mismo componente |
| Textos largos con truncado o elipsis, sin desbordar | `.truncate`, `.clamp-2`, `min-width: 0` |

`html` y `body` **no** llevan `overflow-x: hidden`. Esconder el desborde haría
pasar los tests por la razón equivocada; los desbordes se arreglan en su origen.

---

## 4. Estructura de la pantalla de municipio

La versión anterior mezclaba "cómo ayudar" con los datos. Ahora hay tres bloques
separados:

1. **Cabecera** — municipio, departamento y una línea de contexto: cuántos
   centros están abiertos de cuántos, pedidos urgentes y hace cuánto se actualizó.
2. **Resumen** — cuatro KPIs. Se dibujan siempre, con datos o sin ellos: un
   hueco sin explicar es peor que un cero explícito.
3. **La decisión** — control segmentado grande y aislado: *Quiero ayudar* /
   *Necesito ayuda*. Cambia todo lo que viene debajo: qué falta vs. qué hay.

Orden de los centros: **abiertos primero** (ir a uno cerrado es un viaje
perdido), luego por cercanía real, y a igualdad por número de pedidos urgentes.

---

### "Me falta agua, ¿quién tiene agua?"

La ficha de un centro decía qué le falta y ahí se acababa. Ahora cada pedido
abierto lleva el cruce contra las **tres** fuentes que ya estaban cargadas
([useCruces.ts](src/datos/useCruces.ts), `useQuienLoTiene`): el inventario de
los demás centros, la gente que lo ofrece en Corag y los vecinos que lo ofrecen
en Pereira Unida. El botón lleva el número por delante —"Lo tienen 25"— porque
esconder la respuesta detrás de un clic obliga a abrir diez hojas para descubrir
que nueve están vacías.

La distinción que sostiene esa pantalla: **tener no es ofrecer.** Un centro con
dieciocho cajas contadas es una existencia a la que se puede mandar un carro;
una persona que se ofrece es una intención por confirmar. Van en dos bloques
separados y con nombres distintos, porque un coordinador que trate un
ofrecimiento como stock tacha una urgencia que sigue sin cubrir. Y lo que encaja
solo por familia —"Agua" contra "Alimentos no perecederos"— se marca como
*Parecido* en vez de mezclarse en la misma lista.

El cruce inverso —una persona pide algo, ¿hay un centro que lo tenga?— ya
existía en `useCrucesConCentros` y alimenta `/ayuda-directa`.

## 4b. Segundo backend: Corag

`/ayuda-directa` consume `https://ayuda.corag.app/api/public/v1/help`
([corag.ts](src/data/corag.ts)). Tres rasgos de esa API condicionan el código:

- **Sin autenticación.** Publicar es un POST directo.
- **Idempotente por `source` + `externalId`.** Por eso el identificador se
  genera **una vez por formulario** y se reutiliza en los reintentos: si se
  regenerara en cada intento, un fallo de red se convertiría en publicaciones
  duplicadas.
- **`publishContact` exige consentimiento.** El teléfono se publica en abierto,
  así que sale de una casilla que la persona marca a mano. Nunca viene marcada
  y la mutación se niega a enviar sin ella.

Si la API falla, la pantalla **lo dice**: un 500 no se presenta como "no hay
nadie pidiendo ayuda". Esa distinción importa — decir que no hay necesidades
cuando en realidad no se pudo preguntar es desinformar en plena emergencia.

## 4c. Quinta fuente: Pereira Responde (daños estructurales)

`/danos` consume la API pública documentada en
[pereiraresponde.co/api/docs](https://pereiraresponde.co/api/docs)
([backend](src/backends/pereira-responde/)). Es la única fuente que no habla de
ayuda: dice qué edificio está tocado y por qué calle no se pasa. Cuatro cosas
medidas contra la API antes de escribir una línea de interfaz, y las cuatro
condicionan el código:

- **Es de solo lectura.** No hay endpoint público para publicar: el formulario
  de la fuente escribe contra `/api/reports`, que no está en el contrato
  público. Por eso "Reportar un daño" es un enlace a su mapa y no un formulario
  nuestro. Un formulario propio perdería el reporte de alguien que se ha jugado
  acercarse a un edificio inestable.
- **`limit` por defecto es 100 y hoy hay 180 reportes.** No pedirlo recorta la
  ciudad casi a la mitad sin avisar. Se pide siempre el máximo (500), y si
  llegan exactamente 500 la pantalla dice que puede haber más: la API no pagina.
- **`area` no es el barrio.** El esquema lo ejemplifica como `"Barrio Boston"`,
  pero en el formulario de origen es la nota opcional, y 163 de 180 traen el
  relleno `"Ubicación registrada"`. Se descarta en vez de pintarlo como si fuera
  una dirección.
- **Las fotos pesan entre 3 y 7 MB.** Son el JPEG que salió del teléfono, sin
  miniatura ni versión reducida, y 179 de 180 reportes traen al menos una. Una
  rejilla que las cargue sola son cientos de megas sobre la red de una ciudad
  que acaba de temblar: **ninguna se descarga hasta que alguien la pide**, y al
  pedirla se avisa del peso.

Dos más que se ven en el modelo:

- `risk` solo es una gravedad en los reportes de vivienda. En vías y servicios
  repite el tipo (`risk: "road"`), así que ahí se dice `sin-clasificar` en lugar
  de inventar un nivel.
- La fuente **solo cubre Pereira**. Cuando el radio no devuelve nada, la
  pantalla lo dice explícitamente: leer "cero daños" desde Manizales sería
  entender que allí no pasó nada.

Su mapa oficial dibuja además unas "zonas rojas" que la API pública no expone.
Esta pantalla no es un sustituto del suyo y no lo aparenta.

## 5. Acceso

Código de un solo uso al correo ([sesion.tsx](src/state/sesion.tsx)). Se usa el
código de 6 dígitos y no el enlace mágico porque el enlace exige que el origen
esté dado de alta en las *Redirect URLs* del proyecto, y eso rompe en desarrollo
y en cada despliegue nuevo. El código llega en el mismo correo y funciona desde
cualquier origen.

Entrar **solo** añade los teléfonos. Todo lo demás se ve sin sesión, y la app lo
dice explícitamente en vez de mostrar huecos sin explicación.

---

## 6. Verificación

```bash
npm run build                  # tsc -b && vite build, sin errores
npm run test:e2e:install       # una sola vez
npm run test                   # 124 tests
npm run capturas               # 36 PNG: 6 pantallas x 3 anchos x 2 temas
npm run capturas:viewport      # primera pantalla, sin fullPage
npm run capturas:interaccion   # diálogo, hoja, estados vacíos y de carga
npm run diag:overflow -- http://localhost:5180/ 375   # quién desborda y por qué
```

Los tests fallan si:

- el documento tiene scroll horizontal en 1440, 834 o 375px, en cualquier ruta;
- **cualquier** elemento visible sobresale del borde derecho (el mensaje dice
  qué elemento y en qué píxel se sale);
- un nombre largo real (`Altagracia, vereda alegrias y yarumal`) rompe el layout;
- la consulta de centros usa `select=*` o pide `telefono` sin sesión;
- un centro no declara si está abierto o cerrado;
- se rompe un flujo: elegir municipio, `/?ciudad=slug`, redirección de ciudad
  fusionada, cambio de modo, persistencia del tema, o la navegación por
  dispositivo;
- la consulta de daños deja de pedir `limit=500`, o alguna foto de 5 MB se carga
  sin que nadie la haya pedido, o el relleno `"Ubicación registrada"` llega a la
  pantalla, o `/danos` ofrece un formulario de reporte que no tiene dónde
  escribir;
- un punto del mapa deja de tener a dónde ir: las tres formas —cuadrado, círculo
  y círculo rojo— tienen que abrir su detalle, no solo la primera;
- el cruce de un pedido presenta un ofrecimiento como si fuera inventario, o el
  propio centro aparece entre quienes lo tienen.

Contra el build de producción en vez del dev server:

```bash
npm run build
npm run preview
BASE_URL=http://localhost:4180 npx playwright test
```

---

## 7. Estructura

```
src/
  lib/          supabase, geo (haversine + coordenadas), formato
  data/         queries (React Query) y composición por municipio
  state/        sesión, tema, ubicación y municipio recordado
  components/   shell, tarjetas, selector, acceso, piezas del sistema
  backends/     un directorio por fuente + el contrato y el registro
  pages/        Home, Ciudad, Ciudades, Centro, QueFalta, Danos, ComoAyudar, Acerca
  styles/       tokens, base, ui, shell
e2e/            overflow y flujos; datos y acceso; daños
scripts/        capturas y diagnóstico de overflow
```

**`/acerca` muestra el estado de cada fuente de datos en vivo.** Si una tabla
deja de responder, la página dice cuál y por qué, en lugar de dejar la app "rara
sin motivo".
