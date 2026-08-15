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
| `voluntarios` | **Legible, sin usar** | Sí | Se puede listar quién puede ayudar, en qué y cuándo |
| `vehiculos` | **Legible, sin usar** | Sí | Se puede listar qué vehículos hay, capacidad y zona |
| `solicitudes` | No (RLS) | Sí | "Unirme al equipo". Upsert: pulsar dos veces no duplica |
| `transportes` | Sí | Sí | Pantalla de inventario: lista lo que va en ruta y permite programar |
| `transporte_items` | **Legible, sin usar** | No | `transporte_id, categoria, cantidad, unidad`: el desglose de cada viaje |
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
| `GET /help?view=panorama` | **Disponible, sin usar** | — | `counts` y `quantities` agregados de la emergencia |
| `/api/logistics-operations` | Disponible, vacío | — | Devuelve 0 operaciones y `canManage: false` |
| `POST /mcp` | No | — | Servidor MCP, sin conectar |

Lo que devuelve `panorama` hoy y no se está mostrando en ninguna parte:

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
| Vehículo de Ayudas Pereira ↔ petición de Corag que necesita transporte | El cuello de botella real | Leer `vehiculos` y cruzar por zona |
| Mapa único | Centros y personas en una sola vista | Ambos traen `lat`/`lng`; falta la pantalla |

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
