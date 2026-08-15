/**
 * Inspecciona una ruta en el navegador: cuenta selectores y vuelca errores.
 * Uso: node scripts/inspeccionar.mjs /ciudad/dosquebradas ".card__title" "[data-tipo=centro]"
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const ruta = process.argv[2] ?? '/'
const selectores = process.argv.slice(3)

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })

const errores = []
pagina.on('pageerror', (e) => errores.push(e.message.slice(0, 200)))
pagina.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text().slice(0, 200))
})

await pagina.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(4000)

for (const s of selectores) {
  console.log(`${s} -> ${await pagina.locator(s).count()}`)
}

if (errores.length) {
  console.log('\nerrores:')
  for (const e of errores.slice(0, 8)) console.log('  ' + e)
} else {
  console.log('\nsin errores de consola')
}

await navegador.close()
