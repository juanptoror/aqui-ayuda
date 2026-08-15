import { test, expect, type Page } from '@playwright/test'

/**
 * Filtros y formularios de participación.
 *
 * Los envíos NO llegan al servidor: se interceptan y se comprueba el cuerpo.
 * Publicar de verdad crearía registros basura en una base que se está usando
 * para coordinar una emergencia real, y eso no se hace para pasar un test.
 */

async function abrirCiudad(page: Page) {
  await page.goto('/ciudad/dosquebradas')
  await page.waitForSelector('[data-tipo="centro"]', { timeout: 25_000 })
}

test.describe('filtros del municipio', () => {
  test('los KPIs filtran la lista al pulsarlos', async ({ page }) => {
    await abrirCiudad(page)

    const tarjetas = page.locator('[data-tipo="centro"]')
    const total = await tarjetas.count()
    expect(total).toBeGreaterThan(1)

    // Se apunta al KPI por su clase y no por su texto: al filtrar aparece un
    // botón "Quitar filtro (con pedidos urgentes)" que también contiene la
    // palabra, y buscar por nombre encontraría dos.
    const kpiUrgentes = page.locator('.kpi--pulsable').filter({ hasText: 'URGENTES' })

    // "Urgentes" deja solo los centros con al menos un pedido urgente.
    await kpiUrgentes.click()
    await expect(kpiUrgentes).toHaveAttribute('aria-pressed', 'true')

    const filtrados = await tarjetas.count()
    expect(filtrados).toBeGreaterThan(0)
    expect(filtrados, 'el filtro debería reducir la lista').toBeLessThan(total)

    // Todas las visibles llevan la insignia de urgentes.
    for (let i = 0; i < filtrados; i++) {
      await expect(tarjetas.nth(i).locator('.badge--critical')).toHaveCount(1)
    }

    // Volver a pulsarlo lo desactiva: es un interruptor, no un callejón.
    await kpiUrgentes.click()
    await expect(tarjetas).toHaveCount(total)
  })

  test('se puede quitar el filtro desde la cabecera de la lista', async ({ page }) => {
    await abrirCiudad(page)
    const total = await page.locator('[data-tipo="centro"]').count()

    await page.locator('.kpi--pulsable').filter({ hasText: 'ABIERTOS' }).click()
    await page.getByRole('button', { name: /Quitar filtro/ }).click()

    await expect(page.locator('[data-tipo="centro"]')).toHaveCount(total)
  })
})

test.describe('ofrecer una donación', () => {
  test('envía lo que se rellenó y confirma sin jerga', async ({ page }) => {
    let cuerpo: Record<string, unknown> | null = null

    // Se intercepta el alta: no queremos crear un registro real.
    await page.route('**/rest/v1/ofrecimientos**', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        cuerpo = JSON.parse(ruta.request().postData() ?? '{}')
        await ruta.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
        return
      }
      await ruta.continue()
    })

    await abrirCiudad(page)
    await page.getByRole('button', { name: 'Tengo algo para donar' }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()

    await dialogo.getByLabel('¿Qué puedes aportar?').fill('20 paquetes de pañales etapa 3')
    await dialogo.getByLabel('Tu nombre').fill('Persona de prueba')
    await dialogo.getByLabel('Tu teléfono').fill('3001234567')
    await dialogo.getByRole('tab', { name: 'Necesito que lo recojan' }).click()
    await dialogo.getByLabel('¿Dónde se recoge?').fill('Barrio Álamos, Cra. 30 #12-40')

    await dialogo.getByRole('button', { name: 'Ofrecer' }).click()

    await expect(page.getByText('Tu ofrecimiento quedó publicado')).toBeVisible()

    expect(cuerpo, 'no se envió nada').not.toBeNull()
    const enviado = cuerpo as unknown as Record<string, unknown>
    expect(enviado.descripcion).toBe('20 paquetes de pañales etapa 3')
    expect(enviado.telefono).toBe('3001234567')
    expect(enviado.necesita_transporte).toBe(true)
    expect(enviado.direccion_recogida).toBe('Barrio Álamos, Cra. 30 #12-40')
    expect(enviado.estado).toBe('ofrecido')
    // La ciudad se rellena sola: la persona no tiene que saber su identificador.
    expect(String(enviado.ciudad_id ?? '')).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('si lo lleva la persona, no se pide ni se envía dirección de recogida', async ({ page }) => {
    let cuerpo: Record<string, unknown> | null = null
    await page.route('**/rest/v1/ofrecimientos**', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        cuerpo = JSON.parse(ruta.request().postData() ?? '{}')
        await ruta.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
        return
      }
      await ruta.continue()
    })

    await abrirCiudad(page)
    await page.getByRole('button', { name: 'Tengo algo para donar' }).click()

    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('¿Qué puedes aportar?').fill('Cinco cobijas')
    await dialogo.getByLabel('Tu nombre').fill('Persona de prueba')
    await dialogo.getByLabel('Tu teléfono').fill('3001234567')

    // "Yo lo llevo" viene por defecto: no debe aparecer el campo de recogida.
    await expect(dialogo.getByLabel('¿Dónde se recoge?')).toHaveCount(0)
    await dialogo.getByRole('button', { name: 'Ofrecer' }).click()

    await expect(page.getByText('Tu ofrecimiento quedó publicado')).toBeVisible()
    const enviado = cuerpo as unknown as Record<string, unknown>
    expect(enviado.necesita_transporte).toBe(false)
    expect(enviado.direccion_recogida).toBe('')
  })

  test('un fallo del servidor se explica sin tecnicismos y con código', async ({ page }) => {
    await page.route('**/rest/v1/ofrecimientos**', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        await ruta.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST500', message: 'internal server error' }),
        })
        return
      }
      await ruta.continue()
    })

    await abrirCiudad(page)
    await page.getByRole('button', { name: 'Tengo algo para donar' }).click()

    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('¿Qué puedes aportar?').fill('Cinco cobijas')
    await dialogo.getByLabel('Tu nombre').fill('Persona de prueba')
    await dialogo.getByLabel('Tu teléfono').fill('3001234567')
    await dialogo.getByRole('button', { name: 'Ofrecer' }).click()

    const aviso = dialogo.locator('.notice[role="alert"]')
    await expect(aviso).toBeVisible()

    // Hay código de soporte y NO hay jerga.
    await expect(aviso.locator('.codigo-soporte')).toHaveText(/^[A-Z]{2,3}-[A-Z0-9]{4}$/)
    const texto = (await aviso.innerText()).toLowerCase()
    for (const jerga of ['pgrst', 'postgrest', '500', 'internal server', 'supabase']) {
      expect(texto, `"${jerga}" no debería mostrarse al usuario`).not.toContain(jerga)
    }
  })
})

test.describe('inventario del municipio', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('cada categoría dice dónde está y quién la pide', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ac.ciudad', 'dosquebradas')
      } catch {
        /* sin almacenamiento */
      }
    })
    await page.goto('/inventario')
    await page.waitForSelector('.panel li button[aria-expanded]', { timeout: 25_000 })

    const categorias = page.locator('.panel li button[aria-expanded]')
    expect(await categorias.count()).toBeGreaterThan(0)

    // Cerrada por defecto: la lista completa cabe en una pantalla.
    await expect(categorias.first()).toHaveAttribute('aria-expanded', 'false')

    await categorias.first().click()
    await expect(categorias.first()).toHaveAttribute('aria-expanded', 'true')

    // Al abrir aparecen las dos mitades que dan sentido a la pantalla.
    await expect(page.getByText('Dónde está').first()).toBeVisible()
    await expect(page.getByText('Quién lo pide').first()).toBeVisible()
  })

  test('el formulario de transporte solo ofrece carga del origen elegido', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ac.ciudad', 'dosquebradas')
      } catch {
        /* sin almacenamiento */
      }
    })
    await page.goto('/inventario')
    await page.waitForSelector('.page-header__title')
    await page.getByRole('button', { name: 'Nuevo transporte' }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()

    // Sin origen, la carga no se puede elegir: evita programar un viaje por
    // algo que ese centro no tiene.
    await expect(dialogo.getByLabel('Qué lleva')).toBeDisabled()
    await expect(dialogo.getByText(/Elige primero de dónde sale/)).toBeVisible()
  })
})

test.describe('acciones sobre un centro', () => {
  test('cada necesidad se puede cubrir desde la ficha, y se puede pedir unirse', async ({
    page,
  }) => {
    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('[data-tipo="centro"]', { timeout: 25_000 })
    await page.locator('.card__link').first().click()
    await page.waitForURL(/\/centro\//)
    await page.waitForSelector('.page-header__title')

    await expect(page.getByRole('button', { name: /Unirme al equipo/ })).toBeVisible()

    const yoTengo = page.getByRole('button', { name: 'Yo tengo' })
    expect(await yoTengo.count()).toBeGreaterThan(0)

    // Al ofrecer contra una necesidad, la categoría ya viene decidida y no se
    // vuelve a preguntar.
    await yoTengo.first().click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()
    await expect(dialogo.getByLabel('¿Qué tipo de ayuda es?')).toHaveCount(0)
    await expect(dialogo.getByLabel('¿Qué puedes aportar?')).toBeVisible()
  })
})

test.describe('voluntariado y vehículo', () => {
  test('sin sesión se avisa antes de rellenar, no después', async ({ page }) => {
    await abrirCiudad(page)

    await page.getByRole('button', { name: /Quiero poner las manos/ }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()

    // El aviso está arriba y el botón principal lleva a entrar, no a enviar.
    await expect(dialogo.getByText(/hace falta entrar con tu correo/i)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: 'Entrar para inscribirme' })).toBeVisible()
    await expect(dialogo.getByLabel('Tu nombre')).toBeDisabled()
  })

  test('el formulario de vehículo pide lo mínimo para poder llamar', async ({ page }) => {
    await abrirCiudad(page)
    await page.getByRole('button', { name: /Pongo mi carro/ }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByLabel('Tu nombre')).toBeVisible()
    await expect(dialogo.getByLabel('Tu teléfono')).toBeVisible()
    await expect(dialogo.getByLabel('¿Qué vehículo tienes?')).toBeVisible()
  })
})
