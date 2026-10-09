/*
 * Cómo se fue jugando una mano: quién puso qué y en qué momento.
 *
 * El simulador sabía decir "ganas el 40%", que es media respuesta: en la mesa lo que se
 * decide es si pagar lo que te están pidiendo, y eso depende de cuánto hay en el bote y
 * de cuánta gente sigue viva. Aquí se arma la mano movimiento por movimiento —ciegas,
 * quién subió, quién se fue— y de ahí salen las dos cosas que faltaban: el bote en cada
 * momento y contra cuántos vas de verdad.
 *
 * Los asientos se cuentan desde el botón, igual que en `asientosDe`: el 0 es el botón, el
 * 1 la ciega chica y el 2 la grande. Con dos jugadores el botón es la ciega chica, que es
 * como se juega de a dos.
 *
 * No hay fichas contadas: nadie se queda sin, nadie se va all-in. Es un repaso de la mano,
 * no una partida, y meter stacks sólo serviría para que la app te diga que no puedes.
 */

export type Calle = 'preflop' | 'flop' | 'turn' | 'river'

export const CALLES: Calle[] = ['preflop', 'flop', 'turn', 'river']

export const NOMBRE_CALLE: Record<Calle, string> = {
  preflop: 'Antes del flop',
  flop: 'En el flop',
  turn: 'En el turn',
  river: 'En el river',
}

export type TipoMovimiento = 'ciega' | 'pasa' | 'paga' | 'apuesta' | 'sube' | 'seVa'

export interface Movimiento {
  jugador: number
  calle: Calle
  tipo: TipoMovimiento
  /** Lo que soltó en este movimiento. */
  monto: number
  /** A cuánto queda su apuesta en esta calle. */
  hasta: number
}

export interface ConfigMano {
  jugadores: number
  ciegaChica: number
  ciegaGrande: number
  /*
   * Lo que trae cada quien enfrente. Sin esto todos traen de sobra, que es lo que hace
   * falta para repasar una mano de la mesa: ahí las fichas ya se vieron y lo que se
   * quiere saber es otra cosa. Entrenando sí se ponen, porque sin ellas pagar nunca
   * duele y no se aprende nada.
   */
  fichas?: number[]
}

export interface Mano {
  cfg: ConfigMano
  calle: Calle
  /** Lo puesto en esta calle, por asiento. */
  puesto: number[]
  /** Lo puesto en toda la mano, por asiento. */
  total: number[]
  vivo: boolean[]
  /** Si ya habló en esta calle. Las ciegas no cuentan como hablar. */
  actuo: boolean[]
  /** Lo que le queda enfrente a cada quien. Infinito cuando se juega sin fichas. */
  resto: number[]
  /** A quién le toca, o null si la mano se acabó. */
  turno: number | null
  movimientos: Movimiento[]
  terminada: boolean
}

/** Lo que hay en el bote, contando lo de esta calle. */
export const bote = (m: Mano) => m.total.reduce((a, b) => a + b, 0)

/** Los que siguen en la mano. */
export const siguenVivos = (m: Mano) => m.vivo.filter(Boolean).length

/** Lo que le cuesta pagar al que habla. */
export function paraIgualar(m: Mano): number {
  if (m.turno === null) return 0
  return Math.max(...m.puesto) - m.puesto[m.turno]
}

export interface Opciones {
  /** Si puede pasar sin poner nada. */
  pasa: boolean
  /** Lo que le cuesta pagar, o 0 si no hay nada que pagar. */
  paga: number
  /** El "sube a" más chico que se vale. */
  minimo: number
  /** Lo más a lo que puede subir: todo lo que trae. */
  maximo: number
  /** Nadie ha apostado todavía en esta calle: lo suyo sería apostar, no subir. */
  esApuesta: boolean
  /** Pagar le deja sin nada enfrente. */
  pagarEsTodo: boolean
}

export function opciones(m: Mano): Opciones | null {
  if (m.turno === null || m.terminada) return null
  const t = m.turno
  const alto = Math.max(...m.puesto)
  /* Nadie puede poner lo que no trae: lo que le falte lo cubre con lo que le queda y se
     queda sin fichas, que es lo que de verdad pasa en la mesa. */
  const falta = Math.min(alto - m.puesto[t], m.resto[t])
  const maximo = m.puesto[t] + m.resto[t]
  return {
    pasa: alto - m.puesto[t] === 0,
    paga: falta,
    /* Subir es al menos otra ciega grande encima de lo que haya; apostar de cero es al
       menos una ciega grande. Si no le alcanza para tanto, puede irse con todo. */
    minimo: Math.min(alto + m.cfg.ciegaGrande, maximo),
    maximo,
    esApuesta: alto === 0,
    pagarEsTodo: falta > 0 && falta >= m.resto[t],
  }
}

/** Si ya no trae nada enfrente: sigue en la mano pero ya no habla. */
export const estaConTodo = (m: Mano, s: number) => m.vivo[s] && m.resto[s] <= 0

/** Los que todavía pueden apostar algo. */
const puedenHablar = (m: Mano) =>
  m.vivo.filter((v, s) => v && m.resto[s] > 0).length

/** Quién habla primero del flop en adelante: la ciega chica, o el que siga vivo. */
function primeroDespues(m: Mano): number | null {
  for (let k = 0; k < m.cfg.jugadores; k++) {
    const s = (1 + k) % m.cfg.jugadores
    if (m.vivo[s] && m.resto[s] > 0) return s
  }
  return null
}

function cerrarCalle(m: Mano): Mano {
  const i = CALLES.indexOf(m.calle)
  if (i >= CALLES.length - 1) return { ...m, turno: null, terminada: true }
  const siguiente: Mano = {
    ...m,
    calle: CALLES[i + 1],
    puesto: m.puesto.map(() => 0),
    actuo: m.actuo.map(() => false),
  }
  const quien = primeroDespues(siguiente)
  /*
   * Con uno solo que pueda apostar ya no hay nada que hablar: los demás se fueron con
   * todo y lo que falta es ver las cartas. Se siguen cerrando calles hasta el river para
   * que salgan las cinco, que es lo que decide quién se lleva el bote.
   */
  if (quien === null || puedenHablar(siguiente) <= 1) return cerrarCalle(siguiente)
  return { ...siguiente, turno: quien }
}

function avanzar(m: Mano): Mano {
  /* Si sólo queda uno ya no hay nada que hablar: el bote es suyo. */
  if (siguenVivos(m) <= 1) return { ...m, turno: null, terminada: true }

  const alto = Math.max(...m.puesto)
  const desde = m.turno ?? 0
  for (let k = 1; k <= m.cfg.jugadores; k++) {
    const s = (desde + k) % m.cfg.jugadores
    if (!m.vivo[s]) continue
    /* El que se fue con todo ya no habla: no le queda con qué. */
    if (m.resto[s] <= 0) continue
    /* Le toca al que no ha hablado —la ciega grande siempre tiene su oportunidad— o al
       que habló pero se quedó corto porque alguien subió después. */
    if (!m.actuo[s] || m.puesto[s] < alto) return { ...m, turno: s }
  }
  return cerrarCalle(m)
}

/** Reparte las ciegas y deja la mano lista para el primer movimiento. */
export function arrancarMano(cfg: ConfigMano): Mano {
  const n = Math.max(2, Math.min(10, Math.floor(cfg.jugadores)))
  const limpia: ConfigMano = {
    jugadores: n,
    ciegaChica: Math.max(0, cfg.ciegaChica),
    ciegaGrande: Math.max(0, cfg.ciegaGrande),
    ...(cfg.fichas ? { fichas: cfg.fichas.slice(0, n) } : {}),
  }
  const ceros = Array.from({ length: n }, () => 0)
  const m: Mano = {
    cfg: limpia,
    calle: 'preflop',
    puesto: [...ceros],
    total: [...ceros],
    vivo: Array.from({ length: n }, () => true),
    actuo: Array.from({ length: n }, () => false),
    resto: Array.from({ length: n }, (_, s) => Math.max(0, cfg.fichas?.[s] ?? Infinity)),
    turno: null,
    movimientos: [],
    terminada: false,
  }

  /* De a dos, el botón es la ciega chica y habla primero antes del flop. De tres para
     arriba, las ciegas son los dos de después del botón. */
  const chica = n === 2 ? 0 : 1
  const grande = n === 2 ? 1 : 2
  const poner = (quien: number, cuanto: number) => {
    /* Al que no le alcanza para la ciega la pone con lo que trae y ahí se queda. */
    const va = Math.min(cuanto, m.resto[quien])
    m.puesto[quien] = va
    m.total[quien] = va
    m.resto[quien] -= va
    m.movimientos.push({
      jugador: quien,
      calle: 'preflop',
      tipo: 'ciega',
      monto: va,
      hasta: va,
    })
  }
  poner(chica, limpia.ciegaChica)
  poner(grande, limpia.ciegaGrande)

  /* Si los demás ya no traen nada, no hay ronda que jugar. */
  m.turno = n === 2 ? 0 : 3 % n
  if (m.resto[m.turno] <= 0 || puedenHablar(m) <= 1) return avanzar(m)
  return m
}

/**
 * Apunta un movimiento y pasa el turno.
 *
 * `hasta` sólo se usa al apostar o subir, y es a cuánto deja su apuesta de la calle —no
 * lo que suelta—, que es como se canta en la mesa: "subo a cincuenta".
 */
export function jugar(m: Mano, tipo: TipoMovimiento, hasta = 0): Mano {
  const t = m.turno
  if (t === null || m.terminada) return m

  const o = opciones(m)
  if (!o) return m

  const siguiente: Mano = {
    ...m,
    puesto: [...m.puesto],
    total: [...m.total],
    vivo: [...m.vivo],
    actuo: [...m.actuo],
    resto: [...m.resto],
    movimientos: [...m.movimientos],
  }

  let monto = 0
  let queda = siguiente.puesto[t]

  if (tipo === 'seVa') {
    siguiente.vivo[t] = false
  } else if (tipo === 'pasa') {
    if (!o.pasa) return m
  } else if (tipo === 'paga') {
    if (o.paga <= 0) return m
    monto = o.paga
    queda = siguiente.puesto[t] + monto
  } else if (tipo === 'apuesta' || tipo === 'sube') {
    /* Una subida por debajo del mínimo se sube al mínimo en vez de rebotarse: el que la
       escribió quiso subir, y discutirle el número es pelearse con el usuario. Por
       arriba manda lo que trae: nadie apuesta fichas que no tiene. */
    queda = Math.min(Math.max(Math.round(hasta), o.minimo), o.maximo)
    monto = queda - siguiente.puesto[t]
    if (monto <= 0) return m
  } else {
    return m
  }

  siguiente.puesto[t] = queda
  siguiente.total[t] += monto
  siguiente.resto[t] -= monto
  siguiente.actuo[t] = true
  siguiente.movimientos.push({ jugador: t, calle: siguiente.calle, tipo, monto, hasta: queda })

  return avanzar(siguiente)
}

/** Deshace el último movimiento rehaciendo la mano: equivocarse es lo normal. */
export function deshacer(m: Mano): Mano {
  const sinCiegas = m.movimientos.filter((x) => x.tipo !== 'ciega')
  if (sinCiegas.length === 0) return arrancarMano(m.cfg)
  let rehecha = arrancarMano(m.cfg)
  for (const x of sinCiegas.slice(0, -1)) rehecha = jugar(rehecha, x.tipo, x.hasta)
  return rehecha
}

/**
 * Lo mismo en dos palabras, para la placa de la mesa.
 *
 * En la mesa dibujada no cabe "sube a cincuenta" y tampoco hace falta: lo que se busca
 * de un vistazo es quién subió, quién pagó y quién se fue, como en las transmisiones.
 */
export function comoSeDiceCorto(x: Movimiento, dinero: (n: number) => string): string {
  switch (x.tipo) {
    case 'ciega':
      return `Ciega ${dinero(x.monto)}`
    case 'pasa':
      return 'Pasa'
    case 'paga':
      return `Paga ${dinero(x.monto)}`
    case 'apuesta':
      return `Apuesta ${dinero(x.hasta)}`
    case 'sube':
      return `Sube ${dinero(x.hasta)}`
    case 'seVa':
      return 'Se fue'
  }
}

/** Cómo se cuenta un movimiento, para el renglón del repaso. */
export function comoSeDice(x: Movimiento, dinero: (n: number) => string): string {
  switch (x.tipo) {
    case 'ciega':
      return `pone la ciega de ${dinero(x.monto)}`
    case 'pasa':
      return 'pasa'
    case 'paga':
      return `paga ${dinero(x.monto)}`
    case 'apuesta':
      return `apuesta ${dinero(x.hasta)}`
    case 'sube':
      return `sube a ${dinero(x.hasta)}`
    case 'seVa':
      return 'se va'
  }
}

/**
 * Cómo se parte el bote cuando alguien se fue con todo.
 *
 * El que puso $50 no puede llevarse más de $50 de cada uno, por mucho que traiga la
 * mejor mano: lo que los demás apostaron de más es un bote aparte y se lo pelean entre
 * ellos. Eso son los botes partidos, y es la única cuenta del poker que de verdad se
 * presta a hacerse mal.
 *
 * Se arma por capas: se ordenan las cantidades que puso cada quien y, de capa en capa,
 * se junta lo que cada uno metió en ella y se le da al mejor de los que llegaron a esa
 * altura. Lo que no se pueda partir en pesos enteros se le deja al primero, que es como
 * se resuelve en la mesa.
 *
 * `fuerza` dice qué tan buena es la mano de cada quien: a mayor número, mejor.
 */
export function repartirElBote(
  total: number[],
  vivo: boolean[],
  fuerza: (asiento: number) => number,
): number[] {
  const n = total.length
  const gana = Array.from({ length: n }, () => 0)

  const niveles = [...new Set(total.filter((t) => t > 0))].sort((a, b) => a - b)
  let anterior = 0

  for (const nivel of niveles) {
    /* La capa: lo que cada quien metió entre el nivel anterior y éste. */
    let capa = 0
    for (let s = 0; s < n; s++) {
      capa += Math.min(total[s], nivel) - Math.min(total[s], anterior)
    }
    anterior = nivel
    if (capa <= 0) continue

    /* A esta capa sólo le tiran los que siguen vivos y pusieron por lo menos esto. */
    const elegibles = []
    for (let s = 0; s < n; s++) if (vivo[s] && total[s] >= nivel) elegibles.push(s)

    /* Si nadie vivo llegó a esta altura, se le devuelve al que la puso: es lo que
       sobró de una apuesta que nadie alcanzó a igualar. */
    if (elegibles.length === 0) {
      for (let s = 0; s < n; s++) if (total[s] >= nivel) gana[s] += capa
      continue
    }

    const mejor = Math.max(...elegibles.map(fuerza))
    const ganadores = elegibles.filter((s) => fuerza(s) === mejor)
    const parte = Math.floor(capa / ganadores.length)
    ganadores.forEach((s, i) => {
      gana[s] += parte + (i === 0 ? capa - parte * ganadores.length : 0)
    })
  }

  return gana
}
