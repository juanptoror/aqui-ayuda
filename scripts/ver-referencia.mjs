/**
 * Extrae la paleta y la tipografía de una web de referencia para poder
 * respetarlas en vez de suponerlas.
 * Uso: node scripts/ver-referencia.mjs https://ejemplo.com
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const URL_REF = process.argv[2] ?? 'https://corag.app/'
const DESTINO = path.resolve('capturas-referencia')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

for (const v of [
  { nombre: '1440', width: 1440, height: 1000 },
  { nombre: '375', width: 375, height: 812 },
]) {
  const ctx = await navegador.newContext({ viewport: { width: v.width, height: v.height } })
  const page = await ctx.newPage()
  try {
    await page.goto(URL_REF, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.waitForTimeout(2500)
    await page.screenshot({
      path: path.join(DESTINO, `ref-${v.nombre}.png`),
      fullPage: v.nombre === '1440',
    })
    console.log(`ok ref-${v.nombre}`)
  } catch (e) {
    console.log(`fallo ref-${v.nombre}: ${e.message.split('\n')[0]}`)
    continue
  }

  if (v.nombre !== '1440') {
    await ctx.close()
    continue
  }

  const info = await page.evaluate(() => {
    const cuenta = new Map()
    const anota = (clave, valor) => {
      if (!valor || valor === 'rgba(0, 0, 0, 0)' || valor === 'transparent') return
      const k = `${clave}|${valor}`
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }

    const elementos = Array.from(document.querySelectorAll('*')).slice(0, 3000)
    for (const el of elementos) {
      const s = getComputedStyle(el)
      anota('bg', s.backgroundColor)
      anota('fg', s.color)
      anota('border', s.borderTopColor)
    }

    const fuentes = [
      ...new Set(
        Array.from(document.querySelectorAll('h1,h2,h3,p,body,button,a')).map(
          (el) => getComputedStyle(el).fontFamily,
        ),
      ),
    ]

    // Variables CSS declaradas en :root, que suelen SER el sistema de diseño.
    const vars = {}
    for (const hoja of Array.from(document.styleSheets)) {
      let reglas
      try {
        reglas = hoja.cssRules
      } catch {
        continue
      }
      for (const r of Array.from(reglas ?? [])) {
        if (r.selectorText === ':root' || r.selectorText === 'html') {
          for (const prop of Array.from(r.style ?? [])) {
            if (prop.startsWith('--')) vars[prop] = r.style.getPropertyValue(prop).trim()
          }
        }
      }
    }

    const botones = Array.from(document.querySelectorAll('button, a[class*="btn"]'))
      .slice(0, 8)
      .map((b) => {
        const s = getComputedStyle(b)
        return {
          texto: (b.textContent ?? '').trim().slice(0, 24),
          bg: s.backgroundColor,
          fg: s.color,
          radio: s.borderRadius,
          borde: s.border,
        }
      })

    return {
      colores: [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28),
      fuentes,
      vars,
      botones,
      radios: [
        ...new Set(
          elementos.map((e) => getComputedStyle(e).borderRadius).filter((r) => r && r !== '0px'),
        ),
      ].slice(0, 12),
    }
  })

  console.log('\n--- colores mas usados ---')
  for (const [k, n] of info.colores) console.log(`${String(n).padStart(4)}  ${k}`)
  console.log('\n--- fuentes ---')
  console.log(info.fuentes.join('\n'))
  console.log('\n--- variables :root ---')
  console.log(JSON.stringify(info.vars, null, 1))
  console.log('\n--- botones ---')
  console.log(JSON.stringify(info.botones, null, 1))
  console.log('\n--- radios ---')
  console.log(info.radios.join(', '))

  await ctx.close()
}

await navegador.close()
