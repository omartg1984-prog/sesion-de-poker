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
}

export function aPublico(u: FilaUsuario): UsuarioPublico {
  return {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    foto: u.foto,
    esAdminApp: u.es_admin_app === 1,
  }
}

export interface ColorFicha {
  key: string
  label: string
  color: string
  value: number
  inventory: number
}
