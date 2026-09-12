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
}

export interface Liga {
  id: string
  nombre: string
  codigo: string
  foto: string | null
  /** JSON con las reglas de la casa. null = todavía no las han tocado. */
  reglas: string | null
  colores: ChipColor[]
  creada_por: string
  creada_en: string
}

export type TipoPartida = 'cash' | 'torneo'

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
}

export interface PartidaResumen {
  id: string
  liga_id: string
  fecha: string
  nombre: string | null
  tipo: TipoPartida
  estado: 'abierta' | 'cerrada'
  jugadores: number
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

  /** Positiva = noches ganando seguidas; negativa = perdiendo. */
  rachaActual: number
  mejorRacha: number

  recompras: number
  montoRecompras: number

  /** `false` si ya no está en la liga pero jugó partidas que siguen contando. */
  esMiembro: boolean

  /** Lo que se ganó presumir. */
  titulos: Titulo[]
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

export interface TablaPosiciones {
  posiciones: Posicion[]
  partidasContadas: number
  partidasAbiertas: number
  dineroMovido: number
  promedioMesa: number
  mayorMesa: { monto: number; detalle: string } | null
  records: RecordLiga[]
}

export interface DetallePartida {
  partida: PartidaResumen & {
    torneo: string | null
    redondeo: number | null
    /** JSON con la tabla de ciegas ya calculada. */
    estructura: string | null
    /** JSON con desde cuándo corre el reloj y cuánto llevaba antes de la pausa. */
    reloj: string | null
  }
  liga: { id: string; nombre: string; colores: ChipColor[] }
  participaciones: Participacion[]
  soyAdmin: boolean
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
      reglas?: SeccionReglas[]
    },
  ) =>
    patch<{ ok: true }>(`ligas/${id}`, cambios),
  cambiarAdminLiga: (ligaId: string, usuarioId: string, esAdmin: boolean) =>
    post<{ ok: true }>(`ligas/${ligaId}/admin`, { usuarioId, esAdmin }),
  borrarLiga: (id: string) => borrar<{ ok: true }>(`ligas/${id}`),
  sacarMiembro: (ligaId: string, usuarioId: string) =>
    borrar<{ ok: true }>(`ligas/${ligaId}/miembros/${usuarioId}`),

  posiciones: (ligaId: string) => pedir<TablaPosiciones>(`ligas/${ligaId}/posiciones`),

  /* partidas */
  partidas: (ligaId: string) => pedir<{ partidas: PartidaResumen[] }>(`ligas/${ligaId}/partidas`),
  crearPartida: (
    ligaId: string,
    datos: { fecha: string; nombre?: string; tipo: TipoPartida; torneo?: ConfigTorneo },
  ) => post<{ partida: PartidaResumen }>(`ligas/${ligaId}/partidas`, datos),
  partida: (id: string) => pedir<DetallePartida>(`partidas/${id}`),
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
    },
  ) => patch<{ ok: true }>(`partidas/${id}`, cambios),
  cargarJugadores: (partidaId: string, jugadores: { usuarioId: string; entrada: number }[]) =>
    put<{ ok: true }>(`partidas/${partidaId}/jugadores`, { jugadores }),
  guardarParticipacion: (
    id: string,
    cambios: {
      entrada?: number
      recompras?: { dinero: number }[]
      fichasManual?: Chips | null
      fichasFinal?: Chips
      rebuys?: number
      addons?: number
      lugar?: number
      /** null borra el pago; no mandarlo lo deja como estaba. */
      pagado?: number | null
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
