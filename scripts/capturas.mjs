/**
 * Genera capturas de la app en los tres anchos de referencia y en ambos temas.
 * Uso: node scripts/capturas.mjs [carpetaDestino]
 *
 * No es decoración: es la única forma de revisar el diseño renderizado de
 * verdad en lugar de suponer cómo quedó.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = process.argv[2] ?? path.resolve('capturas')

const ANCHOS = [
  { nombre: '1440', width: 1440, height: 1000 },
  { nombre: '834', width: 834, height: 1112 },
  { nombre: '375', width: 375, height: 812 },
]

const RUTAS = [
  { nombre: 'inicio', url: '/' },
  { nombre: 'ciudad', url: '/ciudad/dosquebradas' },
  { nombre: 'municipios', url: '/ciudades' },
  { nombre: 'que-falta', url: '/que-falta' },
  { nombre: 'como-ayudar', url: '/como-ayudar' },
  { nombre: 'acerca', url: '/acerca' },
]

const TEMAS = ['light', 'dark']

await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

for (const tema of TEMAS) {
  for (const ancho of ANCHOS) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho.width, height: ancho.height },
      deviceScaleFactor: 1,
      colorScheme: tema,
    })

    // El municipio queda preseleccionado para que /que-falta muestre datos y
    // no su estado vacío en todas las capturas.
    await contexto.addInitScript(
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

    const pagina = await contexto.newPage()

    for (const ruta of RUTAS) {
      await pagina.goto(BASE + ruta.url, { waitUntil: 'domcontentloaded' })
      await pagina.waitForSelector('.page-header__title, .hero__titulo', { timeout: 20_000 })
      await pagina.waitForLoadState('networkidle').catch(() => {})
      // Deja terminar la animación de entrada de las tarjetas.
      await pagina.waitForTimeout(450)

      const archivo = path.join(DESTINO, `${tema}-${ancho.nombre}-${ruta.nombre}.png`)
      await pagina.screenshot({ path: archivo, fullPage: true })
      console.log(`ok  ${path.basename(archivo)}`)
    }

    await contexto.close()
  }
}

await navegador.close()
console.log(`\nCapturas en: ${DESTINO}`)
