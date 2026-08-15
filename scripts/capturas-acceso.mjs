/** Capturas de los dos pasos del acceso por código, sin enviar correo real. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-interaccion')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

for (const v of [
  { nombre: '1440', width: 1440, height: 900, tema: 'light' },
  { nombre: '375', width: 375, height: 812, tema: 'dark' },
]) {
  const ctx = await navegador.newContext({
    viewport: { width: v.width, height: v.height },
    colorScheme: v.tema,
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
    [v.tema],
  )
  const page = await ctx.newPage()

  // El envío real gastaría cuota de correo del proyecto, así que se simula la
  // respuesta del endpoint de OTP para poder ver el segundo paso.
  await page.route('**/auth/v1/otp**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )

  await page.goto(`${BASE}/ciudad/dosquebradas`)
  await page.waitForSelector('.page-header__title')

  await page.locator('.notice').getByRole('button', { name: 'Entrar' }).click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, `acceso-paso1-${v.nombre}.png`) })
  console.log(`ok acceso-paso1-${v.nombre}`)

  await page.getByLabel('Tu correo').fill('persona@ejemplo.com')
  await page.getByRole('button', { name: 'Enviarme el código' }).click()
  await page.waitForSelector('#acceso-codigo', { timeout: 10_000 })
  await page.getByLabel('Código de 6 dígitos').fill('123456')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(DESTINO, `acceso-paso2-${v.nombre}.png`) })
  console.log(`ok acceso-paso2-${v.nombre}`)

  await ctx.close()
}

await navegador.close()
