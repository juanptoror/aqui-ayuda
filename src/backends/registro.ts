import type { Backend, Capacidad, IdBackend } from './contrato'
import { ayudasPereira } from './ayudas-pereira'
import { corag } from './corag'

/**
 * Registro de backends conectados.
 *
 * Añadir uno nuevo son tres pasos y ninguno toca la interfaz:
 *   1. Crear `src/backends/<nombre>/` con cliente, esquema y mapeadores.
 *   2. Exportar un objeto que cumpla `Backend` y declare sus capacidades.
 *   3. Añadirlo a esta lista.
 *
 * Las pantallas preguntan "¿quién sabe leer municipios?" en vez de importar un
 * backend por su nombre, así que nada se rompe al sumar o quitar proveedores.
 */
export const BACKENDS: readonly Backend[] = [ayudasPereira, corag]

export function backendPorId(id: IdBackend): Backend {
  const encontrado = BACKENDS.find((b) => b.descripcion.id === id)
  if (!encontrado) throw new Error(`Backend no registrado: ${id}`)
  return encontrado
}

/** Backends capaces de algo concreto, en orden de registro. */
export function backendsCon(capacidad: Capacidad): Backend[] {
  return BACKENDS.filter((b) => b.descripcion.capacidades.includes(capacidad))
}

/**
 * El primero capaz de algo. Se usa donde hoy solo hay un proveedor posible
 * (por ejemplo, el catálogo de municipios) sin dejarlo atado a su nombre.
 */
export function backendPrincipalPara(capacidad: Capacidad): Backend | null {
  return backendsCon(capacidad)[0] ?? null
}

export function hayCapacidad(capacidad: Capacidad): boolean {
  return backendsCon(capacidad).length > 0
}
