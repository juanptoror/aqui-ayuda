/**
 * Descarga las tipografías del brand kit desde Fontshare y las deja
 * autoalojadas en public/fonts.
 *
 * Por qué autoalojadas y no por CDN: la app se usa con red mala después de un
 * terremoto. Un CDN de tipografías es un punto de fallo extra entre el usuario
 * y el primer texto legible.
 *
 * Aeonik (la display del kit) es comercial y no se puede redistribuir, así que
 * se sustituye por General Sans, la grotesca geométrica libre más cercana.
 * Satoshi sí es la del kit y es gratuita en Fontshare.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FAMILIAS = [
  { api: 'satoshi', css: 'Satoshi', pesos: [400, 500, 700, 900] },
  { api: 'general-sans', css: 'General Sans', pesos: [500, 600, 700] },
]

const DESTINO = path.resolve('public/fonts')
await mkdir(DESTINO, { recursive: true })

const NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const reglas = []

for (const familia of FAMILIAS) {
  const url = `https://api.fontshare.com/v2/css?f[]=${familia.api}@${familia.pesos.join(',')}&display=swap`
  const css = await (await fetch(url, { headers: { 'User-Agent': NAVEGADOR } })).text()

  // Cada bloque @font-face trae su peso y su woff2 protocol-relative.
  const bloques = css.split('@font-face').slice(1)
  for (const bloque of bloques) {
    const woff2 = bloque.match(/url\('(\/\/[^']+\.woff2)'\)/)?.[1]
    const peso = bloque.match(/font-weight:\s*(\d+)/)?.[1]
    if (!woff2 || !peso) continue

    const respuesta = await fetch('https:' + woff2, { headers: { 'User-Agent': NAVEGADOR } })
    if (!respuesta.ok) {
      console.log(`fallo ${familia.css} ${peso}: ${respuesta.status}`)
      continue
    }
    const bytes = Buffer.from(await respuesta.arrayBuffer())
    const archivo = `${familia.api}-${peso}.woff2`
    await writeFile(path.join(DESTINO, archivo), bytes)
    console.log(`ok ${archivo}  ${Math.round(bytes.length / 1024)} KB`)

    reglas.push(
      `@font-face {\n  font-family: '${familia.css}';\n  src: url('/fonts/${archivo}') format('woff2');\n  font-weight: ${peso};\n  font-style: normal;\n  font-display: swap;\n}`,
    )
  }
}

const cabecera = `/* ============================================================================
   Tipografías del brand kit de AquíAyuda, autoalojadas.

   Satoshi es la del kit (Fontshare, uso libre). General Sans sustituye a
   Aeonik, que es comercial y no se puede redistribuir: es la grotesca
   geométrica libre más cercana en proporciones y peso.

   Generado por scripts/descargar-fuentes.mjs — no editar a mano.
   ========================================================================== */\n\n`

await writeFile(path.resolve('src/styles/fuentes.css'), cabecera + reglas.join('\n\n') + '\n')
console.log(`\n${reglas.length} reglas @font-face en src/styles/fuentes.css`)
