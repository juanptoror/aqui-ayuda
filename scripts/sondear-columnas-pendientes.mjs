/** Confirma qué columnas son legibles sin sesión en las tablas pendientes. */
const AP = 'https://yjkyzfuixdpuhgthoeua.supabase.co/rest/v1'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_hWboFTjrnhfsAn5gXDW_Gg_rqx2iGLR'
const cab = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const CANDIDATAS = {
  ofrecimientos: [
    'id,centro_id,ciudad_id,necesidad_id,categoria,descripcion,estado,created_at',
    'id,nombre',
    'id,telefono',
    'id,direccion_recogida',
    'id,necesita_transporte',
  ],
  voluntarios: [
    'id,ciudad_id,centro_id,nombre,puede_ayudar_en,disponibilidad,disponible,creado_at',
    'id,telefono',
    'id,usuario_id',
    'id,notas',
  ],
  vehiculos: [
    'id,ciudad_id,nombre,vehiculo,capacidad,zona,disponible,creado_at',
    'id,telefono',
    'id,usuario_id',
  ],
}

for (const [tabla, variantes] of Object.entries(CANDIDATAS)) {
  console.log(`\n=== ${tabla} ===`)
  for (const cols of variantes) {
    const r = await fetch(`${AP}/${tabla}?select=${cols}&limit=2`, { headers: cab })
    const t = await r.text()
    if (r.ok) {
      const filas = JSON.parse(t)
      console.log(`  LEGIBLE  ${cols}`)
      if (filas[0]) console.log(`           ej: ${JSON.stringify(filas[0]).slice(0, 180)}`)
    } else {
      let c = ''
      try {
        c = JSON.parse(t).code ?? ''
      } catch {
        /* no JSON */
      }
      console.log(`  ${c === '42501' ? 'DENEGADA' : 'error   '} ${cols}  (${c})`)
    }
  }
}

console.log('\n=== CORAG panorama ===')
const pan = await (
  await fetch('https://ayuda.corag.app/api/public/v1/help?view=panorama')
).json()
console.log('counts:', JSON.stringify(pan.counts).slice(0, 300))
console.log('quantities:', JSON.stringify(pan.quantities).slice(0, 300))
console.log('routes:', JSON.stringify(pan.routes).slice(0, 400))

console.log('\n=== CORAG logistics-operations ===')
const log = await (
  await fetch('https://ayuda.corag.app/api/logistics-operations?emergencia=eje-cafetero')
).json()
console.log('canManage:', log.canManage, '· operations:', log.operations?.length)
if (log.operations?.[0]) console.log('ej:', JSON.stringify(log.operations[0]).slice(0, 400))
