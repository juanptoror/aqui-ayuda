# Qué usamos de cada backend

Inventario honesto: qué expone cada fuente, qué consume ya AquíAyuda y qué
queda por conectar. Verificado contra la API, no contra la documentación.

## Ayudas Pereira (Supabase)

| Tabla | Leemos | Escribimos | Dónde, o por qué no |
|---|---|---|---|
| `ciudades` | Sí | — | Directorio de municipios |
| `centros` | Sí | — | Listado y ficha. **Permisos por columna**: `telefono` solo con sesión |
| `necesidades` | Sí | — | Qué falta, prioridades, "qué falta" |
| `inventario` | Sí | — | Qué tiene cada centro |
| `ofrecimientos` | **Legible, sin usar** | Sí | Se puede listar quién ofrece qué. Ojo: la fecha es `creado_at`, no `created_at` |
| `voluntarios` | Sí | Sí | Pantalla "Quién puede ayudar". 1.000 filas, 998 disponibles |
| `vehiculos` | Sí | Sí | La misma pantalla. 183 filas, todas disponibles |
| `solicitudes` | No (RLS) | Sí | "Unirme al equipo". Upsert: pulsar dos veces no duplica |
| `transportes` | Sí | Sí | Pantalla de inventario: lista lo que va en ruta y permite programar |
| `transporte_items` | Sí | No | Desglose de cada viaje en la pantalla de inventario |
| `perfiles` | No (RLS) | No | Devuelve 0 filas sin sesión |
| `asignaciones` | No (RLS) | No | Devuelve 0 filas sin sesión |
| `admins_ciudad` | No (RLS) | No | Devuelve 0 filas sin sesión |

### El patrón del teléfono

`telefono` está denegado al rol público en **las cuatro** tablas que lo tienen:
`centros`, `ofrecimientos`, `voluntarios` y `vehiculos`. No es un descuido en
`centros`: es una política coherente. Todo lo demás de esas tablas es legible
**si se piden las columnas una a una** — con `select=*` las cuatro devuelven
42501 y la pantalla se queda vacía.

### Lo que condiciona el código

**`centros` tiene los permisos por columna, no por tabla.** `select('*')`
devuelve `42501` y la pantalla se queda **sin ningún centro**, aunque la lista
explícita de columnas devuelva 200. Las columnas legibles están declaradas en
[esquema.ts](../src/backends/ayudas-pereira/esquema.ts) y hay un test que falla
si alguien vuelve a pedir `*` o añade `telefono` sin sesión.

**Qué exige sesión:** `voluntarios`, `vehiculos`, `solicitudes` y `transportes`
guardan `usuario_id`. `ofrecimientos` no, así que donar funciona sin entrar —y
eso es deliberado: en una emergencia el trámite es el enemigo.

## Corag (API pública)

| Recurso | Leemos | Escribimos | Dónde |
|---|---|---|---|
| `GET /help` | Sí | — | Emergencias activas |
| `GET /help?view=list` | Sí | — | Ayuda directa entre personas |
| `POST /help` | — | Sí | Publicar solicitud u ofrecimiento |
| `GET /help?view=detail&id=` | **Disponible, sin usar** | — | Ficha completa de una publicación |
| `GET /help?view=panorama` | Sí | — | Cifras de la emergencia en la portada |
| `/api/logistics-operations` | Disponible, vacío | — | Devuelve 0 operaciones y `canManage: false` |
| `POST /mcp` | No | — | Servidor MCP, sin conectar |

### El límite que devuelve 400

`limit` acepta hasta **100**. Con 101 responde `400 Revisa los filtros enviados`,
y `type` es **obligatorio**: sin él también es 400. Los dos fallos comparten el
mismo síntoma —una lista vacía que se lee como "no hay nadie pidiendo ayuda"— así
que el recorte está en el cliente, en [`LIMITE_MAX`](../src/backends/corag/ayudas.ts),
y no en cada pantalla.

Lo que devuelve `panorama`, ya en la portada:

```
counts:     229 solicitudes activas · 38 urgentes · 182 ofertas · 50 completadas
quantities: 1345 requerido · 5 comprometido · 0 recibido · 1340 pendiente
```

Cinco unidades comprometidas de 1345 pedidas. Ese número, solo, cuenta la
historia mejor que cualquier texto de portada.

## Lo que falta por unir entre los dos

Lo interesante de tener las dos APIs no es sumar pantallas: es cruzar datos que
por separado no dicen nada.

| Cruce | Qué resolvería | Qué falta para hacerlo |
|---|---|---|
| Petición de Corag ↔ existencia en un centro | "Lo que pides está a 1,2 km, en el centro X" | Tabla de equivalencias entre categorías |
| Ofrecimiento de Corag ↔ necesidad de un centro | 182 ofertas sueltas contra necesidades concretas | La misma tabla de equivalencias |
| Vehículo de Ayudas Pereira ↔ petición de Corag que necesita transporte | El cuello de botella real | Cruzar por zona: `zona` es texto libre y no hay coordenada |
| ~~Mapa único~~ | **Hecho**: [/mapa](../src/pages/Mapa.tsx) pinta las dos fuentes | — |

### Resuelto: taxonomía de dos niveles

[taxonomia.ts](../src/dominio/taxonomia.ts) traduce ambos vocabularios a uno
común con **general → subcategoría**. El cruce se hace por subcategoría cuando
hay equivalencia exacta y por general cuando solo son parientes, y la interfaz
distingue ambos casos ("esto lo tienen cerca" frente a "hay algo parecido").

Dos reglas evitan cruces absurdos:

1. Lo marcado como **servicio** (`transporte`, `voluntariado`, `acopio`) nunca
   se cruza contra inventario: nadie guarda cajas de voluntariado en una bodega.
2. `otros` con `otros` **no** cuenta como parecido: no es un parecido, es que no
   sabemos de qué habla ninguno de los dos.

Dos decisiones que no son obvias y conviene revisar:

- **`salud` de Corag no es `Medicamentos`**: puede ser atención, curaciones o
  traslado sanitario. Tiene subcategoría propia dentro de la general "Salud", de
  modo que cruza a nivel general pero no promete equivalencia exacta.
- **`refugio` va a "Alojamiento", no a "Cobijas"**: quien pide refugio pide
  dónde dormir, no una manta. Comparten la general "Abrigo y descanso".

Resultado medido: **48 de 60 peticiones** de Corag tienen un centro de Ayudas
Pereira que puede cubrirlas, la más cercana a 436 m.

### El vocabulario de partida

Ninguno de esos cruces funciona sin traducir categorías, y las dos listas son
distintas:

- **Ayudas Pereira** (10): Agua · Alimentos no perecederos · Comidas listas para
  comer · Aseo e higiene · Pañales y bebés · Medicamentos · Cobijas y
  colchonetas · Ropa y franelas · Linternas y pilas · Otros
- **Corag** (12 vistas en datos): acopio · agua · alimentos · herramientas ·
  mascotas · medicamentos · otro · refugio · ropa · salud · transporte ·
  voluntariado

Ni siquiera son el mismo tipo de eje: unas son *qué cosa*, otras *qué
necesidad*. `transporte` y `voluntariado` en Corag no son materiales.

Idempotente por `source` + `externalId`: reintentar tras un fallo de red no
duplica. El identificador se genera **una vez por formulario**.

## Añadir un tercer backend

Tres pasos, ninguno toca la interfaz:

1. `src/backends/<nombre>/` con cliente, esquema y mapeadores.
2. Exportar un objeto que cumpla [`Backend`](../src/backends/contrato.ts) y
   declare sus `capacidades`.
3. Añadirlo a [`registro.ts`](../src/backends/registro.ts).

Las pantallas preguntan *"¿quién sabe leer municipios?"* al registro, nunca
importan un backend por su nombre. Un proveedor puede implementar solo parte
del contrato: todos los métodos son opcionales y las capacidades declaran qué
hay.

## Lo que queda, y por qué

| Pendiente | Por qué no está |
|---|---|
| `GET /help?view=detail&id=` | La lista ya trae todo lo que se muestra; la ficha solo añadiría confirmaciones y no hay pantalla que las pida |
| Vehículo ↔ petición que necesita transporte | `vehiculos.zona` es texto libre ("Cuba y alrededores") y no hay coordenada: no se puede cruzar sin inventarse la geografía |
| `ofrecimientos` (lectura) | Se escriben pero no se listan: la lista sin teléfono no permite actuar, y el teléfono exige sesión |
| `perfiles`, `asignaciones`, `admins_ciudad` | RLS: devuelven 0 filas sin sesión. Son de la herramienta de coordinación, no de la vista pública |
| `POST /mcp` de Corag | Servidor MCP para agentes. No aporta nada que la API REST no dé ya |

## Pereira Unida (Supabase)

Tercera fuente. Su REST no expone el OpenAPI con la clave publicable, así que el
esquema se descubrió probando ~700 nombres de tabla. La convención es **inglés
en snake_case**, al revés que Ayudas Pereira.

Después apareció una segunda vía: **publican una API pública documentada** con
tres recursos (`/ayudas`, `/ayudantes`, `/servicios`). No la usamos —exige una
API key por integración y su propio rate limit, y ya estamos conectados por
Supabase sin ninguna de las dos cosas— pero sirve de **mapa del tesoro**: dice
qué hay antes de tener que adivinarlo. Así se encontró `service_outages`, que
seis meses de sondeos por nombre no habían dado.

| Recurso de su API | Tabla | Filas | Leemos | Dónde |
|---|---|---|---|---|
| `GET /ayudas` | `reports` | 378 | Sí | Personas pidiendo ayuda, con coordenada y teléfono |
| `GET /ayudantes` | `help_offers` | 335 | Sí | Vecinos que se ofrecen. **Pantalla "Quién puede ayudar"** |
| `GET /servicios` | `service_outages` | **0** | Sí | Daños de luz, agua, gas e internet. **`/afectaciones` y `/mapa`** |
| — | `rentals` | 82 | Sí | Arriendos de la comunidad. **`/vivienda`** |
| — | `comments` | 86 | Declarado | Comentarios sobre un reporte, por `report_id` |
| — | `collection_points` | 0 | No | Existe pero está vacía |

Sus `POST` tampoco hacen falta: se escribe en `reports` y en `service_outages`
por Supabase, que es la misma fila sin clave de por medio. El `PATCH` de
`/servicios` —cerrar un daño cuando la cuadrilla lo atiende— no se usa: esta
aplicación no es el sistema de despacho de nadie.

**No hay permisos por columna**: `SELECT *` devuelve 200 en las cuatro y ninguna
da 42501. El teléfono es público en las dos tablas que lo tienen, y esa es la
diferencia que hace útil esta fuente: los voluntarios de Ayudas Pereira no se
pueden contactar sin sesión, y estos sí.

### Lo que se filtra antes de mostrarlo

La fuente marca estados que **no se deben republicar**, y el filtro está en la
consulta y no en la pantalla, para que no se olvide en la siguiente vista:

- `reports.status`: `informacion_falsa` (16 filas) y `duplicado` (14). Publicar
  un aviso señalado como falso en plena emergencia es hacer daño; los duplicados
  mandan a dos personas al mismo sitio a resolver lo mismo. También se oculta
  `resuelto` (86), que ya no necesita a nadie. **`en_camino` (7) sí se publica**:
  alguien va para allá, pero todavía no ha llegado.
- `help_offers.status`: `ocultada` (63 filas). Alguien retiró su ofrecimiento.
- `service_outages.status`: se descarta `resuelto` **en la consulta**
  (`status=neq.resuelto`), no en la pantalla. Se usa `neq` y no una lista blanca
  a propósito: un estado nuevo que no conozcamos se enseña de más antes que
  esconder un cable vivo por llevar una etiqueta que no habíamos visto.

### Vocabulario propio

`reports.category`: alimentos (201) · otros (55) · medicinas (46) ·
transporte_logistica (18) · voluntariado (18) · **revision_ingenieria (13)** ·
herramientas (13) · mascotas (12) · herramientas_rescate (2). Su API declara una
décima, `conectividad_energia`, que **todavía no aparece en ningún reporte**:
llegó con la misma tanda que los daños de servicios.

`help_offers.skill`: otro (109) · alimentacion (68) · **psicologia (45)** ·
transporte (39) · rescate (26) · medico (22) · oficios (12) · enfermeria (6) ·
legal (5) · ingenieria (3). Las diez que enumera su API, sin sorpresas.

### `service_outages`: la tabla que no se pudo adivinar

Doce columnas —`id, service, severity, description, address, municipality,
department, lat, lng, photo_urls, status, created_at`— comprobadas una a una
contra PostgREST, y **calzan exactamente** con lo que devuelve `GET /servicios`.
Lo que esa API añade y aquí no existe lo compone ella al vuelo: `service_label`,
`severity_label`, `status_label` y `maps_url`.

Tres cosas condicionan cómo se lee:

1. **Hoy tiene cero filas.** La tabla existe y responde 200 con lista vacía,
   igual que `collection_points`. Desde fuera **no se puede distinguir "vacía" de
   "RLS la esconde entera"**, así que se lee lo que se ve y la pantalla no
   promete nada que no haya llegado. Todo el mapeo está probado con datos
   inyectados en los tests, no con datos reales.
2. **`severity` no es un nivel de riesgo, salvo uno.** Su documentación las
   define así: `peligro_critico` = cable vivo o poste cayéndose; `corte_sector` =
   barrio sin servicio; `falla_puntual` = acometida individual. Solo la primera
   habla de peligro; las otras dos dicen **a cuánta gente afecta**. Traducir "el
   barrio se quedó sin agua" a "riesgo medio" pintaría una alarma que la fuente
   no puso, así que únicamente `peligro_critico` se convierte en gravedad y el
   alcance viaja en el título ("Sector sin agua" frente a "Falla de agua en una
   vivienda").
3. **No trae título.** Se compone de `service` × `severity` con una rejilla
   explícita de quince frases en
   [pereira-unida/index.ts](../src/backends/pereira-unida/index.ts), y no pegando
   palabras: las combinaciones no son simétricas —"Sector sin postes" no
   significa nada— y el título es lo único que mucha gente va a leer.

### Escribir en `service_outages`: la casilla del formulario

Se publica, y con una casilla aparte. Un `INSERT` con un `id` inválido responde
`22P02` (dato mal formado) y no `42501` (sin permiso), así que el `GRANT` está
—la misma comprobación que se hizo con `reports`, y que no crea ninguna fila—.

El destino no es decorativo: su propia documentación dice que ese recurso está
pensado para el tablero de una cuadrilla, "el de Energía de Pereira, por
ejemplo". Avisar ahí es la diferencia entre que alguien **rodee** el cable y que
alguien **venga a quitarlo**.

| | |
|---|---|
| **Cuándo aparece** | Solo en los cortes de servicio. Ese tablón no recibe edificios ni vías |
| **Por defecto** | Marcada. No viaja ni un dato personal: ni nombre, ni teléfono, ni foto |
| **Si falla** | El reporte principal ya está publicado y eso es lo que se dice. Nunca "no se pudo publicar" |

Lo que se manda y lo que no:

| Columna | Qué va | Por qué |
|---|---|---|
| `service`, `severity` | Derivados de la clase elegida | `poste-cable` → `peligro_critico` sin preguntar: su escala lo define como "cable vivo o poste cayéndose" |
| `lat`, `lng` | El pin exacto | Lo único que su documentación llama obligatorio |
| `description` | La nota, o la frase compuesta si está vacía | Una fila sin descripción no dice ni qué se rompió |
| `photo_urls` | `[]` | Su columna guarda URLs, no bytes, y subir a su almacenamiento es un permiso que no tenemos |
| `municipality`, `department` | **`null`** | No se preguntan y el catálogo local solo tiene centroides: Pereira y Dosquebradas están pegadas, y etiquetar como "Pereira" un poste de Dosquebradas manda una cuadrilla al municipio equivocado. Coste medido: su filtro `?municipio=` no encontrará estos reportes |
| `address` | `null` | Por lo mismo. Meter ahí la nota repetiría el error que ya cuesta un comentario entero explicar con el `area` de la otra fuente |

**El alcance sí se pregunta.** `corte_sector` frente a `falla_puntual` es la
única cosa que esa fuente necesita y la otra no recoge, y quien reporta la sabe
sin pensar: o está el barrio entero a oscuras o es solo su casa. Deducirla sería
inventarla, y al otro lado ordena el tablero.

**Sin verificar de extremo a extremo.** La tabla tiene cero filas y comprobar que
una inserción completa pasa exigiría dejar un daño falso en la base de datos de
una emergencia ajena. El mismo caso que la escritura de `vivienda`, y por eso el
envío es de mejor esfuerzo y su fallo nunca arrastra al reporte principal.

Los dos sondeos quedan en el repositorio para poder repetirlos:
[sondear-servicios.mjs](../scripts/sondear-servicios.mjs) busca la tabla y
[sondear-columnas-servicios.mjs](../scripts/sondear-columnas-servicios.mjs)
pregunta columna por columna, que es la única forma de leer el esquema de una
tabla vacía.

Dos etiquetas no existían en las otras fuentes y obligaron a ampliar la
taxonomía con la subcategoría **`servicios-tecnicos`**: `revision_ingenieria`
(que un ingeniero mire si la casa se puede habitar) y `legal`. Son servicios
profesionales, así que nunca se cruzan contra inventario.

## Vivienda (Supabase)

Cuarta fuente, y la única que no habla de la emergencia sino de dónde vivir
después. Una sola tabla, `inmuebles`, con 30 filas.

**El esquema está duplicado en español y en inglés y solo el inglés tiene
datos.** `titulo`, `precio`, `ciudad`, `direccion`, `imagenes`, `latitude`,
`longitude` y otras 40 columnas están vacías en las 30 filas. Se leen únicamente:
`title, description, price, type, city, neighborhood, area, bedrooms, bathrooms,
parking, images, owner_whatsapp, contact_count`.

Tres medidas que cambian lo que la pantalla puede prometer:

| Dato | Realidad medida | Qué hace la app |
|---|---|---|
| `lat`/`lng` | **Falsas.** `lat` es 4.7 en las 30 filas; `lng` solo vale -74.05 (Bogotá) o 0. Los inmuebles están en Armenia, a 150 km | **No se dibuja mapa** y el enlace se hace por barrio y ciudad, no por coordenada |
| `price` | Solo 7 de 30 lo traen; el resto escribe el canon dentro de la descripción | Se rescata del texto para enseñarlo, y el filtro avisa a cuántos deja fuera |
| `bedrooms`/`bathrooms` | Solo 8 y 6 de 30 son mayores que 0 | Un 0 no se enseña: significa "no lo rellenaron", no "no tiene" |

`habitaciones`, `banos`, `parqueaderos` y `garages` son columnas muertas
rellenas de ceros: el dato vive en `bedrooms`, `bathrooms` y `parking`.

Las imágenes de `images` sí son reales: URLs públicas del Storage del propio
proyecto, comprobadas con un GET (200, `image/jpeg`).

**Escritura sin verificar.** El formulario de publicación escribe en las columnas
en inglés, pero no se ha comprobado si la clave pública tiene permiso: hacerlo
exigía insertar una fila en una base de datos de producción ajena. Si no lo
tiene, el error sale traducido con su código de soporte.
