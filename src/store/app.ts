import { create } from 'zustand'
import { ErrorApi, api, type Usuario } from '../lib/api'

/**
 * Estado de la aplicación: quién entró, en qué pantalla está y los avisos.
 *
 * Los datos de ligas y partidas NO viven aquí: los pide cada pantalla al servidor,
 * que es la única fuente de verdad ahora que varios celulares comparten liga.
 */

export type Vista = 'entrar' | 'home' | 'liga' | 'partida' | 'perfil' | 'admin'

interface Estado {
  usuario: Usuario | null
  /** `true` mientras se averigua si ya había sesión abierta. */
  comprobando: boolean

  vista: Vista
  ligaId: string | null
  partidaId: string | null

  aviso: string | null
}

interface Acciones {
  comprobarSesion: () => Promise<void>
  entrar: (usuario: string, pin: string) => Promise<void>
  registrarse: (usuario: string, nombre: string, pin: string) => Promise<void>
  salir: () => Promise<void>
  ponerUsuario: (u: Usuario) => void
  /** Llamar cuando el servidor conteste 401: devuelve a la pantalla de entrada. */
  sesionCaducada: () => void

  irAHome: () => void
  irALiga: (ligaId: string) => void
  irAPartida: (partidaId: string, ligaId?: string) => void
  irAPerfil: () => void
  irAAdmin: () => void

  avisar: (mensaje: string) => void
  limpiarAviso: () => void
}

export const useApp = create<Estado & Acciones>()((set, get) => ({
  usuario: null,
  comprobando: true,
  vista: 'entrar',
  ligaId: null,
  partidaId: null,
  aviso: null,

  comprobarSesion: async () => {
    try {
      const { usuario } = await api.yo()
      set({ usuario, comprobando: false, vista: usuario ? 'home' : 'entrar' })
    } catch {
      // Sin conexión no se puede saber; se pide entrar y ya se verá al intentarlo.
      set({ usuario: null, comprobando: false, vista: 'entrar' })
    }
  },

  entrar: async (usuario, pin) => {
    const r = await api.entrar(usuario, pin)
    set({ usuario: r.usuario, vista: 'home', ligaId: null, partidaId: null })
  },

  registrarse: async (usuario, nombre, pin) => {
    const r = await api.registro(usuario, nombre, pin)
    set({ usuario: r.usuario, vista: 'home', ligaId: null, partidaId: null })
  },

  salir: async () => {
    try {
      await api.salir()
    } catch {
      // Aunque el servidor no conteste, aquí se cierra igual.
    }
    set({ usuario: null, vista: 'entrar', ligaId: null, partidaId: null })
  },

  ponerUsuario: (usuario) => set({ usuario }),

  sesionCaducada: () => {
    set({ usuario: null, vista: 'entrar', ligaId: null, partidaId: null, aviso: 'Tu sesión expiró, entra otra vez' })
  },

  irAHome: () => set({ vista: 'home', ligaId: null, partidaId: null }),
  irALiga: (ligaId) => set({ vista: 'liga', ligaId, partidaId: null }),
  irAPartida: (partidaId, ligaId) =>
    set({ vista: 'partida', partidaId, ligaId: ligaId ?? get().ligaId }),
  irAPerfil: () => set({ vista: 'perfil' }),
  irAAdmin: () => set({ vista: 'admin' }),

  avisar: (aviso) => set({ aviso }),
  limpiarAviso: () => set({ aviso: null }),
}))

/**
 * Envuelve una llamada al API para no repetir el manejo de errores en cada pantalla:
 * enseña el mensaje del servidor y, si la sesión caducó, saca al usuario.
 */
export async function conAviso<T>(fn: () => Promise<T>): Promise<T | null> {
  const { avisar, sesionCaducada } = useApp.getState()
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ErrorApi) {
      if (err.noAutenticado) sesionCaducada()
      else avisar(err.message)
    } else {
      avisar('Algo salió mal')
    }
    return null
  }
}
