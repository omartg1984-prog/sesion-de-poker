/*
 * Los avisos del reloj del torneo.
 *
 * Van sintetizados con el propio navegador y no como archivos de audio: un mp3 decente
 * pesa más que toda la app, y aquí no hacen falta grabaciones sino tres o cuatro tonos
 * que se oigan por encima de una mesa hablando.
 *
 * El sonido es de cada teléfono, no de la partida: si fuera de la partida sonarían
 * cinco aparatos a la vez. Por eso la preferencia vive en el aparato.
 */

export type NombreSonido = 'campana' | 'caja' | 'nivel' | 'moneda' | 'fichas' | 'silencio'

export interface OpcionSonido {
  id: NombreSonido
  etiqueta: string
}

export const SONIDOS: OpcionSonido[] = [
  { id: 'campana', etiqueta: 'Campana' },
  { id: 'caja', etiqueta: 'Caja registradora' },
  { id: 'nivel', etiqueta: 'Sube de nivel' },
  { id: 'moneda', etiqueta: 'Moneda' },
  { id: 'fichas', etiqueta: 'Fichas' },
  { id: 'silencio', etiqueta: 'Sin sonido' },
]

const GUARDADO = 'onlycards_sonido'

export function sonidoGuardado(): NombreSonido {
  try {
    const v = localStorage.getItem(GUARDADO) as NombreSonido | null
    return v && SONIDOS.some((s) => s.id === v) ? v : 'campana'
  } catch {
    return 'campana'
  }
}

export function guardarSonido(id: NombreSonido) {
  try {
    localStorage.setItem(GUARDADO, id)
  } catch {
    /* en una pestaña privada no se guarda; vale para este rato */
  }
}

/* ---- el aparato de sonido ---- */

type ConAudio = typeof globalThis & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function contexto(): AudioContext | null {
  if (ctx) return ctx
  const Clase = window.AudioContext ?? (globalThis as ConAudio).webkitAudioContext
  if (!Clase) return null
  try {
    ctx = new Clase()
  } catch {
    ctx = null
  }
  return ctx
}

/**
 * El navegador no deja sonar nada hasta que la persona toca algo. Se llama al arrancar
 * el reloj y al probar un sonido, que son toques de verdad.
 */
export function despertarAudio() {
  const c = contexto()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

/** Un tono con su propia curva de apagado. */
function tono(
  c: AudioContext,
  desde: number,
  opciones: {
    hz: number
    /** A dónde se desliza el tono, si es que se desliza. */
    hasta?: number
    duracion: number
    volumen?: number
    forma?: OscillatorType
  },
) {
  const osc = c.createOscillator()
  const vol = c.createGain()
  osc.type = opciones.forma ?? 'sine'
  osc.frequency.setValueAtTime(opciones.hz, desde)
  if (opciones.hasta) osc.frequency.exponentialRampToValueAtTime(opciones.hasta, desde + opciones.duracion)

  const pico = opciones.volumen ?? 0.3
  /* Ataque muy corto y caída larga: así suena a golpe y no a pitido de microondas. */
  vol.gain.setValueAtTime(0.0001, desde)
  vol.gain.exponentialRampToValueAtTime(pico, desde + 0.008)
  vol.gain.exponentialRampToValueAtTime(0.0001, desde + opciones.duracion)

  osc.connect(vol).connect(c.destination)
  osc.start(desde)
  osc.stop(desde + opciones.duracion + 0.02)
}

/** Un golpe seco de ruido: sirve para el "cha" de la caja y para las fichas. */
function golpe(
  c: AudioContext,
  desde: number,
  opciones: { duracion: number; hz: number; volumen?: number },
) {
  const marcos = Math.floor(c.sampleRate * opciones.duracion)
  const buffer = c.createBuffer(1, Math.max(1, marcos), c.sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < marcos; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / marcos)

  const fuente = c.createBufferSource()
  fuente.buffer = buffer
  const filtro = c.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.value = opciones.hz
  filtro.Q.value = 1.2
  const vol = c.createGain()
  vol.gain.value = opciones.volumen ?? 0.25

  fuente.connect(filtro).connect(vol).connect(c.destination)
  fuente.start(desde)
}

/*
 * Cada aviso, escrito como se oye:
 *
 *  campana — el timbre del director de torneo, dos armónicos y una cola larga.
 *  caja    — el "cha-ching": el golpe del cajón y dos campanitas brillantes.
 *  nivel   — cuatro notas subiendo, como cuando algo se desbloquea.
 *  moneda  — dos notas, la segunda sostenida; la de agarrar una moneda.
 *  fichas  — un puñado de fichas cayendo sobre la mesa.
 */
const RECETAS: Record<Exclude<NombreSonido, 'silencio'>, (c: AudioContext, t: number) => void> = {
  campana: (c, t) => {
    tono(c, t, { hz: 880, duracion: 1.6, volumen: 0.32 })
    tono(c, t, { hz: 1320, duracion: 1.2, volumen: 0.16 })
    tono(c, t + 0.5, { hz: 880, duracion: 1.6, volumen: 0.22 })
  },
  caja: (c, t) => {
    golpe(c, t, { duracion: 0.09, hz: 1200, volumen: 0.3 })
    tono(c, t + 0.05, { hz: 2200, duracion: 0.35, volumen: 0.22 })
    tono(c, t + 0.12, { hz: 2900, duracion: 0.5, volumen: 0.2 })
  },
  nivel: (c, t) => {
    const notas = [523, 659, 784, 1047]
    notas.forEach((hz, i) =>
      tono(c, t + i * 0.085, { hz, duracion: i === notas.length - 1 ? 0.5 : 0.14, forma: 'square', volumen: 0.16 }),
    )
  },
  moneda: (c, t) => {
    tono(c, t, { hz: 988, duracion: 0.08, forma: 'square', volumen: 0.18 })
    tono(c, t + 0.08, { hz: 1319, duracion: 0.55, forma: 'square', volumen: 0.18 })
  },
  fichas: (c, t) => {
    for (let i = 0; i < 7; i++) {
      golpe(c, t + i * 0.045 + Math.random() * 0.02, {
        duracion: 0.05,
        hz: 1400 + Math.random() * 1400,
        volumen: 0.2,
      })
    }
  },
}

/** Suena el aviso. Si el navegador no deja o el aparato está en silencio, no pasa nada. */
export function sonar(id: NombreSonido) {
  if (id === 'silencio') return
  const c = contexto()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  try {
    RECETAS[id](c, c.currentTime + 0.02)
  } catch {
    /* un aviso que no suena no puede tumbar el reloj */
  }
}
