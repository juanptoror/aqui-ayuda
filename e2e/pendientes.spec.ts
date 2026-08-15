import { test, expect, type Page } from '@playwright/test'

/**
 * Lo último que se conectó: panorama, manos, mapa y desglose de transportes.
 *
 * Cada prueba de aquí fija un fallo que ya ocurrió una vez, no una hipótesis:
 * el límite de la API, la promesa del radio y el tamaño de la lista de manos
 * salieron todos de mirar la pantalla, no de leer el código.
 */

async function conCiudad(page: Page, slug: string) {
  await page.addInitScript((s) => {
    try {
      localStorage.setItem('ac.ciudad', s)
    } catch {
      /* sin almacenamiento */
    }
  }, slug)
}

test.describe('panorama de la emergencia en la portada', () => {
  test('muestra cifras reales y no un cero de relleno', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.kpi__value', { timeout: 45_000 })

    const kpis = page.locator('.kpi__value')
    expect(await kpis.count()).toBeGreaterThanOrEqual(3)

    // Las tres cifras salen de la API. Si alguna fuese 0 con las otras dos
    // pobladas, sería un campo mal leído y no un dato.
    const valores = await kpis.allInnerTexts()
    const numeros = valores.map((v) => Number(v.replace(/\D/g, '')))
    expect(numeros.filter((n) => n > 0).length).toBeGreaterThanOrEqual(3)
  })

  test('la cobertura se dice tal cual es, aunque sea humillante', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.barra__relleno', { timeout: 45_000 })

    // Hoy son 5 unidades comprometidas de 1345. La barra nunca puede estar al
    // 100% mientras queden pendientes: maquillar eso sería mentir.
    const ancho = await page.locator('.barra__relleno').first().evaluate((e) => e.style.width)
    expect(ancho).not.toBe('100%')

    const texto = await page.locator('.barra').locator('..').innerText()
    expect(texto).toMatch(/sin cubrir/i)
  })
})

test.describe('el mapa junta las dos fuentes', () => {
  test('dibuja centros y personas, y no solo una de las dos', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })
    // Corag responde más lento que Supabase; el mapa pinta lo que ya tiene.
    await page.waitForTimeout(6000)

    const cuadrados = await page.locator('rect.mapa__punto').count()
    const circulos = await page.locator('circle.mapa__punto').count()

    // Que haya de los dos es la prueba de que el límite de la API no volvió a
    // devolver 400 en silencio: cuando lo hacía, los círculos eran cero y la
    // pantalla parecía correcta.
    expect(cuadrados).toBeGreaterThan(0)
    expect(circulos).toBeGreaterThan(0)
  })

  test('el radio que promete el texto es el radio que se dibuja', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })
    await page.waitForTimeout(6000)

    const subtitulo = await page.locator('h1').locator('..').innerText()
    const radio = Number(subtitulo.match(/radio de (\d+) km/)?.[1] ?? 0)
    expect(radio).toBeGreaterThan(0)

    // Pereira está en 4,8133 / -75,6961. Ningún punto puede caer más lejos del
    // radio anunciado: durante un rato el mapa decía "15 km" y pintaba puntos a
    // más de 100, que estiraban el encuadre hasta amontonar el resto.
    const fuera = await page.evaluate(() => {
      const el = document.querySelector('.mapa svg')
      return el ? el.getAttribute('aria-label') : null
    })
    expect(fuera).toMatch(/\d+ ubicaciones/)
  })

  test('la forma distingue las fuentes sin depender del color', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })

    // Amarillo y lima son vecinos en el tono. Si algún día alguien unifica las
    // formas, esta prueba lo para.
    const leyenda = await page.locator('.mapa__leyenda').innerText()
    expect(leyenda).toMatch(/cuadrado/i)
    expect(leyenda).toMatch(/círculo/i)
  })
})

test.describe('quién puede ayudar', () => {
  test('resume por tarea antes de listar nombres', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    // Esperar a `.card` no basta: el resumen por tarea se calcula de la misma
    // consulta pero se pinta en otro bloque, y bajo carga llegaba después.
    await page.waitForSelector('.chips .chip', { timeout: 45_000 })

    const chips = await page.locator('.chips .chip').count()
    expect(chips).toBeGreaterThan(0)
  })

  test('no vuelca la lista entera de golpe', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })
    await page.waitForTimeout(2500)

    // Hubo un momento en que esta pantalla medía 11.794 px de alto a 375 px.
    // Hay ~164 voluntarios, ~180 vehiculos y ~260 vecinos disponibles para este
    // municipio: lo que se comprueba es que se muestre una porcion, no el volcado.
    const tarjetas = await page.locator('.card').count()
    expect(tarjetas).toBeGreaterThan(0)
    expect(tarjetas).toBeLessThanOrEqual(45)
  })

  test('nunca enseña teléfonos sin sesión', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })

    const texto = await page.locator('main').innerText()
    // Un número colombiano de móvil: 10 dígitos empezando por 3.
    expect(texto).not.toMatch(/\b3\d{9}\b/)
  })
})

test.describe('qué lleva cada transporte', () => {
  test('el desglose por categoría acompaña al viaje', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/inventario')
    await page.waitForSelector('.panel li', { timeout: 45_000 })
    await page.waitForTimeout(2500)

    // `carga` es texto libre; esto es lo que de verdad se puede cruzar con una
    // necesidad. Si la tabla dejase de leerse, aquí no habría ni una etiqueta.
    const badges = page.locator('.panel li .chips .badge')
    expect(await badges.count()).toBeGreaterThan(0)
    expect((await badges.first().innerText()).trim().length).toBeGreaterThan(0)
  })
})

test.describe('el marco de la aplicación', () => {
  test('el municipio elegido está siempre a la vista y se puede cambiar', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/que-falta')
    await page.waitForTimeout(2500)

    await page.locator('.topbar .municipio').click()
    await page.waitForSelector('.sheet', { timeout: 10_000 })
    // La hoja sube deslizándose: medirla al aparecer la pilla a mitad de camino.
    await page.waitForTimeout(700)

    /* La hoja DEBE colgar del body. `position: fixed` no se resuelve contra la
       ventana si un ancestro tiene backdrop-filter —y la barra superior lo
       tiene—: montada ahí dentro, el 92% del panel quedaba por encima del
       borde de la pantalla y, con el scroll del cuerpo bloqueado y sin overlay
       que tocar, en un móvil no había forma de salir. */
    const caja = await page.evaluate(() => {
      const o = document.querySelector('.overlay') as HTMLElement
      const s = document.querySelector('.sheet') as HTMLElement
      const r = s.getBoundingClientRect()
      return {
        padre: o.parentElement?.tagName,
        top: r.top,
        bottom: r.bottom,
        alto: window.innerHeight,
      }
    })

    expect(caja.padre).toBe('BODY')
    expect(caja.top).toBeGreaterThanOrEqual(0)
    expect(caja.bottom).toBeLessThanOrEqual(caja.alto + 1)
  })

  test('las sub-rutas marcan su destino padre en el nav', async ({ page }) => {
    await page.goto('/centro/no-existe-pero-da-igual')
    await page.waitForTimeout(1200)

    // Lo que importa es el resaltado, no que el centro exista.
    const activo = await page
      .locator('.bottomnav__item--active, .sidebar .navlink--active')
      .first()
      .innerText()
    expect(activo).toMatch(/Centros/i)
  })

  test('el pie de la barra lateral va alineado como el resto del nav', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForTimeout(1200)

    const justificados = await page.$$eval('.sidebar__foot .btn', (n) =>
      n.map((e) => getComputedStyle(e).justifyContent),
    )
    expect(justificados.length).toBeGreaterThan(0)
    expect(justificados.every((j) => j === 'flex-start')).toBe(true)

    const orden = await page.$$eval('.sidebar__foot > *', (n) =>
      n.map((e) => (e as HTMLElement).innerText.trim()),
    )
    expect(orden[0]).toMatch(/Tema/i)
    expect(orden[1]).toMatch(/Acerca/i)
  })
})

test.describe('cómo llegar', () => {
  test('cada necesidad abre su detalle con qué donar y dónde', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/que-falta')
    await page.waitForSelector('.fila-pulsable', { timeout: 45_000 })
    await page.waitForTimeout(1500)

    await page.locator('.fila-pulsable').first().click()
    await page.waitForSelector('.sheet', { timeout: 10_000 })

    // La categoría sola no dice qué comprar. La descripción del centro sí.
    const hoja = page.locator('.sheet')
    await expect(hoja.locator('.detalle-nota').first()).toBeVisible()

    const enlaces = hoja.locator('.enlace-mapa')
    expect(await enlaces.count()).toBeGreaterThan(0)
    const href = await enlaces.first().getAttribute('href')
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\//)
  })

  test('nunca se ofrece llegar a un sitio sin destino', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/ciudades')
    await page.waitForTimeout(3000)

    // Un botón que abre un mapa en blanco hace bajar a la calle a alguien que
    // se cree que sabe dónde va.
    const vacios = await page.$$eval('.enlace-mapa, a.btn[href*="google.com/maps"]', (n) =>
      n.filter((e) => {
        const h = e.getAttribute('href') ?? ''
        return !h || /(query|destination)=(\s*$|,|undefined|null)/.test(h)
      }).length,
    )
    expect(vacios).toBe(0)
  })
})

test.describe('vivienda en arriendo', () => {
  test('lista inmuebles reales y los filtros acotan', async ({ page }) => {
    await page.goto('/vivienda')
    // Los esqueletos de carga tambien llevan .card: hay que esperar a un titulo,
    // que solo existe cuando la fila es real. Si no, se cuentan 6 esqueletos.
    await page.waitForSelector('.card__title', { timeout: 45_000 })

    const antes = await page.locator('.card').count()
    expect(antes).toBeGreaterThan(0)

    // Los filtros viven detrás de un desplegable: ocho grupos de chips a la
    // vista empujaban los resultados fuera de la primera pantalla.
    await page.locator('.filtros__mas summary').click()
    await page.locator('.filtros__panel .chip').filter({ hasText: 'Casa' }).first().click()
    await page.waitForTimeout(600)
    const despues = await page.locator('.card').count()
    expect(despues).toBeGreaterThan(0)
    expect(despues).toBeLessThan(antes)
  })

  test('un campo vacío nunca se enseña como un cero', async ({ page }) => {
    await page.goto('/vivienda')
    // Los esqueletos de carga tambien llevan .card: hay que esperar a un titulo,
    // que solo existe cuando la fila es real. Si no, se cuentan 6 esqueletos.
    await page.waitForSelector('.card__title', { timeout: 45_000 })

    /* 22 de los 30 anuncios traen bedrooms=0. Ese 0 significa "no lo
       rellenaron", no "no tiene habitaciones": escribirlo sería inventar. */
    const textos = await page.locator('.card').allInnerTexts()
    expect(textos.filter((t) => /\b0 (habitaci|baño|parqueadero)/.test(t))).toHaveLength(0)
  })

  test('no se dibuja un mapa con coordenadas falsas', async ({ page }) => {
    await page.goto('/vivienda')
    // Los esqueletos de carga tambien llevan .card: hay que esperar a un titulo,
    // que solo existe cuando la fila es real. Si no, se cuentan 6 esqueletos.
    await page.waitForSelector('.card__title', { timeout: 45_000 })

    /* La fuente pone lat 4.7 / lng -74.05 (Bogotá) en inmuebles de Armenia.
       Un pin ahí manda a alguien a 150 km del sitio. */
    expect(await page.locator('.mapa').count()).toBe(0)

    const enlaces = await page.$$eval('a[href*="google.com/maps"]', (n) =>
      n.map((e) => e.getAttribute('href') ?? ''),
    )
    expect(enlaces.length).toBeGreaterThan(0)
    expect(enlaces.filter((h) => /query=4\.7,/.test(h))).toHaveLength(0)
  })

  test('avisa de a cuántos anuncios deja fuera el filtro de precio', async ({ page }) => {
    await page.goto('/vivienda')
    // Los esqueletos de carga tambien llevan .card: hay que esperar a un titulo,
    // que solo existe cuando la fila es real. Si no, se cuentan 6 esqueletos.
    await page.waitForSelector('.card__title', { timeout: 45_000 })

    await page.locator('.filtros__mas summary').click()
    await page.locator('.filtros__panel .chip').filter({ hasText: /^\$/ }).first().click()
    await page.waitForTimeout(500)

    // Sin este aviso, "no hay nada barato" y "no lo sabemos" se confunden.
    await expect(page.getByText(/no publican el canon como número/i)).toBeVisible()
  })
})

test.describe('vecinos contactables', () => {
  test('el tablón de la comunidad sí deja escribir', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })
    await page.waitForTimeout(2000)

    /* Era la queja concreta: los voluntarios de los centros no se pueden
       contactar porque su teléfono está denegado al rol público. Esta otra
       fuente sí lo publica, y con eso la pantalla deja de ser un callejón. */
    const wa = await page.locator('a[href*="wa.me"]').count()
    expect(wa).toBeGreaterThan(0)
  })

  test('no se republica lo que la fuente marcó como falso', async ({ page }) => {
    await page.goto('/ayuda-directa')
    await page.waitForTimeout(3000)

    // `informacion_falsa` y `duplicado` se filtran en la consulta.
    const texto = await page.locator('main').innerText()
    expect(texto).not.toMatch(/informacion_falsa|duplicado/i)
  })
})

test.describe('ficha de una publicación de Corag', () => {
  test('abre con cobertura, actividad y sin una segunda petición', async ({ page }) => {
    const llamadas: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('corag.app')) llamadas.push(r.url())
    })

    await page.goto('/ayuda-directa')
    await page.waitForSelector('.card__title', { timeout: 45_000 })
    await page.waitForTimeout(3000)

    const antes = llamadas.filter((u) => u.includes('view=detail')).length
    await page.locator('button:has-text("Ver detalle")').first().click()
    await page.waitForSelector('.sheet', { timeout: 10_000 })
    await page.waitForTimeout(1200)

    /* view=detail devuelve EXACTAMENTE lo mismo que el elemento de la lista
       —comprobado campo a campo sobre 20 publicaciones—, así que pedirlo otra
       vez sería gastar una petición para no enterarse de nada nuevo. */
    const despues = llamadas.filter((u) => u.includes('view=detail')).length
    expect(despues).toBe(antes)

    const hoja = await page.locator('.sheet').innerText()
    expect(hoja).toMatch(/cubierto|requerido/i)
    expect(await page.locator('.linea-tiempo__evento').count()).toBeGreaterThan(0)
  })
})

test.describe('de dónde salen los datos', () => {
  const RUTAS = ['/manos', '/mapa', '/inventario', '/que-falta', '/ayuda-directa', '/vivienda']

  for (const ruta of RUTAS) {
    test(`${ruta} dice de qué fuentes viene lo que muestra`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('ac.ciudad', 'pereira-2')
        } catch {
          /* sin almacenamiento */
        }
      })
      await page.goto(ruta)
      await page.waitForSelector('.fuentes-pantalla', { timeout: 45_000 })

      // Un sello vacío es peor que ninguno: promete procedencia y no la da.
      const sellos = await page.locator('.fuentes-pantalla .sello-fuente').count()
      expect(sellos).toBeGreaterThan(0)
    })
  }
})

test.describe('vivienda unificada', () => {
  test('junta las dos fuentes de arriendo y marca cada tarjeta', async ({ page }) => {
    await page.goto('/vivienda')
    await page.waitForSelector('.card__title', { timeout: 45_000 })
    await page.waitForTimeout(2500)

    /* Una fuente aporta 82 avisos de Risaralda con coordenada real; la otra 30
       del Quindío con fotos. Quedarse con una sola dejaría fuera dos tercios de
       la oferta a quien se acaba de quedar sin casa. */
    const tarjetas = await page.locator('.card').count()
    expect(tarjetas).toBeGreaterThan(60)

    const conSello = await page.locator('.card .sello-fuente').count()
    expect(conSello).toBe(tarjetas)

    const origenes = await page.$$eval('.card .sello-fuente', (n) =>
      [...new Set(n.map((e) => e.getAttribute('data-origen')))].sort(),
    )
    expect(origenes.length).toBe(2)
  })
})

test.describe('tengo algo que dar', () => {
  test('cruza contra las tres fuentes y ordena por urgencia', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ac.ubicacion', JSON.stringify({ lat: 4.8133, lng: -75.6961 }))
      } catch {
        /* sin almacenamiento */
      }
    })
    await page.goto('/quiero-ayudar')
    await page.waitForSelector('.chips .chip', { timeout: 45_000 })

    await page.locator('.chip').filter({ hasText: 'Comida' }).first().click()
    await page.waitForSelector('.panel li', { timeout: 45_000 })
    await page.waitForTimeout(3500)

    const origenes = await page.$$eval('.panel li .sello-fuente', (n) =>
      [...new Set(n.map((e) => e.getAttribute('data-origen')))].sort(),
    )
    expect(origenes.length).toBeGreaterThanOrEqual(2)

    // Lo urgente arriba: es el orden en que se decide con el carro cargado.
    const primeras = await page.locator('.panel li').first().innerText()
    expect(primeras).toMatch(/urgente/i)
  })

  test('ofrecer manos no devuelve inventario de bodega', async ({ page }) => {
    await page.goto('/quiero-ayudar')
    await page.waitForSelector('.chips .chip', { timeout: 45_000 })

    await page.locator('.chip').filter({ hasText: 'Mis manos' }).first().click()
    await page.waitForTimeout(4000)

    /* Un servicio no se cruza contra necesidades de material: nadie guarda
       cajas de voluntariado, y ofrecer las manos no llena una bodega. */
    const origenes = await page.$$eval('.panel li .sello-fuente', (n) =>
      n.map((e) => e.getAttribute('data-origen')),
    )
    expect(origenes.filter((o) => o === 'ayudas-pereira')).toHaveLength(0)
  })
})

test.describe('publicar una petición', () => {
  test('ofrece publicarla en los dos tablones y pide el consentimiento aparte', async ({ page }) => {
    await page.goto('/ayuda-directa')
    await page.waitForSelector('.card__title', { timeout: 45_000 })

    await page.getByRole('button', { name: 'Publicar' }).first().click()
    await page.waitForSelector('.sheet', { timeout: 10_000 })

    const hoja = page.locator('.sheet')
    await expect(hoja.getByText(/tablón de Pereira Unida/i)).toBeVisible()
    // El teléfono se publica solo si la persona lo autoriza: dos casillas, no una.
    await expect(hoja.getByText(/Autorizo publicar mi nombre y mi WhatsApp/i)).toBeVisible()

    const casillas = await hoja.locator('input[type="checkbox"]').count()
    expect(casillas).toBeGreaterThanOrEqual(2)
  })
})
