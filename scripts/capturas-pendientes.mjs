/** Capturas de lo nuevo: panorama en portada, manos, mapa y desglose de viajes. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

async function ctx(ancho, alto, tema = 'light') {
  const c = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema,
    // Dosquebradas: sin ubicación concedida el mapa se encuadra por municipio,
    // que es el camino más probable de un usuario real.
    geolocation: { latitude: 4.8133, longitude: -75.6961 },
    permissions: ['geolocation'],
  })
  await c.addInitScript(() => {
    try {
      localStorage.setItem('ac.ciudad', 'pereira-2')
    } catch {
      /* sin almacenamiento */
    }
  })
  return c
}

const VISTAS = [
  { ruta: '/', nombre: 'portada-panorama', espera: '.kpi__value' },
  { ruta: '/manos', nombre: 'manos', espera: '.section' },
  { ruta: '/mapa', nombre: 'mapa', espera: '.mapa' },
  { ruta: '/inventario', nombre: 'inventario-items', espera: '.panel li' },
]

const ANCHOS = [
  [1440, 1200],
  [834, 1200],
  [375, 900],
]

for (const v of VISTAS) {
  for (const [ancho, alto] of ANCHOS) {
    const c = await ctx(ancho, alto)
    const page = await c.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e)))
    await page.goto(`${BASE}${v.ruta}`, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector(v.espera, { timeout: 25_000 })
    } catch {
      console.log(`  !! ${v.nombre} @${ancho}: no apareció ${v.espera}`)
    }
    await page.waitForTimeout(4500)

    // Desbordes: ningún elemento puede salirse del ancho de la ventana.
    const desbordes = await page.evaluate((w) => {
      const malos = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.right > w + 1 || r.left < -1) {
          malos.push(`${el.tagName}.${el.className}`.slice(0, 80))
        }
      }
      return [...new Set(malos)].slice(0, 6)
    }, ancho)

    await page.screenshot({
      path: path.join(DESTINO, `${v.nombre}-${ancho}.png`),
      fullPage: true,
    })
    console.log(
      `${v.nombre} @${ancho}: ${desbordes.length ? 'DESBORDA ' + desbordes.join(' | ') : 'ok'}` +
        (errores.length ? ` | ERRORES: ${errores.join(' | ').slice(0, 200)}` : ''),
    )
    await c.close()
  }
}

// Qué se ve realmente en cada pantalla nueva.
{
  const c = await ctx(1440, 1200)
  const page = await c.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.kpi__value', { timeout: 25_000 })
  await page.waitForTimeout(1200)
  const kpis = await page.$$eval('.kpi', (n) =>
    n.map((e) => e.innerText.replace(/\n/g, ' · ')).slice(0, 4),
  )
  const barra = await page.$$eval('.barra__relleno', (n) => n.map((e) => e.style.width))
  console.log('PORTADA kpis:', JSON.stringify(kpis), 'barra:', barra)
  await c.close()
}

{
  const c = await ctx(1440, 1200)
  const page = await c.newPage()
  await page.goto(`${BASE}/mapa`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.mapa', { timeout: 25_000 })
  await page.waitForTimeout(2500)
  const puntos = await page.$$eval('.mapa__punto', (n) =>
    n.map((e) => e.getAttribute('fill')),
  )
  const amarillos = puntos.filter((p) => p?.includes('brand')).length
  console.log(`MAPA puntos: ${puntos.length} (centros ${amarillos}, personas ${puntos.length - amarillos})`)
  console.log('MAPA subtitulo:', await page.$eval('.page-header p, .page-header__sub', (e) => e.innerText).catch(() => '(sin subtitulo)'))
  await c.close()
}

{
  const c = await ctx(1440, 1400)
  const page = await c.newPage()
  await page.goto(`${BASE}/inventario`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.panel li', { timeout: 25_000 })
  await page.waitForTimeout(2000)
  const badges = await page.$$eval('.panel li .chips .badge', (n) =>
    n.map((e) => e.innerText).slice(0, 8),
  )
  console.log('VIAJES desglose:', JSON.stringify(badges))
  await c.close()
}

{
  const c = await ctx(1440, 1200)
  const page = await c.newPage()
  await page.goto(`${BASE}/manos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  console.log('MANOS titulo:', await page.$eval('h1', (e) => e.innerText))
  console.log('MANOS tarjetas:', await page.locator('.card').count())
  console.log('MANOS vacios:', await page.locator('.empty-state, .empty').count())
  await c.close()
}

await navegador.close()
