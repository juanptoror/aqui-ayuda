/**
 * ¿Qué tabla hay detrás de `GET /api/public/v1/servicios` de Pereira Unida?
 *
 * Su API pública documenta un recurso de daños de servicios —energía, postes,
 * agua, gas, internet— que esta aplicación no lee. Como la integración va por
 * Supabase y no por esa API, hace falta saber en qué tabla vive y con qué
 * columnas, y este proyecto no expone su OpenAPI con la clave publicable. Así
 * que se prueba por nombre, igual que se descubrieron `reports` y `help_offers`.
 *
 *   node scripts/sondear-servicios.mjs
 */
import { readFileSync } from 'node:fs'

function env(clave) {
  for (const archivo of ['.env.local', '.env.production', '.env.example']) {
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

const CANDIDATAS = [
  'service_reports',
  'services',
  'servicios',
  'utility_reports',
  'utilities',
  'utility_issues',
  'service_issues',
  'service_damages',
  'utility_damages',
  'damage_reports',
  'infrastructure_reports',
  'public_services',
  'service_outages',
  'outages',
  'poles',
  'energy_reports',
  'power_reports',
  'service_failures',
  'fallas',
  'danos_servicios',
]

async function pedir(ruta) {
  const r = await fetch(`${URL_PU}/rest/v1/${ruta}`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, Prefer: 'count=exact' },
  })
  const texto = await r.text()
  return { status: r.status, rango: r.headers.get('content-range'), texto }
}

console.log(`Sondeando ${URL_PU}\n`)

const encontradas = []
for (const tabla of CANDIDATAS) {
  const { status, rango, texto } = await pedir(`${tabla}?select=*&limit=1`)
  if (status === 200) {
    const filas = JSON.parse(texto)
    const total = rango?.split('/')[1] ?? '?'
    encontradas.push({ tabla, total, muestra: filas[0] ?? null })
    console.log(`OK    ${tabla} — ${total} filas`)
  } else {
    let motivo = ''
    try {
      motivo = JSON.parse(texto).message ?? ''
    } catch {
      motivo = texto.slice(0, 60)
    }
    console.log(`${String(status).padEnd(5)} ${tabla} — ${motivo}`)
  }
}

for (const { tabla, total, muestra } of encontradas) {
  console.log(`\n=== ${tabla} (${total} filas) ===`)
  console.log(muestra ? JSON.stringify(muestra, null, 2) : '(vacía)')
}
