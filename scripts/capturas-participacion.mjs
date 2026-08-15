/** Capturas de los filtros por KPI y de los formularios de participación. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

async function conPagina(ancho, alto, tema, fn) {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/ciudad/dosquebradas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-tipo="centro"]', { timeout: 25_000 })
  await page.waitForTimeout(800)
  await fn(page)
  await ctx.close()
}

// Filtro activo por KPI.
await conPagina(1440, 1000, 'light', async (page) => {
  await page.locator('.kpi--pulsable').filter({ hasText: 'URGENTES' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(DESTINO, 'filtro-activo.png') })
  console.log('ok filtro-activo')
})

// Formulario de donación.
await conPagina(1440, 1000, 'light', async (page) => {
  await page.getByRole('button', { name: 'Tengo algo para donar' }).click()
  await page.waitForSelector('.sheet')
  await page.getByLabel('¿Qué puedes aportar?').fill('20 paquetes de pañales etapa 3')
  await page.getByRole('tab', { name: 'Necesito que lo recojan' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, 'form-donar.png') })
  console.log('ok form-donar')
})

// Voluntariado sin sesión, en móvil.
await conPagina(375, 812, 'dark', async (page) => {
  await page.getByRole('button', { name: /Quiero poner las manos/ }).click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, 'form-voluntario-375.png') })
  console.log('ok form-voluntario-375')
})

await navegador.close()
