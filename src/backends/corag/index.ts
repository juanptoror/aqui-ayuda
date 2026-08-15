import type { Backend } from '@/backends/contrato'

export * from './ayudas'

/**
 * Backend "Corag".
 *
 * Aporta ayuda directa entre personas. No expone municipios ni centros, y eso
 * no es una carencia: es su naturaleza. Por eso el contrato tiene todos los
 * métodos opcionales y la UI pregunta por capacidades antes de ofrecer nada.
 */
export const corag: Backend = {
  descripcion: {
    id: 'corag',
    nombre: 'Corag',
    tipo: 'Ayuda entre personas',
    descripcion: 'Personas concretas que piden u ofrecen algo, con su WhatsApp.',
    quienPublica: 'Cualquier persona, sin registrarse.',
    url: 'https://ayuda.corag.app',
    capacidades: ['leer:ayuda-directa', 'escribir:ayuda-directa'],
  },

  // Corag no sirve el catálogo de municipios ni los centros de acopio.
  leer: {},
  escribir: {},
}
