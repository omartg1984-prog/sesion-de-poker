export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

/** Fila de `usuarios` tal como vive en la base. */
export interface FilaUsuario {
  id: string
  usuario: string
  nombre: string
  foto: string | null
  pin_hash: string
  pin_sal: string
  es_admin_app: number
  /** 1 = está en la liga pero no tiene la app: lo mueve un admin. */
  es_invitado: number
  fallos: number
  bloqueado_hasta: string | null
  creado_en: string
}

/** Lo que se le manda al cliente: nunca incluye hash ni sal. */
export interface UsuarioPublico {
  id: string
  usuario: string
  nombre: string
  foto: string | null
  esAdminApp: boolean
  /** No puede entrar a la app: alguien lo lleva de la mano. */
  esInvitado: boolean
}

export function aPublico(u: FilaUsuario): UsuarioPublico {
  return {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    foto: u.foto,
    esAdminApp: u.es_admin_app === 1,
    esInvitado: u.es_invitado === 1,
  }
}

export interface ColorFicha {
  key: string
  label: string
  color: string
  value: number
  inventory: number
}
