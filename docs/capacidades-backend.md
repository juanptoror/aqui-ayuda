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
| `ofrecimientos` | **No** | Sí | "Tengo algo para donar", suelto o contra una necesidad concreta. Falta listarlos |
| `voluntarios` | **No** | Sí | "Quiero poner las manos". Falta la lista de disponibles |
| `vehiculos` | **No** | Sí | "Pongo mi carro". Falta la lista de disponibles |
| `solicitudes` | No | Sí | "Unirme al equipo" en la ficha del centro. Upsert: pulsar dos veces no duplica |
| `transportes` | Sí | Sí | Pantalla `/inventario`: lista lo que va en ruta y permite programar |
| `transporte_items` | No | No | Sin conectar |
| `perfiles` | No | No | Sin conectar |
| `asignaciones` | No | No | Sin conectar: es de coordinación interna |
| `admins_ciudad` | No | No | Sin conectar: roles de administración |

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
| `GET /help?view=detail` | No | — | Sin conectar |
| `GET /help?view=panorama` | No | — | Sin conectar |
| `/api/logistics-operations` | No | — | Sin conectar |
| `POST /mcp` | No | — | Servidor MCP, sin conectar |

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
