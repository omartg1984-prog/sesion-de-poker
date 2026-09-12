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
  const cuantos = Math.max(2, Math.round(p.minutosDeseados / minutosPorNivel))

  /* La ciega chica es la mitad de la grande, así que se trabaja con ella y la grande
     sale al doble: así las dos se pueden pagar con las fichas que hay. */
  const chicaInicial = redondear(stackInicial / (PROFUNDIDAD * 2), ficha)
  const enJuego = jugadores * stackInicial
  const chicaFinal = redondear(enJuego / (PARTE_FINAL * 2), ficha)

  const factor = (chicaFinal / chicaInicial) ** (1 / (cuantos - 1))

  const niveles: NivelCiegas[] = []
  let anterior = 0
  for (let i = 0; i < cuantos; i++) {
    let chica = redondear(chicaInicial * factor ** i, ficha)
    /* Redondear puede empatar dos niveles seguidos; subir al menos una ficha evita que
       el torneo se quede estancado en la misma ciega. */
    if (chica <= anterior) chica = anterior + ficha
    anterior = chica
    niveles.push({
      nivel: i + 1,
      chica,
      grande: chica * 2,
      desdeMinuto: i * minutosPorNivel,
    })
  }

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

  /* Los descansos también cuentan para lo que va a durar la noche. */
  const cuantosDescansos = descanso ? Math.max(0, Math.ceil(cuantos / descanso.cadaNiveles) - 1) : 0

  return {
    niveles,
    descanso,
    stackInicial,
    minutosPorNivel,
    duracionMinutos: cuantos * minutosPorNivel + cuantosDescansos * (descanso?.minutos ?? 0),
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
