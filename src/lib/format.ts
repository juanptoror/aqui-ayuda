/** Formateo en español de Colombia. Todo texto visible pasa por aquí. */

const fmtNumero = new Intl.NumberFormat('es-CO')

export function numero(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return fmtNumero.format(n)
}

/** "hace 5 minutos", "hace 2 días". El dato crudo no dice si está vigente. */
export function desde(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'sin fecha'

  const segundos = Math.round((Date.now() - t) / 1000)
  if (segundos < 60) return 'hace un momento'

  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} ${plural(minutos, 'minuto', 'minutos')}`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} ${plural(horas, 'hora', 'horas')}`

  const dias = Math.round(horas / 24)
  if (dias < 30) return `hace ${dias} ${plural(dias, 'día', 'días')}`

  const meses = Math.round(dias / 30)
  return `hace ${meses} ${plural(meses, 'mes', 'meses')}`
}

export function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_
}

/** "3 centros" / "1 centro" — evita el "1 centros" que delata software descuidado. */
export function conteo(n: number, singular: string, plural_: string): string {
  return `${numero(n)} ${plural(n, singular, plural_)}`
}

/** Enlace de navegación que funciona en Android, iOS y escritorio. */
export function enlaceMapa(
  lat: number | null,
  lng: number | null,
  direccion: string | null,
): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  if (direccion) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
  }
  return null
}

/** Deja el teléfono marcable aunque venga con espacios, guiones o paréntesis. */
export function enlaceTelefono(telefono: string | null): string | null {
  if (!telefono) return null
  const limpio = telefono.replace(/[^\d+]/g, '')
  return limpio.length >= 7 ? `tel:${limpio}` : null
}
