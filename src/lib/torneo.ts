/*
 * La estructura de un torneo: con cuántas fichas arranca cada quien, de cuánto son las
 * ciegas y cada cuánto suben.
 *
 * No es invento: es la matemática que usan las calculadoras de estructura de torneos,
 * y se apoya en cuatro reglas.
 *
 *  1. La ciega chica tiene que poderse pagar con la ficha más chica de la mesa. Si no,
 *     esa ficha estorba y hay que sacarla.
 *
 *  2. Lo que hace cómodo o rifado un torneo no son los pesos sino cuántas ciegas
 *     grandes tiene cada quien al arrancar. Entre 50 y 150 es lo sano.
 *
 *  3. El torneo se acaba cuando la ciega grande llega a una vigésima parte de todas
 *     las fichas en juego: ahí los últimos andan con siete u ocho ciegas y todo es
 *     all-in. De ahí sale cuánto tienen que subir las ciegas en total.
 *
 *  4. Las ciegas suben multiplicándose, no sumando. Repartido el salto total entre los
 *     niveles que caben en el tiempo deseado, sale el factor de cada nivel. Si ese
 *     factor queda fuera de 1.2–1.6, el torneo no va a durar lo que se pidió y más
 *     vale avisarlo que entregar una tabla que miente.
 */

/** Cuánto del total de fichas vale la ciega grande cuando el torneo se acaba. */
const PARTE_FINAL = 20
/** Ciegas grandes que debe tener cada quien al arrancar. */
const PROFUNDIDAD = 100
const FACTOR_MINIMO = 1.2
const FACTOR_MAXIMO = 1.6

/** Los saltos de toda la vida. Con estos, las ciegas se ven como en un casino. */
const ESCALA = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5]

export interface NivelCiegas {
  nivel: number
  chica: number
  grande: number
  /** Minuto del torneo en que empieza este nivel. */
  desdeMinuto: number
}

/** Un descanso cada tantos niveles, para cenar o estirar las piernas. */
export interface Descanso {
  cadaNiveles: number
  minutos: number
}

export interface Estructura {
  niveles: NivelCiegas[]
  /** `null` = se juega de corrido. */
  descanso: Descanso | null
  stackInicial: number
  minutosPorNivel: number
  /** Lo que va a durar de verdad, que puede no ser lo que se pidió. */
  duracionMinutos: number
  /** Ciegas grandes por jugador al arrancar. */
  profundidad: number
  /** Cuánto suben las ciegas de un nivel al siguiente. */
  factor: number
  /** Qué revisar antes de jugarlo, o `null` si la estructura es sana. */
  aviso: string | null
}

export interface Peticion {
  jugadores: number
  stackInicial: number
  /** Valor de la ficha más chica que va a estar en la mesa. */
  fichaMasChica: number
  minutosDeseados: number
  minutosPorNivel: number
  descanso?: Descanso | null
}

/*
 * El torneo visto como una fila de tramos: niveles con sus ciegas y, cada tantos, un
 * descanso. El reloj corre sobre esta fila y no sobre los niveles sueltos, porque los
 * descansos también consumen reloj y recorren todo lo que viene después.
 */
export type Tramo =
  | { tipo: 'nivel'; nivel: NivelCiegas; minutos: number; desdeMinuto: number }
  | { tipo: 'descanso'; minutos: number; desdeMinuto: number }

export function tramosDe(e: Estructura): Tramo[] {
  const salida: Tramo[] = []
  let minuto = 0

  e.niveles.forEach((nivel, i) => {
    salida.push({ tipo: 'nivel', nivel, minutos: e.minutosPorNivel, desdeMinuto: minuto })
    minuto += e.minutosPorNivel
    const toca = e.descanso && (i + 1) % e.descanso.cadaNiveles === 0
    /* Después del último nivel no tiene caso descansar: el torneo ya se acabó. */
    if (toca && i < e.niveles.length - 1) {
      salida.push({ tipo: 'descanso', minutos: e.descanso!.minutos, desdeMinuto: minuto })
      minuto += e.descanso!.minutos
    }
  })
  return salida
}

/** El valor "de casino" más cercano que además se puede pagar con las fichas que hay. */
function redondear(valor: number, fichaMasChica: number): number {
  if (valor <= fichaMasChica) return fichaMasChica
  const magnitud = 10 ** Math.floor(Math.log10(valor))
  const candidatos = [...ESCALA, 10].map((e) => e * magnitud)
  const bonito = candidatos.reduce((a, b) => (Math.abs(b - valor) < Math.abs(a - valor) ? b : a))
  const pagable = Math.round(bonito / fichaMasChica) * fichaMasChica
  return Math.max(fichaMasChica, pagable)
}

export function calcularEstructura(p: Peticion): Estructura {
  const descanso = p.descanso ?? null
  const jugadores = Math.max(2, Math.floor(p.jugadores))
  const stackInicial = Math.max(1, Math.round(p.stackInicial))
  const ficha = Math.max(1, p.fichaMasChica)
  const minutosPorNivel = Math.max(5, Math.round(p.minutosPorNivel))

  /* La ciega chica es la mitad de la grande, así que se trabaja con ella y la grande
     sale al doble: así las dos se pueden pagar con las fichas que hay. */
  const chicaInicial = redondear(stackInicial / (PROFUNDIDAD * 2), ficha)
  const enJuego = jugadores * stackInicial
  const chicaFinal = redondear(enJuego / (PARTE_FINAL * 2), ficha)

  const factorDe = (cuantos: number) => (chicaFinal / chicaInicial) ** (1 / (cuantos - 1))

  const generar = (cuantos: number): NivelCiegas[] => {
    const f = factorDe(cuantos)
    const salida: NivelCiegas[] = []
    let anterior = 0
    for (let i = 0; i < cuantos; i++) {
      let chica = redondear(chicaInicial * f ** i, ficha)
      /* Redondear puede empatar dos niveles seguidos; subir al menos una ficha evita
         que el torneo se quede estancado en la misma ciega. */
      if (chica <= anterior) chica = anterior + ficha
      anterior = chica
      salida.push({ nivel: i + 1, chica, grande: chica * 2, desdeMinuto: i * minutosPorNivel })
    }
    return salida
  }

  /*
   * Cuánto reloj se lleva todo: los niveles y los descansos de en medio.
   *
   * Se mide armando los tramos de verdad en vez de sumar a mano, para que esta cuenta y
   * la que ve la gente en la tabla salgan siempre del mismo lugar.
   */
  const duracionDe = (niveles: NivelCiegas[]) => {
    const tramos = tramosDe({
      niveles,
      descanso,
      stackInicial,
      minutosPorNivel,
      duracionMinutos: 0,
      profundidad: 0,
      factor: 0,
      aviso: null,
    })
    const ultimo = tramos[tramos.length - 1]
    return ultimo ? ultimo.desdeMinuto + ultimo.minutos : 0
  }

  /* Los descansos salen del tiempo que se pidió, no se le suman: si se quedó de jugar
     de ocho a una, a la una hay que estar levantando la mesa. Cenar sale de ahí. */
  let cuantos = Math.max(2, Math.round(p.minutosDeseados / minutosPorNivel))
  let niveles = generar(cuantos)
  while (cuantos > 2 && duracionDe(niveles) > p.minutosDeseados) {
    cuantos--
    niveles = generar(cuantos)
  }

  const factor = factorDe(cuantos)

  let aviso: string | null = null
  if (factor < FACTOR_MINIMO)
    aviso =
      'Las ciegas suben muy despacio para el tiempo pedido: el torneo se va a alargar. Sube el stack o acorta los niveles.'
  else if (factor > FACTOR_MAXIMO)
    aviso =
      'Las ciegas suben muy rápido: se va a convertir en rifa. Dale más tiempo o niveles más largos.'

  const profundidad = stackInicial / (chicaInicial * 2)
  if (!aviso && profundidad < 30)
    aviso = 'Cada quien arranca con muy pocas ciegas. Con un stack más grande se juega mejor.'

  return {
    niveles,
    descanso,
    stackInicial,
    minutosPorNivel,
    duracionMinutos: duracionDe(niveles),
    profundidad,
    factor,
    aviso,
  }
}

export interface EnCurso {
  tramo: Tramo
  restanteSeg: number
  terminado: boolean
  /** El nivel que se está jugando; durante un descanso, el que viene al volver. */
  nivel: NivelCiegas
  /** El nivel siguiente, para poder anunciarlo. */
  siguienteNivel: NivelCiegas | null
}

/** Dónde va el torneo después de tantos segundos de reloj. */
export function enCurso(e: Estructura, segundos: number): EnCurso {
  const tramos = tramosDe(e)
  const ultimo = tramos[tramos.length - 1]
  const total = ultimo.desdeMinuto * 60 + ultimo.minutos * 60

  const nivelDe = (t: Tramo, i: number): NivelCiegas =>
    t.tipo === 'nivel'
      ? t.nivel
      : /* En un descanso manda el nivel que sigue: es lo que hay que anunciar. */
        ((tramos[i + 1] as { nivel: NivelCiegas } | undefined)?.nivel ??
        e.niveles[e.niveles.length - 1])

  if (segundos >= total) {
    const nivel = e.niveles[e.niveles.length - 1]
    return { tramo: ultimo, restanteSeg: 0, terminado: true, nivel, siguienteNivel: null }
  }

  const i = tramos.findIndex((t) => segundos < t.desdeMinuto * 60 + t.minutos * 60)
  const tramo = tramos[i]
  const nivel = nivelDe(tramo, i)
  const posterior = tramos.slice(i + 1).find((t) => t.tipo === 'nivel') as
    { nivel: NivelCiegas } | undefined

  return {
    tramo,
    restanteSeg: tramo.desdeMinuto * 60 + tramo.minutos * 60 - segundos,
    terminado: false,
    nivel,
    siguienteNivel: tramo.tipo === 'descanso' ? null : (posterior?.nivel ?? null),
  }
}

/*
 * El reloj se guarda en el servidor, no en el teléfono: en la mesa hay varias personas
 * mirando la app y todas tienen que ver el mismo nivel. Lo que se guarda no es el
 * tiempo que va —eso se desactualizaría en cuanto nadie escribiera— sino desde cuándo
 * corre y cuánto llevaba antes de la última pausa.
 */
export interface RelojTorneo {
  corriendo: boolean
  acumuladoSeg: number
  /** ISO del momento en que se le dio play por última vez. */
  arrancadoEn: string | null
}

export const RELOJ_PARADO: RelojTorneo = { corriendo: false, acumuladoSeg: 0, arrancadoEn: null }

/** Segundos que lleva el torneo, a día de hoy. */
export function segundosCorridos(r: RelojTorneo, ahora = Date.now()): number {
  if (!r.corriendo || !r.arrancadoEn) return Math.max(0, r.acumuladoSeg)
  const desde = Date.parse(r.arrancadoEn)
  if (Number.isNaN(desde)) return Math.max(0, r.acumuladoSeg)
  return Math.max(0, r.acumuladoSeg + (ahora - desde) / 1000)
}

export const arrancarReloj = (r: RelojTorneo): RelojTorneo => ({
  corriendo: true,
  acumuladoSeg: r.acumuladoSeg,
  arrancadoEn: new Date().toISOString(),
})

export const pausarReloj = (r: RelojTorneo): RelojTorneo => ({
  corriendo: false,
  acumuladoSeg: segundosCorridos(r),
  arrancadoEn: null,
})

/** mm:ss, o h:mm:ss cuando ya pasó de la hora. */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const dosDigitos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dosDigitos(m)}:${dosDigitos(seg)}` : `${m}:${dosDigitos(seg)}`
}

/*
 * Las fichas de un torneo no son dinero.
 *
 * En cash la ficha verde vale $25 y punto: el que la tiene tiene veinticinco pesos. En
 * torneo pagas $500 de entrada y recibes un stack de puntos que no se cambian por nada
 * hasta que el torneo acaba y se reparte la bolsa. Los mismos plásticos valen otra cosa
 * esa noche, y tienen que valer otra cosa: con denominaciones de a peso no alcanzan las
 * fichas para stacks de mil, y con ciegas de $5 nadie puede pagar una ciega de 25.
 *
 * Por eso el torneo trae sus propios valores por color, y la ficha más chica vale lo que
 * vale la ciega chica del primer nivel: cualquier ficha por debajo de eso no se podría
 * usar para nada.
 */

/** Valor de cada color dentro del torneo, por `key` de color. */
export type ValoresTorneo = Record<string, number>

/*
 * La escalera de denominaciones del torneo. Con unidad 50 sale 50 / 100 / 200 / 500 /
 * 1000, y con 25 sale 25 / 50 / 100 / 250 / 500: números que cualquiera suma de cabeza.
 *
 * Es más plana que la de un set de casino —que salta 25 / 100 / 500 / 1000 / 5000— y eso
 * es a propósito. Con saltos tan grandes, la ficha más cara vale casi el stack entero:
 * no cabe en la pila de nadie al arrancar y los dos colores de arriba se quedan en la
 * caja toda la noche esperando un cambio de fichas. Aplanada, la más cara vale la
 * vigésima parte del stack y a todos les tocan los cinco colores desde la primera mano.
 *
 * Los saltos siguen siendo ×2 y ×2.5, que es lo que hace que unas se paguen con otras
 * sin denominaciones raras tipo 125.
 */
const ESCALERA = [1, 2, 4, 10, 20, 40]

/** El paso que le toca al color en la posicion `i` de precio, de mas barato a mas caro. */
const pasoDe = (i: number) =>
  ESCALERA[i] ?? ESCALERA[ESCALERA.length - 1] * 5 ** (i - ESCALERA.length + 1)

/**
 * Reparte denominaciones entre los colores: el más barato en dinero se queda con la más
 * baja del torneo.
 *
 * Se respeta el orden de precio para que nadie se confunda en la mesa: si en cash la
 * blanca es la de menos valor, en torneo también.
 */
export function asignarValores(
  colores: { key: string; value: number }[],
  unidad: number,
): ValoresTorneo {
  const orden = [...colores].sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))
  const valores: ValoresTorneo = {}
  orden.forEach((c, i) => {
    valores[c.key] = Math.max(1, Math.round(unidad * pasoDe(i)))
  })
  return valores
}

/** Los colores de la liga, pero valiendo lo que valen esa noche. */
export function coloresDelTorneo<T extends { key: string; value: number }>(
  colores: T[],
  valores: ValoresTorneo | undefined,
): T[] {
  if (!valores) return colores
  return colores.map((c) => (valores[c.key] ? { ...c, value: valores[c.key] } : c))
}

/*
 * Cuánto vale cada ficha, contando lo que hay en la caja.
 *
 * Poner valores bonitos no basta: las fichas tienen que alcanzar. Y no sólo para los
 * stacks del arranque —las recompras y los add-ons también salen de la misma caja—, así
 * que el cálculo cuenta desde ya los que se esperan.
 *
 * La cuenta se apoya en que todos los valores salen de una sola unidad: subirla al doble
 * hace que la misma caja dé el doble de puntos. Así que la unidad más baja que sirve es
 * la que hace que el inventario completo cubra los puntos que se van a necesitar.
 *
 * Entre esa y la que dejaría arrancar con cien ciegas grandes, gana la más alta: antes
 * que una tabla de ciegas bonita que no se puede repartir, más vale un torneo un poco
 * más corto que sí cabe en la caja.
 */

/** Unidades con las que las denominaciones se ven normales: 25, 50, 100, 250… */
const UNIDADES = [1, 2, 2.5, 5]

function unidadBonita(v: number): number {
  if (v <= 1) return 1
  const magnitud = 10 ** Math.floor(Math.log10(v))
  for (const u of UNIDADES) {
    const cand = u * magnitud
    /* El 2.5 sólo sirve de 25 para arriba: una ficha de 2.5 no existe. */
    if (!Number.isInteger(cand)) continue
    /* Hacia arriba siempre: redondear hacia abajo dejaría las fichas cortas. */
    if (cand >= v - 1e-9) return cand
  }
  return 10 * magnitud
}

export interface PeticionFichas {
  colores: { key: string; value: number; inventory: number }[]
  jugadores: number
  stack: number
  fichasRecompra: number
  fichasAddOn: number
  recomprasEsperadas: number
  addOnsEsperados: number
}

export interface PlanFichas {
  valores: ValoresTorneo
  unidad: number
  /** Puntos que hay que poner sobre la mesa, contando recompras y add-ons esperados. */
  puntosNecesarios: number
  /** Puntos que da toda la caja con estos valores. */
  puntosDisponibles: number
  /** Valor de la ficha más chica: es lo que tiene que poder pagar la ciega chica. */
  fichaMasChica: number
  aviso: string | null
}

export function planFichas(p: PeticionFichas): PlanFichas {
  const jugadores = Math.max(2, Math.floor(p.jugadores) || 2)
  const stack = Math.max(1, Math.round(p.stack) || 1)
  const orden = [...p.colores].sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))

  const cuantas = (c: { inventory: number }) => Math.max(0, Math.floor(Number(c.inventory) || 0))

  /* Lo que pesa la caja con unidad 1. Todo lo demás escala con ella. */
  const peso = orden.reduce((s, c, i) => s + cuantas(c) * pasoDe(i), 0)

  /* Y lo que pesa la parte que le toca a uno solo: el reparto no puede darle a nadie más
     fichas de un color que las que hay divididas entre todos, así que un stack que no
     quepa ahí no se puede armar aunque en la caja sobren puntos. */
  const pesoDeUno = orden.reduce(
    (s, c, i) => s + Math.floor(cuantas(c) / jugadores) * pasoDe(i),
    0,
  )

  const puntosNecesarios =
    jugadores * stack +
    Math.max(0, Math.floor(p.recomprasEsperadas) || 0) * Math.max(0, p.fichasRecompra || 0) +
    Math.max(0, Math.floor(p.addOnsEsperados) || 0) * Math.max(0, p.fichasAddOn || 0)

  const comoda = unidadBonita(Math.max(1, stack / (PROFUNDIDAD * 2)))
  const necesaria =
    peso > 0
      ? unidadBonita(
          /* Sin pesoDeUno no hay unidad que salve el reparto; eso lo dice el aviso. */
          Math.max(puntosNecesarios / peso, pesoDeUno > 0 ? stack / pesoDeUno : 0),
        )
      : comoda
  const unidad = Math.max(comoda, necesaria)

  const valores = asignarValores(p.colores, unidad)
  const puntosDisponibles = unidad * peso
  const fichaMasChica = Math.min(...Object.values(valores), unidad)

  let aviso: string | null = null
  if (peso <= 0)
    aviso = 'La liga no tiene fichas cargadas, así que no hay con qué repartir. Revísalas en la liga.'
  else if (pesoDeUno <= 0)
    aviso =
      'No hay fichas para tantos jugadores: de algún color no alcanza ni a una por cabeza. Juega con menos gente o carga más fichas.'
  else if (necesaria > comoda)
    aviso =
      'No hay fichas para arrancar con cien ciegas grandes, así que la ficha más chica sube de valor y el torneo empieza más corto. Baja el stack o las recompras que esperas.'
  else if (puntosNecesarios > puntosDisponibles * 0.85)
    aviso =
      'Se va a usar casi toda la caja. Si llega gente de más o se recompra más de lo calculado, no van a alcanzar las fichas.'

  return { valores, unidad, puntosNecesarios, puntosDisponibles, fichaMasChica, aviso }
}

/**
 * Las fichas que da una recompra o un add-on.
 *
 * Es la misma proporción que la entrada: si $500 dan 1,000 puntos, una recompra de $400
 * da 800 y un add-on de $300 da 600. El dinero se acuerda entre todos; las fichas salen
 * de ahí solas, para que nadie compre puntos más baratos que los demás.
 */
export function fichasPorPrecio(
  precio: number,
  entrada: number,
  stack: number,
  fichaMasChica = 1,
): number {
  const pagado = Math.max(0, Number(precio) || 0)
  if (pagado <= 0) return 0
  const cobrado = Number(entrada) || 0
  const crudo = cobrado > 0 ? (stack * pagado) / cobrado : stack
  const paso = Math.max(1, Math.round(fichaMasChica) || 1)
  return Math.max(paso, Math.round(crudo / paso) * paso)
}

/* ---- la hora de la pared ---- */

const enMinutos = (hhmm: string): number => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

/** Minutos entre dos horas "HH:MM". Si la de salida es menor, es que se pasó la medianoche. */
export function minutosEntre(inicio: string, fin: string): number {
  const a = enMinutos(inicio)
  const b = enMinutos(fin)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  const diferencia = b - a
  return diferencia > 0 ? diferencia : diferencia + 24 * 60
}

/** La hora que va a ser tantos minutos después de arrancar, en "HH:MM". */
export function horaMas(inicio: string, minutos: number): string {
  const a = enMinutos(inicio)
  if (Number.isNaN(a)) return ''
  const t = (((a + Math.round(minutos)) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/*
 * Con cuántas fichas arranca cada quien si nadie dice otra cosa.
 *
 * El número en sí da igual —son puntos— pero conviene que se vea como un torneo de
 * verdad, así que sale de la entrada y se redondea a dos cifras: $500 dan 10,000.
 */
export function stackSugerido(buyIn: number): number {
  const crudo = Math.max(1000, Math.round((Number(buyIn) || 0) * 20))
  const magnitud = 10 ** Math.max(0, Math.floor(Math.log10(crudo)) - 1)
  return Math.round(crudo / magnitud) * magnitud
}
