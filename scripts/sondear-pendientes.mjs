/**
 * Qué queda por unir: sondea, SIN sesión, lo que aún no consumimos de cada
 * backend. Sin sesión es el caso que importa, porque es como entra la mayoría.
 */
const AP = 'https://yjkyzfuixdpuhgthoeua.supabase.co/rest/v1'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_hWboFTjrnhfsAn5gXDW_Gg_rqx2iGLR'
const CG = 'https://ayuda.corag.app/api/public/v1/help'

const cab = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function tabla(nombre, columnas = '*') {
  const url = `${AP}/${nombre}?select=${columnas}&limit=3`
  try {
    const r = await fetch(url, { headers: cab })
    const t = await r.text()
    if (!r.ok) {
      let código = ''
      try {
        código = JSON.parse(t).code ?? ''
      } catch {
        /* no era JSON */
      }
      return `${String(r.status).padEnd(4)} ${código}`
    }
    const filas = JSON.parse(t)
    const cols = filas[0] ? Object.keys(filas[0]).join(', ') : '(vacía)'
    return `200  ${filas.length} filas · ${cols.slice(0, 150)}`
  } catch (e) {
    return `ERR  ${e.message}`
  }
}

console.log('=== AYUDAS PEREIRA · lo que no consumimos, sin sesión ===')
for (const t of [
  'ofrecimientos',
  'voluntarios',
  'vehiculos',
  'transporte_items',
  'solicitudes',
  'perfiles',
  'asignaciones',
  'admins_ciudad',
]) {
  console.log(`${t.padEnd(18)} ${await tabla(t)}`)
}

console.log('\n=== CORAG · vistas que no consumimos ===')
for (const [nombre, url] of [
  ['detail', `${CG}?view=detail&id=`],
  ['panorama', `${CG}?view=panorama`],
  ['logistics', 'https://ayuda.corag.app/api/logistics-operations?emergencia=eje-cafetero'],
  ['openapi', 'https://ayuda.corag.app/api/public/openapi.json'],
]) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    const t = await r.text()
    let claves = ''
    try {
      const j = JSON.parse(t)
      claves = Array.isArray(j) ? `array(${j.length})` : Object.keys(j).join(', ').slice(0, 160)
    } catch {
      claves = t.slice(0, 80)
    }
    console.log(`${nombre.padEnd(12)} ${String(r.status).padEnd(4)} ${claves}`)
  } catch (e) {
    console.log(`${nombre.padEnd(12)} ERR  ${e.message}`)
  }
}

// Un id real para probar la vista de detalle.
try {
  const lista = await (await fetch(`${CG}?view=list&limit=1`)).json()
  const id = lista.items?.[0]?.id
  if (id) {
    const r = await fetch(`${CG}?view=detail&id=${id}`)
    const j = await r.json()
    console.log(
      `\ndetail con id real  ${r.status}  ${Object.keys(j).join(', ').slice(0, 200)}`,
    )
  }
} catch (e) {
  console.log('detail con id real ERR', e.message)
}
