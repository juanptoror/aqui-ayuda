/**
 * Comprueba un despliegue real: que las rutas del SPA responden (no 404 al
 * recargar), que la app monta en el navegador y que pinta datos de verdad.
 * Uso: node scripts/verificar-despliegue.mjs https://mi-app.vercel.app
 */
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'https://ayudas-colombia-web.vercel.app'
const RUTAS = [
  '/',
  '/ciudades',
  '/ciudad/dosquebradas',
  '/ayuda-directa',
  '/que-falta',
  '/inventario',
  '/acerca',
  '/estado',
]

console.log(`--- HTTP (recarga directa de cada ruta) ---`)
let fallos = 0

for (const r of RUTAS) {
  const res = await fetch(BASE + r, { redirect: 'manual' })
  const cuerpo = await res.text()
  const montaSPA = cuerpo.includes('id="root"')
  const ok = res.status === 200 && montaSPA
  if (!ok) fallos++
  console.log(
    `${String(res.status).padEnd(4)} ${r.padEnd(24)} ${montaSPA ? 'html-spa' : 'SIN SHELL'} ${ok ? '' : '  <-- FALLA'}`,
  )
}

console.log(`\n--- navegador ---`)
const navegador = await chromium.launch()
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

const errores = []
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message.slice(0, 160)}`))

await page.goto(`${BASE}/ciudad/dosquebradas`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-tipo="centro"]', { timeout: 30_000 })
await page.waitForTimeout(1200)

const titulo = await page.locator('.page-header__title').innerText()
// Solo tarjetas de centro: la pantalla tiene además tarjetas de acción.
const tarjetas = await page.locator('[data-tipo="centro"]').count()
const subtitulo = await page.locator('.page-header__subtitle').innerText()

console.log(`titulo:    ${titulo}`)
console.log(`subtitulo: ${subtitulo}`)
console.log(`centros:   ${tarjetas}`)

await page.screenshot({ path: 'capturas-interaccion/produccion-1440.png' })

if (tarjetas === 0) {
  console.log('FALLA: no se pintó ningún centro en producción')
  fallos++
}
if (errores.length) {
  console.log(`\nerrores de consola (${errores.length}):`)
  for (const e of errores.slice(0, 8)) console.log('  ' + e)
}

await navegador.close()
console.log(fallos === 0 ? '\nDESPLIEGUE OK' : `\nDESPLIEGUE CON ${fallos} FALLO(S)`)
process.exit(fallos === 0 ? 0 : 1)
