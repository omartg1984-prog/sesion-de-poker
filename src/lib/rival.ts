import type { Calle, TipoMovimiento } from './mano'

/*
 * Cómo juega el de enfrente.
 *
 * Para practicar no sirve un rival que juegue perfecto: en una mesa de casa no hay dos
 * que jueguen igual y es justo eso lo que hay que aprender a leer. Aquí están los tipos
 * de siempre —la roca que sólo entra con manaza, el que paga todo, el que farolea— como
 * cuatro números: qué tan buena pide la mano, qué tan seguido sube, qué tan seguido
 * apuesta sin nada y qué tan seguido paga aunque no le convenga.
 *
 * Nadie juega de un solo modo toda la noche, así que cada rival trae dos y se le sale
 * uno u otro según la mano. Eso es lo que hace que no se le agarre el paso en diez
 * manos, que es como pasa en la mesa de verdad.
 */

export interface Estilo {
  id: string
  nombre: string
  ayuda: string
  /** Cuánto mejor que lo justo tiene que ir para seguir. 1 = lo justo y ya. */
  exigencia: number
  /** Qué tan seguido sube en vez de pagar cuando sí trae. 0 a 1. */
  agresion: number
  /** Qué tan seguido apuesta o sube sin nada. 0 a 1. */
  farol: number
  /** Qué tan seguido paga aunque las cuentas digan que no. 0 a 1. */
  pegajoso: number
}

export const ESTILOS: Estilo[] = [
  {
    id: 'roca',
    nombre: 'Roca',
    ayuda: 'Casi no entra. Si entra, trae algo.',
    exigencia: 1.5,
    agresion: 0.4,
    farol: 0.03,
    pegajoso: 0.05,
  },
  {
    id: 'solido',
    nombre: 'Sólido',
    ayuda: 'Juega bien y sin inventar.',
    exigencia: 1.15,
    agresion: 0.45,
    farol: 0.12,
    pegajoso: 0.12,
  },
  {
    id: 'agresivo',
    nombre: 'Agresivo',
    ayuda: 'Sube mucho y te hace pagar caro.',
    exigencia: 1.0,
    agresion: 0.75,
    farol: 0.25,
    pegajoso: 0.15,
  },
  {
    id: 'farolero',
    nombre: 'Farolero',
    ayuda: 'Apuesta sin nada más seguido que nadie.',
    exigencia: 0.95,
    agresion: 0.5,
    farol: 0.45,
    pegajoso: 0.2,
  },
  {
    id: 'pagador',
    nombre: 'Pagador',
    ayuda: 'Paga casi todo y casi nunca sube.',
    exigencia: 0.8,
    agresion: 0.1,
    farol: 0.04,
    pegajoso: 0.6,
  },
  {
    id: 'tramposo',
    nombre: 'Tramposo',
    ayuda: 'Se hace el muerto con manaza para cobrártela en el river.',
    exigencia: 1.25,
    agresion: 0.2,
    farol: 0.15,
    pegajoso: 0.3,
  },
  {
    id: 'loco',
    nombre: 'Loco',
    ayuda: 'Apuesta con lo que sea. A veces trae.',
    exigencia: 0.65,
    agresion: 0.8,
    farol: 0.55,
    pegajoso: 0.5,
  },
]

export const estiloPorId = (id: string) => ESTILOS.find((e) => e.id === id) ?? ESTILOS[1]

/** Un rival: el modo en el que juega casi siempre y el que se le sale de vez en cuando. */
export interface Rival {
  base: string
  otro: string
  /** Qué tan seguido se le sale el otro. 0 a 1. */
  cambia: number
}

/** Una mesa de rivales distintos entre sí, armada al azar. */
export function rivalesAlAzar(cuantos: number, azar: () => number): Rival[] {
  const salida: Rival[] = []
  for (let i = 0; i < cuantos; i++) {
    const base = ESTILOS[Math.floor(azar() * ESTILOS.length)]
    let otro = ESTILOS[Math.floor(azar() * ESTILOS.length)]
    /* Dos veces el mismo no es "varios estilos", es uno: se vuelve a tirar. */
    if (otro.id === base.id) otro = ESTILOS[(ESTILOS.indexOf(base) + 1) % ESTILOS.length]
    salida.push({ base: base.id, otro: otro.id, cambia: 0.15 + azar() * 0.25 })
  }
  return salida
}

/** Con cuál de sus dos modos viene esta mano. */
export function estiloDeLaMano(r: Rival, azar: () => number): Estilo {
  return estiloPorId(azar() < r.cambia ? r.otro : r.base)
}

export interface Situacion {
  /** Lo que se lleva, de 0 a 100, contra los que siguen vivos. */
  equidad: number
  vivos: number
  bote: number
  /** Lo que le cuesta pagar. 0 = puede pasar. */
  paraIgualar: number
  /** Lo más alto que hay puesto en esta calle. */
  alto: number
  /** El "sube a" más chico que se vale. */
  minimo: number
  calle: Calle
}

export interface Decision {
  tipo: TipoMovimiento
  /** A cuánto deja su apuesta de la calle. Sólo cuenta al apostar o subir. */
  hasta: number
}

/**
 * Qué hace el rival.
 *
 * La cuenta de fondo es la misma que le enseña la app al jugador: lo que se lleva contra
 * lo que le cuesta pagar. Lo que cambia de uno a otro es cuánto margen le pide, qué tan
 * seguido prefiere subir y qué tan seguido se tira un farol o paga por necedad. Sin eso
 * todos jugarían igual y no habría nada que leer.
 */
export function decidir(e: Estilo, s: Situacion, azar: () => number): Decision {
  const justo = 100 / Math.max(2, s.vivos)
  const razon = s.equidad / justo

  /* Lo que apuesta cuando le toca abrir: entre media mesa y tres cuartos del bote, que
     es como se apuesta en una mesa de casa. */
  const apostar = (): Decision => ({
    tipo: 'apuesta',
    hasta: Math.max(s.minimo, Math.round(s.bote * (0.45 + azar() * 0.3))),
  })
  const subir = (): Decision => ({
    tipo: 'sube',
    hasta: Math.max(s.minimo, Math.round(s.alto * (2.2 + azar() * 1.4))),
  })

  /* Nadie apuesta en el river con una mano que no gana nada: ahí el farol es lo único
     que queda, y eso ya lo decide `farol`. */
  if (s.paraIgualar <= 0) {
    if (razon >= e.exigencia && azar() < e.agresion) return apostar()
    if (azar() < e.farol * (s.calle === 'preflop' ? 0.5 : 1)) return apostar()
    return { tipo: 'pasa', hasta: s.alto }
  }

  /* Con algo que pagar manda la cuenta del bote: lo que le cuesta contra lo que se
     puede llevar. Encima de eso, cada quien pide su margen. */
  const necesita = (s.paraIgualar / (s.bote + s.paraIgualar)) * 100
  const holgura = s.equidad / Math.max(necesita, 0.001)

  if (holgura >= 1.5 && razon >= e.exigencia && azar() < e.agresion) return subir()
  if (azar() < e.farol * 0.35 && s.calle !== 'preflop') return subir()
  if (holgura >= 1) return { tipo: 'paga', hasta: s.alto }
  if (azar() < e.pegajoso) return { tipo: 'paga', hasta: s.alto }
  return { tipo: 'seVa', hasta: 0 }
}
