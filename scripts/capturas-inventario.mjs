/** Capturas de la pantalla de inventario y del flujo "yo tengo" / "unirme". */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

async function ctxConCiudad(ancho, alto, tema = 'light') {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema,
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ac.ciudad', 'dosquebradas')
    } catch {
      /* sin almacenamiento */
    }
  })
  return ctx
}

// Inventario con una categoría desplegada.
{
  const ctx = await ctxConCiudad(1440, 1100)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/inventario`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.panel li', { timeout: 25_000 })
  await page.waitForTimeout(900)

  const categorias = page.locator('.panel li button[aria-expanded]')
  console.log('categorias:', await categorias.count())
  await categorias.first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(DESTINO, 'inventario.png'), fullPage: true })
  console.log('ok inventario')
  await ctx.close()
}

// Formulario de transporte.
{
  const ctx = await ctxConCiudad(1440, 1000)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/inventario`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.page-header__title')
  await page.getByRole('button', { name: 'Nuevo transporte' }).click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(DESTINO, 'form-transporte.png') })
  console.log('ok form-transporte')
  await ctx.close()
}

// Ficha de centro: "Unirme al equipo" y "Yo tengo" por necesidad.
{
  const ctx = await ctxConCiudad(1440, 1100)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/ciudad/dosquebradas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-tipo="centro"]', { timeout: 25_000 })
  await page.locator('.card__link').first().click()
  await page.waitForURL(/\/centro\//)
  await page.waitForSelector('.page-header__title')
  await page.waitForTimeout(1200)

  console.log('botones "Yo tengo":', await page.getByRole('button', { name: 'Yo tengo' }).count())
  console.log('boton unirme:', await page.getByRole('button', { name: /Unirme/ }).count())

  await page.evaluate(() => window.scrollTo(0, 700))
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, 'centro-acciones.png') })
  console.log('ok centro-acciones')
  await ctx.close()
}

await navegador.close()
