import { test, expect } from '@playwright/test'

/**
 * Protege los dos puntos donde esta app se puede romper de golpe:
 *
 * 1. `centros` tiene los permisos concedidos POR COLUMNA. Si alguien vuelve a
 *    poner `select('*')` o añade `telefono` a la consulta pública, PostgREST
 *    responde 42501 y la pantalla se queda SIN NINGÚN CENTRO. No es un fallo
 *    parcial: se cae toda la vista principal.
 * 2. El acceso por código es el único camino para ver teléfonos.
 */

test.describe('lectura pública de centros', () => {
  test('la consulta de centros no pide columnas restringidas y devuelve datos', async ({ page }) => {
    const consultas: string[] = []
    const estados: number[] = []

    page.on('request', (req) => {
      const u = req.url()
      if (u.includes('/rest/v1/centros')) consultas.push(decodeURIComponent(u))
    })
    page.on('response', async (res) => {
      if (res.url().includes('/rest/v1/centros')) estados.push(res.status())
    })

    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('.card__title', { timeout: 20_000 })

    expect(consultas.length, 'no se consultó la tabla centros').toBeGreaterThan(0)

    for (const c of consultas) {
      expect(c, `sin sesión no se puede pedir "telefono": ${c}`).not.toContain('telefono')
      expect(c, `"select=*" dispara 42501 por el GRANT por columnas: ${c}`).not.toContain('select=*')
    }
    for (const s of estados) {
      expect(s, 'la lectura pública de centros debe responder 200').toBe(200)
    }
  })

  test('se listan centros reales del municipio con su estado', async ({ page }) => {
    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('.card__title', { timeout: 20_000 })

    const tarjetas = page.locator('.card--interactive')
    expect(await tarjetas.count()).toBeGreaterThan(5)

    // Todo centro debe declarar si está abierto o cerrado: es el dato que
    // decide si merece la pena desplazarse hasta allí.
    const primera = tarjetas.first()
    await expect(primera.locator('.badge').first()).toHaveText(/Abierto|Cerrado/)

    // El KPI de abiertos no puede superar al total de centros.
    const texto = await page.locator('.page-header__subtitle').innerText()
    const m = texto.match(/(\d+)\s+centros?\s+abiertos?\s+de\s+(\d+)/i)
    expect(m, `subtítulo inesperado: ${texto}`).not.toBeNull()
    expect(Number(m![1])).toBeLessThanOrEqual(Number(m![2]))
  })

  test('sin sesión no aparece ningún botón de llamar', async ({ page }) => {
    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('.card__title', { timeout: 20_000 })

    await expect(page.getByRole('link', { name: /^Llamar a /i })).toHaveCount(0)
    await expect(page.getByText('Estás viendo sin entrar')).toBeVisible()
  })
})

test.describe('acceso por código', () => {
  test('la hoja de acceso pide correo y luego código', async ({ page }) => {
    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('.page-header__title')

    await page.getByRole('button', { name: 'Entrar' }).first().click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()
    await expect(dialogo.getByLabel('Tu correo')).toBeVisible()

    // El botón de envío permanece deshabilitado hasta que el correo es plausible.
    const enviar = dialogo.getByRole('button', { name: 'Enviarme el código' })
    await expect(enviar).toBeDisabled()
    await dialogo.getByLabel('Tu correo').fill('alguien@ejemplo.com')
    await expect(enviar).toBeEnabled()

    // No se envía de verdad: eso gastaría cuota de correo real del proyecto.
    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()
  })

  test('se puede escribir el correo entero sin perder el foco', async ({ page }) => {
    // Regresión real: el efecto del diálogo dependía de `alCerrar`, que cambia
    // de identidad en cada render. Al teclear, el efecto se remontaba y su
    // limpieza devolvía el foco al botón: solo entraba la primera letra.
    await page.goto('/ciudad/dosquebradas')
    await page.waitForSelector('.page-header__title')
    await page.locator('.notice').getByRole('button', { name: 'Entrar' }).click()

    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()

    const campo = dialogo.getByLabel('Tu correo')
    await campo.click()
    await page.keyboard.type('persona@ejemplo.com', { delay: 25 })

    await expect(campo).toHaveValue('persona@ejemplo.com')
    await expect(campo).toBeFocused()
    await expect(dialogo).toBeVisible()
  })

  test('la app explica qué desbloquea entrar, sin bloquear el resto', async ({ page }) => {
    await page.goto('/acerca')
    await page.waitForSelector('.page-header__title')

    await expect(
      page.getByRole('heading', { name: 'Por qué hay que entrar para ver los teléfonos' }),
    ).toBeVisible()

    // Las tablas públicas siguen leyéndose sin sesión.
    const filas = page.locator('.panel li')
    await expect(filas.filter({ hasText: 'ciudades' }).first()).toContainText('filas')
    await expect(filas.filter({ hasText: 'centros' }).first()).toContainText('filas')
  })
})
