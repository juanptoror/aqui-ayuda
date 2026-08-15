import type {
  Centro,
  Ciudad,
  EstadoTransporte,
  ItemInventario,
  Necesidad,
  Prioridad,
  Transporte,
  Vehiculo,
  Voluntario,
} from '@/dominio/modelos'
import type {
  BorradorOfrecimiento,
  BorradorTransporte,
  BorradorVehiculo,
  BorradorVoluntario,
} from '@/backends/contrato'
import type {
  CuerpoOfrecimiento,
  CuerpoTransporte,
  CuerpoVehiculo,
  CuerpoVoluntario,
  FilaCentro,
  FilaCiudad,
  FilaInventario,
  FilaNecesidad,
  FilaTransporte,
  FilaVehiculo,
  FilaVoluntario,
} from './esquema'

/**
 * Traducción entre el esquema de Ayudas Pereira y el dominio de la app.
 *
 * Aquí se limpia la suciedad del origen: los nombres y direcciones llegan con
 * espacios sobrantes del formulario de captura, y hacerlo en cada vista sería
 * repetirlo en diez sitios y olvidarlo en el undécimo.
 */

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

export function aCiudad(f: FilaCiudad): Ciudad {
  return {
    id: f.id,
    nombre: f.nombre?.trim() ?? '',
    departamento: f.departamento?.trim() ?? '',
    slug: f.slug,
    activa: f.activa,
    fusionadaEn: f.fusionada_en,
  }
}

export function aCentro(f: FilaCentro): Centro {
  return {
    id: f.id,
    ciudadId: f.ciudad_id,
    nombre: limpio(f.nombre) ?? 'Centro sin nombre',
    direccion: limpio(f.direccion),
    responsable: limpio(f.responsable),
    notas: limpio(f.notas),
    activo: f.activo,
    abierto: f.abierto,
    // Coordenadas fuera de rango se descartan: mandar a alguien a un punto
    // equivocado es peor que no mostrar distancia.
    lat: f.lat != null && Math.abs(f.lat) <= 90 ? f.lat : null,
    lng: f.lng != null && Math.abs(f.lng) <= 180 ? f.lng : null,
    foto: limpio(f.foto),
    ...(f.telefono !== undefined ? { telefono: limpio(f.telefono) } : {}),
  }
}

const PRIORIDADES: Prioridad[] = ['urgente', 'alta', 'normal']

export function aNecesidad(f: FilaNecesidad): Necesidad {
  return {
    id: f.id,
    centroId: f.centro_id,
    categoria: f.categoria?.trim() ?? 'Otros',
    descripcion: limpio(f.descripcion),
    prioridad: PRIORIDADES.includes(f.prioridad as Prioridad)
      ? (f.prioridad as Prioridad)
      : 'normal',
    estado: f.estado === 'cubierta' ? 'cubierta' : 'pendiente',
    creadaEn: f.created_at,
  }
}

export function aItemInventario(f: FilaInventario): ItemInventario {
  return {
    id: f.id,
    centroId: f.centro_id,
    categoria: f.categoria?.trim() ?? 'Otros',
    cantidad: Number(f.cantidad) || 0,
    unidad: f.unidad?.trim() || 'unidades',
    actualizadoEn: f.updated_at,
  }
}

const ESTADOS_TRANSPORTE: EstadoTransporte[] = [
  'programado',
  'en_ruta',
  'entregado',
  'cancelado',
]

export function aTransporte(f: FilaTransporte): Transporte {
  return {
    id: f.id,
    ciudadId: f.ciudad_id,
    origenId: f.origen_id,
    destinoId: f.destino_id,
    destinoTexto: limpio(f.destino_texto),
    carga: limpio(f.carga),
    vehiculo: limpio(f.vehiculo),
    conductor: limpio(f.conductor),
    estado: ESTADOS_TRANSPORTE.includes(f.estado as EstadoTransporte)
      ? (f.estado as EstadoTransporte)
      : 'programado',
    salida: f.salida,
    notas: limpio(f.notas),
    creadoEn: f.created_at,
  }
}

/** El backend guarda las listas como texto separado por comas. */
function aLista(v: string | null): string[] {
  return (v ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function aVoluntario(f: FilaVoluntario): Voluntario {
  return {
    id: f.id,
    ciudadId: f.ciudad_id,
    centroId: f.centro_id,
    nombre: limpio(f.nombre) ?? 'Sin nombre',
    puedeAyudarEn: aLista(f.puede_ayudar_en),
    disponibilidad: aLista(f.disponibilidad),
    notas: limpio(f.notas),
    disponible: f.disponible,
  }
}

export function aVehiculo(f: FilaVehiculo): Vehiculo {
  return {
    id: f.id,
    ciudadId: f.ciudad_id,
    nombre: limpio(f.nombre) ?? 'Sin nombre',
    vehiculo: limpio(f.vehiculo) ?? 'Vehículo sin detallar',
    capacidad: limpio(f.capacidad),
    zona: limpio(f.zona),
    disponible: f.disponible,
  }
}

/* ------------------------------- Escrituras -------------------------------- */

export function deOfrecimiento(b: BorradorOfrecimiento): CuerpoOfrecimiento {
  return {
    centro_id: b.centroId,
    ciudad_id: b.ciudadId,
    necesidad_id: b.necesidadId,
    categoria: b.categoria,
    descripcion: b.descripcion.trim(),
    nombre: b.nombre.trim(),
    telefono: b.telefono.trim(),
    // Si la persona lo lleva ella misma, no hay dirección de recogida que dar.
    direccion_recogida: b.necesitaTransporte ? b.direccionRecogida.trim() : '',
    necesita_transporte: b.necesitaTransporte,
    estado: 'ofrecido',
  }
}

export function deVoluntario(b: BorradorVoluntario, usuarioId: string): CuerpoVoluntario {
  return {
    ciudad_id: b.ciudadId,
    centro_id: b.centroId,
    usuario_id: usuarioId,
    nombre: b.nombre.trim(),
    telefono: b.telefono.trim(),
    // El backend guarda estas listas como texto separado por comas.
    puede_ayudar_en: b.puedeAyudarEn.join(', '),
    disponibilidad: b.disponibilidad.join(', '),
    notas: b.notas.trim(),
    disponible: true,
  }
}

export function deVehiculo(b: BorradorVehiculo, usuarioId: string): CuerpoVehiculo {
  return {
    ciudad_id: b.ciudadId,
    usuario_id: usuarioId,
    nombre: b.nombre.trim(),
    telefono: b.telefono.trim(),
    vehiculo: b.vehiculo.trim(),
    capacidad: b.capacidad.trim(),
    zona: b.zona.trim(),
    disponible: true,
  }
}

export function deTransporte(b: BorradorTransporte, ahora: string): CuerpoTransporte {
  return {
    ciudad_id: b.ciudadId,
    origen_id: b.origenId,
    destino_id: b.destinoId,
    destino_texto: b.destinoTexto.trim(),
    carga: b.carga.trim(),
    vehiculo: b.vehiculo.trim(),
    conductor: b.conductor.trim(),
    telefono: b.telefono.trim(),
    salida: b.salida,
    notas: b.notas.trim(),
    estado: 'programado',
    updated_at: ahora,
  }
}
