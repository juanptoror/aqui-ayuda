import type { Coordenada } from '@/types'

/**
 * Distancia sobre la superficie terrestre (haversine), en kilómetros.
 * Precisión más que suficiente para ordenar centros de acopio por cercanía.
 */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const R = 6371
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const lat1 = rad(a.lat)
  const lat2 = rad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Coordenadas de los municipios presentes en la tabla `ciudades`.
 *
 * La tabla no guarda lat/lng, así que sin este catálogo no existe el
 * "ordenar por cercanía" que pide el producto. Las veredas y corregimientos
 * sin ubicación fiable se omiten a propósito: la UI los muestra sin distancia
 * en lugar de inventarles una posición.
 */
export const COORDENADAS_CIUDAD: Record<string, Coordenada> = {
  // --- Risaralda (zona más afectada) ---
  dosquebradas: { lat: 4.834, lng: -75.6733 },
  'pereira-2': { lat: 4.8133, lng: -75.6961 },
  pereira: { lat: 4.8133, lng: -75.6961 },
  'santa-rosa-de-cabal': { lat: 4.8695, lng: -75.6217 },
  'la-virginia': { lat: 4.8977, lng: -75.8814 },
  marsella: { lat: 4.9366, lng: -75.7397 },
  santuario: { lat: 5.0742, lng: -75.9636 },
  apia: { lat: 5.1064, lng: -75.9411 },
  balboa: { lat: 4.95, lng: -75.9578 },
  'belen-de-umbria': { lat: 5.2003, lng: -75.8672 },
  guatica: { lat: 5.3167, lng: -75.8 },
  quinchia: { lat: 5.34, lng: -75.73 },
  'pueblo-rico': { lat: 5.2214, lng: -76.0322 },
  'la-celia': { lat: 5.0031, lng: -76.0031 },
  altagracias: { lat: 4.7597, lng: -75.7797 },
  'altagracia-vereda-alegrias-y-yarumal': { lat: 4.7597, lng: -75.7797 },
  arabia: { lat: 4.7, lng: -75.75 },

  // --- Caldas ---
  manizales: { lat: 5.0703, lng: -75.5138 },
  anserma: { lat: 5.2333, lng: -75.7833 },
  riosucio: { lat: 5.4225, lng: -75.7031 },
  villamaria: { lat: 5.0428, lng: -75.5111 },
  viterbo: { lat: 5.0625, lng: -75.8719 },
  'san-jose': { lat: 5.0819, lng: -75.7897 },

  // --- Quindío ---
  armenia: { lat: 4.5339, lng: -75.6811 },
  salento: { lat: 4.6372, lng: -75.5703 },
  filandia: { lat: 4.6742, lng: -75.6597 },
  quimbaya: { lat: 4.6222, lng: -75.7639 },
  montenegro: { lat: 4.5658, lng: -75.7494 },

  // --- Valle del Cauca ---
  cali: { lat: 3.4516, lng: -76.532 },
  cartago: { lat: 4.7469, lng: -75.9114 },
  'anserma-nuevo': { lat: 4.7961, lng: -75.9931 },
  'el-billar-corregimiento-de-ansermanuevo': { lat: 4.7961, lng: -75.9931 },
  tulua: { lat: 4.0847, lng: -76.1954 },
  buga: { lat: 3.9006, lng: -76.2978 },
  palmira: { lat: 3.5394, lng: -76.3036 },
  zarzal: { lat: 4.3939, lng: -76.0714 },
  roldanillo: { lat: 4.4131, lng: -76.1544 },
  sevilla: { lat: 4.2711, lng: -75.9364 },
  caicedonia: { lat: 4.3336, lng: -75.8317 },
  toro: { lat: 4.6111, lng: -76.08 },
  ulloa: { lat: 4.7031, lng: -75.7369 },
  'obando-valle': { lat: 4.5761, lng: -75.9761 },
  'el-dovio': { lat: 4.5106, lng: -76.235 },
  'el-cairo': { lat: 4.7597, lng: -76.2222 },
  cairo: { lat: 4.7597, lng: -76.2222 },
  'el-aguila': { lat: 4.9078, lng: -76.0069 },
  argelia: { lat: 4.7261, lng: -76.1189 },
  bolivar: { lat: 4.3389, lng: -76.1858 },
  restrepo: { lat: 3.8203, lng: -76.5233 },
  'calima-darien': { lat: 3.9231, lng: -76.4903 },
  buenaventura: { lat: 3.8801, lng: -77.0312 },
  'congal-bajo-alcala': { lat: 4.6733, lng: -75.7797 },

  // --- Antioquia ---
  medellin: { lat: 6.2442, lng: -75.5812 },
  bello: { lat: 6.3378, lng: -75.5553 },
  'la-ceja': { lat: 6.0289, lng: -75.4297 },
  abejorral: { lat: 5.7897, lng: -75.4283 },

  // --- Resto del país ---
  'bogota-d-c': { lat: 4.711, lng: -74.0721 },
  ibague: { lat: 4.4389, lng: -75.2322 },
  chaparral: { lat: 3.7233, lng: -75.4844 },
  pitalito: { lat: 1.8514, lng: -76.0508 },
  pasto: { lat: 1.2136, lng: -77.2811 },
  bucaramanga: { lat: 7.1193, lng: -73.1227 },
  barrancabermeja: { lat: 7.0653, lng: -73.8547 },
  barranquilla: { lat: 10.9685, lng: -74.7813 },
  sincelejo: { lat: 9.3047, lng: -75.3978 },
  riohacha: { lat: 11.5444, lng: -72.9072 },
  villavicencio: { lat: 4.142, lng: -73.6266 },
  duitama: { lat: 5.8245, lng: -73.0342 },
  zipaquira: { lat: 5.0221, lng: -74.0048 },
  cajica: { lat: 4.9181, lng: -74.0258 },
  tado: { lat: 5.2647, lng: -76.5614 },
}

export function coordenadaDeCiudad(slug: string): Coordenada | null {
  return COORDENADAS_CIUDAD[slug] ?? null
}

/** "1,2 km" / "850 m" / "—" — nunca un número crudo sin unidad. */
export function formatearDistancia(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return '—'
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

export type EstadoUbicacion =
  | { estado: 'inactiva' }
  | { estado: 'pidiendo' }
  | { estado: 'lista'; coordenada: Coordenada; fuente: 'gps' | 'ciudad' }
  | { estado: 'error'; motivo: string }

/**
 * Geolocalización con un tiempo máximo propio: el navegador puede quedarse
 * esperando indefinidamente si el usuario ignora el diálogo de permiso, y una
 * pantalla bloqueada en "buscando…" es inaceptable en una emergencia.
 */
export function obtenerUbicacion(timeoutMs = 8000): Promise<Coordenada> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este dispositivo no permite compartir la ubicación.'))
      return
    }

    let resuelto = false
    const temporizador = window.setTimeout(() => {
      if (!resuelto) {
        resuelto = true
        reject(new Error('La ubicación tardó demasiado. Elige tu ciudad a mano.'))
      }
    }, timeoutMs)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resuelto) return
        resuelto = true
        window.clearTimeout(temporizador)
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        if (resuelto) return
        resuelto = true
        window.clearTimeout(temporizador)
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'No diste permiso de ubicación. Elige tu ciudad a mano.'
              : 'No se pudo obtener tu ubicación. Elige tu ciudad a mano.',
          ),
        )
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    )
  })
}
