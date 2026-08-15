import { defineConfig, devices } from '@playwright/test'

/**
 * Los tests corren contra el servidor de desarrollo en el puerto fijo 5180.
 * `reuseExistingServer` evita levantar un segundo Vite si ya hay uno abierto.
 */
/**
 * Por defecto los tests corren contra el servidor de desarrollo (puerto 5180).
 * Con BASE_URL apuntando a otra parte —por ejemplo el `vite preview` del build
 * de producción— se ejecutan contra ese servidor y no se levanta ninguno:
 *
 *   npm run build
 *   npm run preview            (en otra terminal)
 *   BASE_URL=http://localhost:4180 npx playwright test
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:5180'
const usaServidorExterno = !!process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: usaServidorExterno
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5180',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
