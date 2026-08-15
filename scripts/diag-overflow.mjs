/** Lista los elementos que se salen del ancho de la ventana en una ruta. */
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:5180/'
const ancho = Number(process.argv[3] ?? 375)

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: ancho, height: 812 } })
await pagina.goto(url, { waitUntil: 'domcontentloaded' })
await pagina.waitForSelector('.page-header__title, .hero__titulo')
await pagina.waitForLoadState('networkidle').catch(() => {})

const info = await pagina.evaluate(() => {
  const limite = document.documentElement.clientWidth
  const fuera = []
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.right > limite + 1) {
      fuera.push({
        sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
        right: Math.round(r.right),
        width: Math.round(r.width),
        left: Math.round(r.left),
        texto: (el.textContent ?? '').trim().slice(0, 45),
      })
    }
  }
  return { limite, scrollWidth: document.documentElement.scrollWidth, fuera }
})

console.log(`ventana=${info.limite} scrollWidth=${info.scrollWidth}`)
console.log(JSON.stringify(info.fuera.slice(0, 25), null, 1))

await navegador.close()
