/**
 * Columnas reales de `service_outages`, la tabla detrás de `/api/public/v1/servicios`.
 *
 * La tabla está vacía hoy, así que no se puede leer una fila y mirar sus claves:
 * hay que preguntar columna por columna. PostgREST responde 200 si la columna
 * existe y 400 "column ... does not exist" si no, que es todo lo que hace falta.
 *
 * Se prueban los nombres que publica su propia API más las variantes plausibles,
 * porque la API renombra algunas cosas al salir (`service_label`, `maps_url` y
 * los demás `*_label` los compone ella, no están en la tabla).
 *
 *   node scripts/sondear-columnas-servicios.mjs
 */
import { readFileSync } from 'node:fs'

function env(clave) {
  for (const archivo of ['.env.local', '.env.production']) {
    try {
      const m = readFileSync(archivo, 'utf8').match(new RegExp(`^${clave}=(.*)$`, 'm'))
      if (m?.[1]?.trim() && !m[1].includes('xxxx')) return m[1].trim()
    } catch {
      /* el archivo no existe */
    }
  }
  return null
}

const URL_PU = env('VITE_PU_URL')
const CLAVE = env('VITE_PU_ANON_KEY')
if (!URL_PU || !CLAVE) {
  console.error('Faltan VITE_PU_URL o VITE_PU_ANON_KEY.')
  process.exit(1)
}

const TABLA = process.argv[2] ?? 'service_outages'

const CANDIDATAS = [
  // Lo que publica su API.
  'id', 'service', 'severity', 'description', 'address', 'municipality',
  'department', 'lat', 'lng', 'photo_urls', 'status', 'created_at',
  // Variantes de nombre plausibles.
  'service_type', 'severity_level', 'urgent_level', 'title', 'location_name',
  'neighborhood', 'updated_at', 'resolved_at', 'last_confirmed_at',
  'contact_phone', 'phone', 'reporter_name', 'author_name', 'notes',
  'maps_url', 'service_label', 'severity_label', 'status_label',
]

async function existe(columna) {
  const r = await fetch(`${URL_PU}/rest/v1/${TABLA}?select=${columna}&limit=1`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
  })
  if (r.status === 200) return { ok: true }
  const cuerpo = await r.text()
  let mensaje = cuerpo.slice(0, 90)
  try {
    mensaje = JSON.parse(cuerpo).message ?? mensaje
  } catch {
    /* la respuesta no era JSON */
  }
  return { ok: false, status: r.status, mensaje }
}

console.log(`Columnas de ${TABLA}\n`)
const hay = []
for (const c of CANDIDATAS) {
  const r = await existe(c)
  if (r.ok) {
    hay.push(c)
    console.log(`  sí  ${c}`)
  } else {
    console.log(`  no  ${c.padEnd(20)} ${r.status} ${r.mensaje}`)
  }
}

console.log(`\nCOLUMNAS = '${hay.join(',')}'`)
