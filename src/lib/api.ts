/**
 * Cliente del API. Todas las llamadas mandan la cookie de sesión y traducen los
 * errores del servidor a `ErrorApi`, cuyo mensaje ya viene en español listo para
 * enseñarse tal cual al usuario.
 */
import type { ChipColor, Chips } from '../store/types'
import type { Estructura, RelojTorneo } from './torneo'
import type { SeccionReglas } from './reglas'

export class ErrorApi extends Error {
  estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
  /** `true` cuando la sesión caducó o nunca hubo. */
  get noAutenticado() {
    return this.estado === 401
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api/${ruta}`, {
      credentials: 'same-origin',
      headers: opciones.body ? { 'content-type': 'application/json' } : {},
      ...opciones,
    })
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor')
  }

  const texto = await respuesta.text()
  let datos: unknown = null
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    throw new ErrorApi(respuesta.status, 'El servidor respondió algo inesperado')
  }

  if (!respuesta.ok) {
    const mensaje =
      (datos as { error?: string } | null)?.error ?? 'Algo salió mal, inténtalo otra vez'
    throw new ErrorApi(respuesta.status, mensaje)
  }
  return datos as T
}

const post = <T>(ruta: string, cuerpo?: unknown) =>
  pedir<T>(ruta, { method: 'POST', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
const patch = <T>(ruta: string, cuerpo: unknown) =>
  pedir<T>(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) })
const put = <T>(ruta: string, cuerpo: unknown) =>
  pedir<T>(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) })
const borrar = <T>(ruta: string) => pedir<T>(ruta, { method: 'DELETE' })

/* ---------- formas que devuelve el servidor ---------- */

export interface Usuario {
  id: string
  usuario: string
  nombre: string
  foto: string | null
  esAdminApp: boolean
  esInvitado?: boolean
}

export interface LigaResumen {
  id: string
  nombre: string
  codigo: string
  foto: string | null
  creada_en: string
  es_admin: number
  miembros: number
  partidas: number
}

export interface Miembro {
  id: string
  usuario: string
  nombre: string
  foto: string | null
  es_admin: number
  /** 1 = está en la liga pero no tiene la app; lo mueve un admin. */
  es_invitado?: number
}

/*
 * Cómo reparte puntos una liga: una lista de consideraciones, no una fórmula fija.
 *
 * El catálogo vive igual aquí y en el servidor. El servidor es el que manda —de ahí
 * salen los puntos de la tabla—; esta copia sólo sirve para que la hoja enseñe el efecto
 * sin tener que preguntar en cada tecla. Si se agrega una consideración, va en los dos.
 */

export interface NocheParaPuntos {
  lugar: number
  deCuantos: number
  /** Lo que ganó o perdió en dinero. */
  resultado: number
  recompras: number
}

export interface Consideracion {
  id: string
  etiqueta: string
  ayuda: string
  /** Cuántas veces se cobra esa noche. 0 = no aplica. */
  veces: (n: NocheParaPuntos) => number
  sugerido: number
  /** Las que restan se escriben en negativo y se pintan distinto. */
  castigo?: boolean
  /** Si depende sólo del lugar: las demás no caben en la tabla de ejemplo. */
  porLugar?: boolean
}

export const CONSIDERACIONES: Consideracion[] = [
  {
    id: 'base',
    etiqueta: 'Por presentarte',
    ayuda: 'Lo que suma venir, aunque te vayas en la primera mano.',
    veces: () => 1,
    sugerido: 1,
    porLugar: true,
  },
  {
    id: 'porJugador',
    etiqueta: 'Por cada uno al que le ganas',
    ayuda: 'Es lo que hace que ganarle a siete valga más que ganarle a tres.',
    veces: (n) => Math.max(0, n.deCuantos - n.lugar),
    sugerido: 1,
    porLugar: true,
  },
  {
    id: 'bonoGanar',
    etiqueta: 'Por ganar la noche',
    ayuda: 'Un premio aparte para el primer lugar.',
    veces: (n) => (n.lugar === 1 ? 1 : 0),
    sugerido: 3,
    porLugar: true,
  },
  {
    id: 'bonoPodio',
    etiqueta: 'Por quedar entre los tres primeros',
    ayuda: 'Sólo en mesas de más de tres: en una de tres, todos estarían en el podio.',
    veces: (n) => (n.lugar <= 3 && n.deCuantos > 3 ? 1 : 0),
    sugerido: 2,
    porLugar: true,
  },
  {
    id: 'bonoPositivo',
    etiqueta: 'Por salir ganando dinero',
    ayuda: 'No es lo mismo quedar tercero arriba que tercero abajo.',
    veces: (n) => (n.resultado > 0 ? 1 : 0),
    sugerido: 2,
  },
  {
    id: 'porCadaCien',
    etiqueta: 'Por cada $100 que te llevas',
    ayuda: 'El dinero contado completo: ganar $1,200 no vale lo mismo que ganar $100.',
    veces: (n) => Math.floor(Math.max(0, n.resultado) / 100),
    sugerido: 1,
  },
  {
    id: 'porCadaCienPerdido',
    etiqueta: 'Por cada $100 que dejas',
    ayuda: 'Para restar. Con esto, perder poco duele menos que perder mucho.',
    veces: (n) => Math.floor(Math.max(0, -n.resultado) / 100),
    sugerido: -1,
    castigo: true,
  },
  {
    id: 'sinRecompras',
    etiqueta: 'Por aguantar sin recomprar',
    ayuda: 'Premia al que hizo rendir su entrada.',
    veces: (n) => (n.recompras === 0 ? 1 : 0),
    sugerido: 2,
  },
  {
    id: 'bonoUltimo',
    etiqueta: 'Por quedar último',
    ayuda: 'Para restar. Ponlo en negativo si quieres que duela.',
    veces: (n) => (n.lugar === n.deCuantos && n.deCuantos > 1 ? 1 : 0),
    sugerido: -1,
    castigo: true,
    porLugar: true,
  },
  {
    id: 'porRecompra',
    etiqueta: 'Por cada recompra',
    ayuda: 'Para restar. Castiga al que compra su camino de vuelta.',
    veces: (n) => Math.max(0, n.recompras),
    sugerido: -1,
    castigo: true,
  },
]

export interface ReglaPuntos {
  id: string
  puntos: number
}

export interface EsquemaPuntos {
  reglas: ReglaPuntos[]
  /** Puntos por lugar: [1º, 2º, 3º…]. Vacía o ausente = no se usa. */
  tabla?: number[]
  /**
   * Cuánto hay que haber venido para poder subir al podio, en por ciento de las noches
   * de la temporada.
   *
   * No es una regla de puntos sino del podio, y por eso vive aparte: todos suman desde
   * su primera noche, pero para salir en el cuadro de campeones hay que haber sostenido
   * la temporada. Así una racha de dos viernes no desplaza a quien no se ha perdido
   * una, y no hace falta castigar a nadie en la fórmula. En 0 —o sin poner— nadie queda
   * fuera, que es como ha funcionado siempre.
   */
  minimoPodio?: number
  /**
   * Tope de lo que pueden pagar —o cobrar— las consideraciones del dinero en una noche.
   * En 0, o sin poner, no hay tope.
   */
  topeDinero?: number
  /**
   * Qué parte de las noches de la temporada cuenta para el campeonato, en por ciento.
   * En 0, o sin poner, cuentan todas. Esto no cambia lo que vale una noche suelta, así
   * que la cuenta de aquí abajo no lo mira: se reparte al armar la temporada, y eso lo
   * hace el servidor.
   */
  mejoresNoches?: number
  /**
   * Lo mismo dicho en noches: cuántas se descartan. En 1, se cae la peor de cada quien.
   * Si está puesto, manda sobre el por ciento.
   */
  descartaNoches?: number
  /**
   * El mínimo del podio dicho en noches: a cuántas hay que haber venido. Si está
   * puesto, manda sobre `minimoPodio`.
   */
  minimoNoches?: number
}

export const PUNTOS_POR_DEFECTO: EsquemaPuntos = {
  reglas: [
    { id: 'base', puntos: 1 },
    { id: 'porJugador', puntos: 1 },
  ],
}

/** Lo que dice el reglamento de la liga: asistencia, bono por positivo y tabla fija. */
export const PUNTOS_DEL_REGLAMENTO: EsquemaPuntos = {
  reglas: [
    { id: 'base', puntos: 5 },
    { id: 'bonoPositivo', puntos: 5 },
  ],
  tabla: [25, 20, 15, 10, 5],
}

/**
 * Contra la mesa: el campeonato mide a cuánta gente le ganaste, no cuánto te llevaste.
 *
 * Ni un punto por dinero a propósito —para eso está la columna de saldo—, y en cambio
 * todo lo que la mesa ve sin sacar la calculadora. Con el descarte de la peor noche y
 * con medio semestre de asistencia para poder coronarse.
 */
export const PUNTOS_CONTRA_LA_MESA: EsquemaPuntos = {
  reglas: [
    { id: 'base', puntos: 3 },
    { id: 'porJugador', puntos: 1 },
    { id: 'bonoGanar', puntos: 3 },
    { id: 'bonoPositivo', puntos: 2 },
  ],
  mejoresNoches: 80,
  minimoPodio: 50,
}

/** Las que cuentan pesos, que son las únicas que el tope recorta. */
export const DEL_DINERO = ['porCadaCien', 'porCadaCienPerdido']

/** Lo que suma una noche. Es la misma cuenta que hace el servidor. */
export function puntosDeLaNoche(n: NocheParaPuntos, e: EsquemaPuntos): number {
  let total = 0
  /* El dinero se junta aparte: el tope se le aplica a la suma de las dos, no a cada
     una. */
  let dinero = 0
  for (const regla of e.reglas) {
    const c = CONSIDERACIONES.find((x) => x.id === regla.id)
    if (!c) continue
    const suma = c.veces(n) * regla.puntos
    if (DEL_DINERO.indexOf(regla.id) >= 0) dinero += suma
    else total += suma
  }
  const tope = e.topeDinero ?? 0
  total += tope > 0 ? Math.max(-tope, Math.min(tope, dinero)) : dinero
  /* Del largo de la tabla en adelante no se suman puntos de lugar. */
  if (e.tabla && e.tabla.length > 0) total += e.tabla[n.lugar - 1] ?? 0
  return total
}

/** Lee lo guardado, entendiendo también la forma vieja de cuatro campos sueltos. */
export function esquemaGuardado(crudo: string | null): EsquemaPuntos {
  const g = leerJson<Record<string, unknown>>(crudo, {})
  if (Array.isArray(g.reglas)) {
    const vistos = new Set<string>()
    const reglas = (g.reglas as ReglaPuntos[])
      .filter(
        (r) =>
          r &&
          typeof r.puntos === 'number' &&
          CONSIDERACIONES.some((c) => c.id === r.id) &&
          !vistos.has(r.id) &&
          vistos.add(r.id),
      )
      .map((r) => ({ id: r.id, puntos: r.puntos }))
    const tabla = Array.isArray(g.tabla)
      ? (g.tabla as unknown[]).map((v) => (typeof v === 'number' ? v : 0))
      : []
    const m = typeof g.minimoPodio === 'number' ? Math.max(0, Math.min(100, g.minimoPodio)) : 0
    const t = typeof g.topeDinero === 'number' ? Math.max(0, g.topeDinero) : 0
    const mn = typeof g.mejoresNoches === 'number' ? Math.max(0, Math.min(100, g.mejoresNoches)) : 0
    const dn = typeof g.descartaNoches === 'number' ? Math.max(0, g.descartaNoches) : 0
    const minN = typeof g.minimoNoches === 'number' ? Math.max(0, g.minimoNoches) : 0
    return {
      reglas,
      ...(tabla.length > 0 ? { tabla } : {}),
      ...(m > 0 ? { minimoPodio: m } : {}),
      ...(t > 0 ? { topeDinero: t } : {}),
      ...(mn > 0 && mn < 100 ? { mejoresNoches: mn } : {}),
      ...(dn > 0 ? { descartaNoches: dn } : {}),
      ...(minN > 0 ? { minimoNoches: minN } : {}),
    }
  }
  const viejas = ['base', 'porJugador', 'bonoGanar', 'bonoPodio']
  const convertidas = viejas
    .map((id) => ({ id, puntos: g[id] }))
    .filter((r): r is ReglaPuntos => typeof r.puntos === 'number' && r.puntos !== 0)
  return convertidas.length > 0 ? { reglas: convertidas } : PUNTOS_POR_DEFECTO
}

/*
 * La calificación del reglamento: no mide cuánto ganaste sino qué tan bien rindió lo que
 * pusiste. Dos personas pueden ir +$500 y una haber metido el triple; el rendimiento las
 * separa y es lo que la liga decidió mirar.
 */
export interface Calificacion {
  /** Mínimo de rendimiento para tenerla, en por ciento. */
  desde: number
  emoji: string
  nombre: string
  ayuda: string
}

/** De mejor a peor: la primera que alcances es la tuya. */
export const CALIFICACIONES: Calificacion[] = [
  { desde: 50, emoji: '🦈', nombre: 'Shark', ayuda: 'Rinde la mitad o más de lo que mete' },
  { desde: 20, emoji: '🔥', nombre: 'Pro', ayuda: 'Gana parejo noche con noche' },
  { desde: 0, emoji: '💪', nombre: 'Solid', ayuda: 'Sale a mano o arriba' },
  { desde: -20, emoji: '🎲', nombre: 'Rookie', ayuda: 'Pierde poco, va aprendiendo' },
  { desde: -Infinity, emoji: '🐟', nombre: 'Fish', ayuda: 'Paga la cena de los demás' },
]

/** La calificación que le toca a un rendimiento. Sin partidas no hay nada que calificar. */
export function calificacionDe(roi: number | null, partidas: number): Calificacion | null {
  if (partidas <= 0 || roi === null || !Number.isFinite(roi)) return null
  return CALIFICACIONES.find((c) => roi >= c.desde) ?? null
}

export interface Liga {
  id: string
  nombre: string
  codigo: string
  foto: string | null
  /** De qué va la liga, escrito por los de la casa. null = nadie la ha escrito. */
  descripcion: string | null
  /** JSON con las reglas de la casa. null = todavía no las han tocado. */
  reglas: string | null
  /** JSON con cómo reparte puntos. null = los de siempre. */
  puntos: string | null
  colores: ChipColor[]
  creada_por: string
  creada_en: string
}

export type TipoPartida = 'cash' | 'torneo' | 'tornecash'

/** Cómo se llama cada modalidad donde se le enseña al jugador. */
export const NOMBRE_TIPO: Record<TipoPartida, string> = {
  cash: 'Cash',
  torneo: 'Torneo',
  tornecash: 'Tornecash',
}

/** Lo mismo, aguantando un tipo que no conozcamos todavía. */
export const nombreDelTipo = (t: string) => NOMBRE_TIPO[t as TipoPartida] ?? 'Cash'

export interface ConfigTorneo {
  /* Lo que cuesta en dinero. */
  buyIn: number
  rebuyPrice: number
  addOnPrice: number
  payouts: { pct: number }[]
  /*
   * Y lo que da en fichas, que es otra cosa. Opcionales para no romper los torneos que
   * ya existen: sin ellos la app cae en el comportamiento viejo.
   */
  stack?: number
  rebuyChips?: number
  addOnChips?: number
  /** Valor de cada color dentro del torneo, por key de color. */
  valores?: Record<string, number>
  /*
   * Con cuántas recompras y add-ons se hizo la cuenta de las fichas. No es un
   * pronóstico ocioso: si no se cuentan, la caja alcanza el día del arranque y se queda
   * corta a media noche.
   */
  recomprasEsperadas?: number
  addOnsEsperados?: number
  /*
   * Hasta qué descanso se puede comprar. 0 o sin poner = toda la noche.
   *
   * Va contra los descansos y no contra los niveles porque así se dice en la mesa —"se
   * recompra hasta el primer descanso"— y porque el corte cae solo en un momento en que
   * la mesa ya está parada: nadie tiene que interrumpir una mano para comprar.
   *
   * Es la regla que más se discute a las once y media, cuando alguien que acaba de
   * perder su stack quiere una más. Puesta por escrito antes de empezar —y aceptada por
   * todos al apuntarse— deja de discutirse.
   */
  recomprasHastaDescanso?: number
  addOnsHastaDescanso?: number
  /*
   * Cuántas se le permiten a cada quien. 0 o sin poner = las que quiera.
   *
   * No es lo mismo que `recomprasEsperadas`, que es un cálculo para saber si alcanzan
   * las fichas. Esto es la regla: el add-on casi siempre es uno solo por persona, y hay
   * casas donde también se topan las recompras.
   */
  recomprasMax?: number
  addOnsMax?: number
  /*
   * Lo que se le cobra a cada quien de cena, y que sale de la bolsa antes de repartir
   * premios. "Entrada $500, cena incluida" es lo normal en la mesa, y si no se aparta,
   * el que lleva el banco reparte porcentajes de un dinero que ya pagó la comida.
   *
   * Se cobra por persona una sola vez: recomprar tres veces no es cenar tres veces.
   */
  cenaPorPersona?: number
  /** A qué hora se quedó de empezar y de terminar, "HH:MM". */
  horaInicio?: string
  horaFin?: string
}

/** Un lugar del podio de una noche, para el resumen del lobby. */
export interface PuestoPodio {
  usuarioId: string
  nombre: string
  foto: string | null
  resultado: number
  lugar: number
}

export interface PartidaResumen {
  id: string
  liga_id: string
  fecha: string
  nombre: string | null
  tipo: TipoPartida
  estado: 'abierta' | 'cerrada'
  jugadores: number
  /** Quién llevó el banco esa noche. null en las de antes de que esto existiera. */
  jefe_id?: string | null
  /** Los tres primeros. Vacío mientras la partida sigue abierta. */
  podio?: PuestoPodio[]
  /** El mensaje del que ganó, si lo escribió. */
  presume?: string | null
  /** 1 = ya no se apunta nadie solo. El admin sí puede seguir moviendo la lista. */
  registro_cerrado?: number
  /** Instante ISO en que el registro se cierra solo. null = sólo se cierra a mano. */
  registro_hasta?: string | null
  /** Instante ISO del primer play del reloj. null = todavía no empieza. */
  arrancado_en?: string | null
  /** Instante ISO de la última mano. Cerrar la partida es después, ya repartido. */
  terminado_en?: string | null
  /** La cara de la noche, como la de la liga. */
  foto?: string | null
}

/** Cómo quedó una noche, ya ordenada por el servidor. */
export interface ResultadoNoche {
  partida: {
    id: string
    fecha: string
    nombre: string | null
    tipo: TipoPartida
    estado: 'abierta' | 'cerrada'
  }
  /** Lo que hubo sobre la mesa: la suma de lo que puso cada quien. */
  mesa: number
  filas: {
    usuarioId: string
    nombre: string
    foto: string | null
    puso: number
    saco: number
    resultado: number
    /** Lugar en el resultado de la noche: 1 = ganó. */
    lugar: number
    /** Lugar capturado del torneo, si es torneo. */
    lugarTorneo: number | null
    recompras: number
  }[]
}

/** Lo que se ve al abrir el link de una partida, antes de apuntarse. */
export interface InvitacionPartida {
  partida: {
    id: string
    fecha: string
    nombre: string | null
    tipo: TipoPartida
    estado: 'abierta' | 'cerrada'
    registroCerrado: boolean
    registroHasta: string | null
    /** La de la partida, o la de la liga si la partida no tiene. */
    foto: string | null
  }
  liga: { id: string; nombre: string }
  /** Con cuánto entraría. */
  cuesta: number
  /** De qué consta, para poder leerlo antes de apuntarse. null en cash. */
  torneo: ConfigTorneo | null
  jugadores: number
  yaApuntado: boolean
}

/** El mensaje del ganador de la última noche cerrada, que es el que se ve en la liga. */
export interface Presume {
  texto: string
  partidaId: string
  etiqueta: string
  autor: string | null
  foto: string | null
}

export interface Participacion {
  id: string
  partida_id: string
  usuario_id: string
  entrada: number
  /** JSON crudo tal como lo guarda SQLite. */
  recompras: string
  fichas_manual: string | null
  fichas_final: string
  rebuys: number
  addons: number
  lugar: number
  /** Lo que de verdad se le entregó. null = todavía no se reparte el dinero. */
  pagado: number | null
  /** Quién capturó el conteo de fichas del final. */
  contadas_por: string | null
  contadas_por_nombre: string | null
  /** Cuándo se le dio por cerrado en el cash out. null = sigue abierto. */
  cerrado_en: string | null
  nombre: string
  usuario: string
  foto: string | null
}

export interface Posicion {
  usuarioId: string
  nombre: string
  usuario: string
  foto: string | null

  partidas: number
  invertido: number
  recuperado: number
  balance: number

  /** Balance ÷ invertido, en %. Mide el rendimiento sin premiar al que juega más. */
  roi: number
  /** Balance ÷ partidas: cuánto deja una noche típica. */
  promedio: number
  /** Qué tanto de las partidas de la liga jugó, en %. */
  asistencia: number

  mejor: number
  peor: number
  /** Partidas en las que terminó con saldo a favor. */
  ganadas: number
  podios: number
  ultimos: number
  puntos: number
  /** Los mismos puntos divididos entre las noches que vino. */
  puntosPorNoche: number

  /** Positiva = noches ganando seguidas; negativa = perdiendo. */
  rachaActual: number
  mejorRacha: number

  /**
   * Qué tanto se mueve de una noche a otra, en pesos.
   *
   * Dos personas pueden acabar con el mismo saldo jugando de maneras opuestas: una
   * ganando y perdiendo trescientos cada viernes, la otra haciendo tres mil una noche y
   * perdiendo dos mil ochocientos la siguiente. El saldo no las distingue; esto sí.
   * Cero = todavía no hay con qué medirlo.
   */
  volatilidad: number
  /** El saldo acumulado después de cada noche de `fechas`, para la gráfica. */
  serie: number[]

  recompras: number
  montoRecompras: number

  /** `false` si ya no está en la liga pero jugó partidas que siguen contando. */
  esMiembro: boolean

  /**
   * Si tiene derecho a subir al podio. Sus puntos cuentan igual y sale en la tabla donde
   * le toque; lo único que no puede es salir en el cuadro de campeones sin haber venido
   * lo que pida la liga. Sin mínimo puesto, todos lo tienen.
   */
  puedePodio?: boolean

  /** Cuántas de sus noches entraron al campeonato. Todas, mientras no haya descarte. */
  nochesContadas?: number

  /** Sus noches de la temporada, en orden, con las descartadas marcadas. */
  detalle?: NocheDeAlguien[]

  /** Lo que se ganó presumir. */
  titulos: Titulo[]
}

/** Una de las noches de alguien, como se ve al abrir su tarjeta. */
export interface NocheDeAlguien {
  fecha: string
  nombre: string | null
  resultado: number
  puntos: number
  /** `false` si quedó fuera del campeonato por la regla de las mejores noches. */
  cuenta: boolean
}

export type IdTitulo =
  | 'rey'
  | 'tiburon'
  | 'racha'
  | 'seco'
  | 'cajero'
  | 'comefichas'
  | 'infalible'
  | 'fiel'
  | 'palazo'
  | 'batacazo'

export interface Titulo {
  id: IdTitulo
  etiqueta: string
  porque: string
}

export interface RecordLiga {
  etiqueta: string
  nombre: string
  valor: number
  detalle?: string
}

/** Cómo le ha ido a dos personas una contra la otra. */
export interface Duelo {
  a: string
  b: string
  /** Noches en las que `a` quedó arriba de `b`. */
  ganoA: number
  ganoB: number
}

export interface TablaPosiciones {
  posiciones: Posicion[]
  partidasContadas: number
  partidasAbiertas: number
  dineroMovido: number
  promedioMesa: number
  mayorMesa: { monto: number; detalle: string } | null
  records: RecordLiga[]
  /** Las fechas que dibuja la gráfica, en orden. Son las últimas noches nada más. */
  fechas: string[]
  /** Quién le ha ganado a quién, contando sólo las noches en que jugaron los dos. */
  caraACara: Duelo[]
  /** Las temporadas de la liga, de la más nueva a la más vieja. Vacío si no usa. */
  temporadas: Temporada[]
  /** Cuál se está viendo. En null, la liga entera. */
  temporada: string | null
  /** El por ciento de noches que cuenta para los puntos. 0 = cuentan todas. */
  mejoresNoches?: number
  /** Cuántas noches son ésas, ya sacada la cuenta. 0 = cuentan todas. */
  cupoDeNoches?: number
  /** A cuántas noches hay que haber venido para el podio. 0 = no se pide por noches. */
  minimoNoches?: number
  /** O el por ciento, si la liga lo puso así. 0 = no se pide por ciento. */
  minimoPodio?: number
}

/**
 * Un pedazo del calendario de la liga: el semestre que se cobra en diciembre.
 *
 * Cada noche cae en la suya por su fecha, sin etiquetar nada. `hasta` en null es la que
 * sigue corriendo. Una liga sin temporadas cuenta todas sus noches, como siempre.
 */
export interface Temporada {
  id: string
  nombre: string
  desde: string
  hasta: string | null
}

/** Quién se llevó una temporada. */
export interface Laureado {
  usuarioId: string
  nombre: string
  foto: string | null
  puntos: number
  balance: number
}

/** Un renglón del palmarés: una temporada y quién se la llevó. */
export interface LaureaDeTemporada {
  temporada: Temporada
  /** Ya cerró. Si no, el campeón es el que va ganando. */
  terminada: boolean
  noches: number
  campeon: Laureado | null
  /** El que más dinero se llevó, sólo cuando no es el mismo campeón. */
  dinero: Laureado | null
}

export interface DetallePartida {
  partida: PartidaResumen & {
    torneo: string | null
    redondeo: number | null
    /** JSON con la tabla de ciegas ya calculada. */
    estructura: string | null
    /** JSON con desde cuándo corre el reloj y cuánto llevaba antes de la pausa. */
    reloj: string | null
    /**
     * 0 si la noche quedó fuera del campeonato.
     *
     * Puede no venir: las ligas cuya base todavía no sabe de temporadas no la mandan, y
     * ahí toda noche cuenta, que es lo que ha pasado siempre.
     */
    cuenta_para_tabla?: number
  }
  liga: { id: string; nombre: string; codigo: string; colores: ChipColor[] }
  participaciones: Participacion[]
  soyAdmin: boolean
  /** Llevé el banco esa noche: soy el único que puede cerrarla. */
  soyJefe: boolean
  /** Quién ganó, una vez cerrada. Lo decide el servidor, que es quien da el micrófono. */
  ganadorId: string | null
}

/** Las columnas JSON llegan como texto; esto las abre sin tronar si vienen mal. */
export function leerJson<T>(crudo: string | null | undefined, porDefecto: T): T {
  if (!crudo) return porDefecto
  try {
    return JSON.parse(crudo) as T
  } catch {
    return porDefecto
  }
}

/* ---------- llamadas ---------- */

export const api = {
  /* cuenta */
  yo: () => pedir<{ usuario: Usuario | null }>('yo'),
  registro: (usuario: string, nombre: string, pin: string) =>
    post<{ usuario: Usuario }>('registro', { usuario, nombre, pin }),
  entrar: (usuario: string, pin: string) => post<{ usuario: Usuario }>('entrar', { usuario, pin }),
  salir: () => post<{ ok: true }>('salir'),
  guardarPerfil: (cambios: { nombre?: string; foto?: string | null }) =>
    patch<{ usuario: Usuario }>('yo', cambios),

  /* ligas */
  ligas: () => pedir<{ ligas: LigaResumen[] }>('ligas'),
  crearLiga: (nombre: string, colores: ChipColor[], foto: string | null) =>
    post<{ liga: { id: string; nombre: string; codigo: string } }>('ligas', {
      nombre,
      colores,
      foto,
    }),
  unirme: (codigo: string) =>
    post<{ liga: { id: string; nombre: string }; yaEstaba: boolean }>('ligas/unirme', { codigo }),
  liga: (id: string) =>
    pedir<{ liga: Liga; miembros: Miembro[]; soyAdmin: boolean }>(`ligas/${id}`),
  guardarLiga: (
    id: string,
    cambios: {
      nombre?: string
      colores?: ChipColor[]
      foto?: string | null
      /** Texto vacío la borra; no mandarla la deja como estaba. */
      descripcion?: string
      reglas?: SeccionReglas[]
      puntos?: EsquemaPuntos
    },
  ) =>
    patch<{ ok: true }>(`ligas/${id}`, cambios),
  cambiarAdminLiga: (ligaId: string, usuarioId: string, esAdmin: boolean) =>
    post<{ ok: true }>(`ligas/${ligaId}/admin`, { usuarioId, esAdmin }),
  borrarLiga: (id: string) => borrar<{ ok: true }>(`ligas/${id}`),
  /** Mete a la liga a alguien que no va a instalar la app. */
  /** El invitado ya se inscribió: todo lo que jugó se le pasa a su cuenta de verdad. */
  invitadoEsUsuario: (ligaId: string, invitadoId: string, usuarioId: string) =>
    post<{ ok: true; nombre: string }>(`ligas/${ligaId}/invitados/${invitadoId}/es`, {
      usuarioId,
    }),

  agregarInvitado: (ligaId: string, datos: { nombre: string; foto?: string | null }) =>
    post<{ invitado: { id: string; nombre: string; foto: string | null } }>(
      `ligas/${ligaId}/invitados`,
      datos,
    ),
  sacarMiembro: (ligaId: string, usuarioId: string) =>
    borrar<{ ok: true }>(`ligas/${ligaId}/miembros/${usuarioId}`),

  /**
   * La tabla. Sin `temporada` sale la que corre hoy; con 'todo', la liga entera.
   */
  posiciones: (ligaId: string, temporada?: string | null) =>
    pedir<TablaPosiciones>(
      `ligas/${ligaId}/posiciones${temporada ? `?temporada=${encodeURIComponent(temporada)}` : ''}`,
    ),

  /** Quién ganó cada temporada. Se pide aparte: sólo se mira en "Siempre". */
  palmares: (ligaId: string) =>
    pedir<{ palmares: LaureaDeTemporada[] }>(`ligas/${ligaId}/palmares`),

  /* temporadas */
  crearTemporada: (
    ligaId: string,
    datos: { nombre: string; desde: string; hasta: string | null },
  ) => post<{ ok: true; id: string }>(`ligas/${ligaId}/temporadas`, datos),
  cambiarTemporada: (
    ligaId: string,
    temporadaId: string,
    cambios: { nombre?: string; desde?: string; hasta?: string | null },
  ) => patch<{ ok: true }>(`ligas/${ligaId}/temporadas/${temporadaId}`, cambios),
  /** Quitarla no borra ninguna noche: vuelven a contar donde les toque. */
  borrarTemporada: (ligaId: string, temporadaId: string) =>
    borrar<{ ok: true }>(`ligas/${ligaId}/temporadas/${temporadaId}`),
  /** El nombre detrás de un código de invitación, para poder preguntar antes de entrar. */
  invitacion: (codigo: string) =>
    pedir<{ liga: { id: string; nombre: string }; yaEstaba: boolean }>(
      `ligas/invitacion/${encodeURIComponent(codigo)}`,
    ),

  /* partidas */
  partidas: (ligaId: string) =>
    pedir<{ partidas: PartidaResumen[]; presume: Presume | null }>(`ligas/${ligaId}/partidas`),
  crearPartida: (
    ligaId: string,
    datos: {
      fecha: string
      nombre?: string
      tipo: TipoPartida
      torneo?: ConfigTorneo
      /** Quién funge de banco. Sin esto, queda quien la creó. */
      jefeId?: string
      /** Instante ISO en que se deja de admitir gente sola. */
      registroHasta?: string | null
      /** La cara de la noche, ya encogida a data URL. */
      foto?: string | null
    },
  ) => post<{ partida: PartidaResumen }>(`ligas/${ligaId}/partidas`, datos),
  /** El mensaje del que ganó la noche. Texto vacío lo borra. */
  presumir: (partidaId: string, texto: string) =>
    put<{ ok: true; presume: string | null }>(`partidas/${partidaId}/presume`, { texto }),
  partida: (id: string) => pedir<DetallePartida>(`partidas/${id}`),
  /** Cómo quedó una noche, para verla dentro de la tabla de la liga. */
  resultado: (id: string) => pedir<ResultadoNoche>(`partidas/${id}/resultado`),
  /* Apuntarse uno mismo. Nadie puede apuntar ni sacar a otro por aquí. */
  invitacionPartida: (id: string) => pedir<InvitacionPartida>(`partidas/${id}/invitacion`),
  apuntarme: (id: string) => post<{ ok: true; yaEstaba: boolean }>(`partidas/${id}/apuntarme`, {}),
  desapuntarme: (id: string) => borrar<{ ok: true }>(`partidas/${id}/apuntarme`),
  borrarPartida: (id: string) => borrar<{ ok: true }>(`partidas/${id}`),
  guardarPartida: (
    id: string,
    cambios: {
      estado?: 'abierta' | 'cerrada'
      nombre?: string
      fecha?: string
      torneo?: ConfigTorneo
      redondeo?: number
      estructura?: Estructura
      reloj?: RelojTorneo
      /** Cerrar el registro deja la lista como está para todos menos el admin. */
      registroCerrado?: boolean
      /** null borra la hora de cierre; no mandarla la deja como estaba. */
      registroHasta?: string | null
      /** Apunta la hora de arranque real. Lo puede mandar cualquiera que esté jugando. */
      arrancarAhora?: boolean
      /** true apunta la hora de la última mano; false la borra y se sigue jugando. */
      terminarAhora?: boolean
      /** null la quita; no mandarla la deja como estaba. */
      foto?: string | null
      /** false deja la noche fuera del campeonato, sin borrarle nada. */
      cuentaParaTabla?: boolean
    },
  ) => patch<{ ok: true }>(`partidas/${id}`, cambios),
  cargarJugadores: (partidaId: string, jugadores: { usuarioId: string; entrada: number }[]) =>
    put<{ ok: true }>(`partidas/${partidaId}/jugadores`, { jugadores }),
  guardarParticipacion: (
    id: string,
    cambios: {
      entrada?: number
      recompras?: { dinero: number }[]
      /** Plano = una sola pila; por concepto = {entrada: {...}, r0: {...}}. */
      fichasManual?: Chips | Record<string, Chips> | null
      fichasFinal?: Chips
      rebuys?: number
      addons?: number
      lugar?: number
      /** null borra el pago; no mandarlo lo deja como estaba. */
      pagado?: number | null
      /** Darlo por cerrado en el cash out, o reabrirlo. */
      cerrado?: boolean
    },
  ) => patch<{ ok: true }>(`participaciones/${id}`, cambios),

  /* admin de la app */
  usuarios: () =>
    pedir<{ usuarios: (Usuario & { es_admin_app: number; creado_en: string; bloqueado_hasta: string | null })[] }>(
      'admin/usuarios',
    ),
  resetearPin: (usuarioId: string, pin: string) =>
    post<{ ok: true }>(`admin/usuarios/${usuarioId}/pin`, { pin }),
}
