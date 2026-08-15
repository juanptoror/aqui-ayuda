/** Capturas de la primera pantalla (sin fullPage): lo que se ve al entrar. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '834', width: 834, height: 1112 },
  { nombre: '375', width: 375, height: 812 },
]

const RUTAS = [
  { nombre: 'inicio', url: '/' },
  { nombre: 'ciudad', url: '/ciudad/dosquebradas' },
]

const navegador = await chromium.launch()

for (const tema of ['light', 'dark']) {
  for (const a of ANCHOS) {
    const ctx = await navegador.newContext({
      viewport: { width: a.width, height: a.height },
      colorScheme: tema,
    })
    await ctx.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem('ac.theme', t)
          localStorage.setItem('ac.ciudad', 'dosquebradas')
        } catch {
          /* sin almacenamiento */
        }
      },
      [tema],
    )
    const page = await ctx.newPage()

    for (const r of RUTAS) {
      await page.goto(BASE + r.url, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.page-header__title', { timeout: 20_000 })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(400)
      const archivo = path.join(DESTINO, `${tema}-${a.nombre}-${r.nombre}.png`)
      await page.screenshot({ path: archivo })
      console.log(`ok ${path.basename(archivo)}`)
    }
    await ctx.close()
  }
}

await navegador.close()
