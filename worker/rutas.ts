import { json } from './index'
import { ganadorDe, leerJson, podioDe } from './podio'
import { calcularPosiciones } from './posiciones'
import {
  DIAS_SESION,
  FALLOS_PERMITIDOS,
  LARGO_PIN,
  MINUTOS_BLOQUEO,
  hashearPin,
  hashearToken,
  normalizarUsuario,
  nuevoCodigoLiga,
  nuevoId,
  nuevoToken,
  pinCoincide,
  pinValido,
  usuarioValido,
} from './seguridad'
import { aPublico, type ColorFicha, type Env, type FilaUsuario } from './tipos'

const COOKIE = 'sesion'

/** Una partida como sale de la lista del lobby. */
interface FilaPartidaLista {
  id: string
  fecha: string
  nombre: string | null
  tipo: string
  torneo: string | null
  estado: string
  presume: string | null
}

/** Una participación con el nombre de su dueño, para armar el podio. */
interface JugadorConNombre {
  partida_id: string
  usuario_id: string
  nombre: string
  foto: string | null
  entrada: number
  recompras: string
  fichas_final: string
  rebuys: number
  addons: number
  lugar: number
}

interface Podio {
  usuarioId: string
  nombre: string
  foto: string | null
  resultado: number
  lugar: number
}
/** Una foto de perfil no tiene por qué pesar más que esto ya redimensionada. */
const MAX_FOTO = 300_000

/**
 * Valida una foto que llega del navegador: la de un usuario o la de una liga.
 *
 * Las dos se guardan igual —un data URL con el JPEG ya encogido— así que también se
 * revisan igual. Devuelve el error en vez de lanzarlo para que cada ruta conteste con
 * su propio código y el flujo se lea de corrido.
 */
function revisarFoto(valor: unknown): { foto: string | null } | { error: string; status: number } {
  if (valor === null || valor === '') return { foto: null }
  const f = String(valor)
  if (!f.startsWith('data:image/')) return { error: 'La foto no es una imagen válida', status: 400 }
  if (f.length > MAX_FOTO) return { error: 'La foto pesa demasiado', status: 413 }
  return { foto: f }
}

const ahora = () => new Date().toISOString()
const enDias = (d: number) => new Date(Date.now() + d * 864e5).toISOString()

/* ---------- sesión ---------- */

function leerCookie(peticion: Request, nombre: string): string | null {
  const crudo = peticion.headers.get('cookie')
  if (!crudo) return null
  for (const parte of crudo.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return v.join('=')
  }
  return null
}

/**
 * `Secure` solo cuando la conexión de verdad es HTTPS. En producción siempre lo es,
 * pero el servidor de desarrollo se abre por http desde el celular (192.168.x.x) y
 * ahí el navegador descarta en silencio cualquier cookie marcada como Secure: el
 * registro funcionaría y la sesión se perdería en la siguiente petición.
 */
function cookieSesion(token: string, seguro: boolean, dias = DIAS_SESION): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.round(dias * 86400)}`]
  if (seguro) attrs.push('Secure')
  return `${COOKIE}=${token}; ${attrs.join('; ')}`
}

function cookieBorrada(seguro: boolean): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (seguro) attrs.push('Secure')
  return `${COOKIE}=; ${attrs.join('; ')}`
}

async function usuarioDe(peticion: Request, env: Env): Promise<FilaUsuario | null> {
  const token = leerCookie(peticion, COOKIE)
  if (!token) return null
  const fila = await env.DB.prepare(
    `SELECT u.* FROM sesiones s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expira_en > ?`,
  )
    .bind(await hashearToken(token), ahora())
    .first<FilaUsuario>()
  return fila ?? null
}

/* ---------- permisos de liga ---------- */

interface Membresia {
  es_admin: number
}

async function membresia(env: Env, ligaId: string, usuarioId: string): Promise<Membresia | null> {
  return await env.DB.prepare('SELECT es_admin FROM miembros WHERE liga_id = ? AND usuario_id = ?')
    .bind(ligaId, usuarioId)
    .first<Membresia>()
}

/* ---------- enrutador ---------- */

export async function rutas(
  peticion: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
): Promise<Response | null> {
  const partes = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const metodo = peticion.method
  const seguro = url.protocol === 'https:'
  const cuerpo = async <T>(): Promise<T> => {
    try {
      return (await peticion.json()) as T
    } catch {
      return {} as T
    }
  }

  /* ===== registro y entrada ===== */

  if (partes[0] === 'registro' && metodo === 'POST') {
    const { usuario, nombre, pin } = await cuerpo<Record<string, unknown>>()
    const u = normalizarUsuario(usuario)
    const nom = String(nombre ?? '').trim()

    if (!usuarioValido(u))
      return json({ error: 'El usuario debe tener entre 3 y 20 letras, números, punto, guion o guion bajo, sin espacios' }, 400)
    if (!nom) return json({ error: 'Falta tu nombre' }, 400)
    if (!pinValido(pin)) return json({ error: `El PIN debe ser de ${LARGO_PIN} dígitos` }, 400)

    const existe = await env.DB.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').bind(u).first()
    if (existe) return json({ error: 'Ese usuario ya está tomado' }, 409)

    // El primero que se registra queda como admin de la app: es quien la instaló.
    const hayAlguien = await env.DB.prepare('SELECT 1 FROM usuarios LIMIT 1').first()
    const { hash, sal } = await hashearPin(pin)
    const id = nuevoId()

    await env.DB.prepare(
      `INSERT INTO usuarios (id, usuario, nombre, foto, pin_hash, pin_sal, es_admin_app, creado_en)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    )
      .bind(id, u, nom, hash, sal, hayAlguien ? 0 : 1, ahora())
      .run()

    const { token, hash: th } = await nuevoToken()
    await env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, creada_en, expira_en) VALUES (?, ?, ?, ?)')
      .bind(th, id, ahora(), enDias(DIAS_SESION))
      .run()

    const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first<FilaUsuario>()
    return json({ usuario: aPublico(fila!) }, 201, { 'set-cookie': cookieSesion(token, seguro) })
  }

  if (partes[0] === 'entrar' && metodo === 'POST') {
    const { usuario, pin } = await cuerpo<Record<string, unknown>>()
    const u = normalizarUsuario(usuario)
    const fila = await env.DB.prepare('SELECT * FROM usuarios WHERE usuario = ?').bind(u).first<FilaUsuario>()

    // Mismo mensaje exista o no el usuario: no se confirma quién está registrado.
    const generico = json({ error: 'Usuario o PIN incorrecto' }, 401)
    if (!fila || !pinValido(pin)) return generico

    if (fila.bloqueado_hasta && fila.bloqueado_hasta > ahora()) {
      const faltan = Math.ceil((Date.parse(fila.bloqueado_hasta) - Date.now()) / 60000)
      return json({ error: `Demasiados intentos. Espera ${faltan} minuto${faltan === 1 ? '' : 's'}.` }, 429)
    }

    if (!(await pinCoincide(pin, fila.pin_hash, fila.pin_sal))) {
      const fallos = fila.fallos + 1
      const bloqueo = fallos >= FALLOS_PERMITIDOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000).toISOString() : null
      await env.DB.prepare('UPDATE usuarios SET fallos = ?, bloqueado_hasta = ? WHERE id = ?')
        .bind(bloqueo ? 0 : fallos, bloqueo, fila.id)
        .run()
      if (bloqueo)
        return json({ error: `Demasiados intentos. Espera ${MINUTOS_BLOQUEO} minutos.` }, 429)
      return generico
    }

    await env.DB.prepare('UPDATE usuarios SET fallos = 0, bloqueado_hasta = NULL WHERE id = ?').bind(fila.id).run()
    const { token, hash: th } = await nuevoToken()
    await env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, creada_en, expira_en) VALUES (?, ?, ?, ?)')
      .bind(th, fila.id, ahora(), enDias(DIAS_SESION))
      .run()

    return json({ usuario: aPublico(fila) }, 200, { 'set-cookie': cookieSesion(token, seguro) })
  }

  if (partes[0] === 'salir' && metodo === 'POST') {
    const token = leerCookie(peticion, COOKIE)
    if (token)
      await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await hashearToken(token)).run()
    return json({ ok: true }, 200, { 'set-cookie': cookieBorrada(seguro) })
  }

  /* ===== de aquí en adelante hace falta sesión ===== */

  const yo = await usuarioDe(peticion, env)

  if (partes[0] === 'yo') {
    if (metodo === 'GET') {
      return yo ? json({ usuario: aPublico(yo) }) : json({ usuario: null })
    }
    if (!yo) return json({ error: 'Entra a tu cuenta primero' }, 401)

    if (metodo === 'PATCH') {
      const { nombre, foto } = await cuerpo<Record<string, unknown>>()
      const nom = nombre === undefined ? yo.nombre : String(nombre).trim()
      if (!nom) return json({ error: 'El nombre no puede quedar vacío' }, 400)

      let nuevaFoto = yo.foto
      if (foto !== undefined) {
        const r = revisarFoto(foto)
        if ('error' in r) return json({ error: r.error }, r.status)
        nuevaFoto = r.foto
      }

      await env.DB.prepare('UPDATE usuarios SET nombre = ?, foto = ? WHERE id = ?')
        .bind(nom, nuevaFoto, yo.id)
        .run()
      return json({ usuario: { ...aPublico(yo), nombre: nom, foto: nuevaFoto } })
    }
  }

  if (!yo) return json({ error: 'Entra a tu cuenta primero' }, 401)

  /* ===== ligas ===== */

  if (partes[0] === 'ligas') {
    // GET /api/ligas — las ligas a las que pertenezco
    if (partes.length === 1 && metodo === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT l.id, l.nombre, l.codigo, l.foto, l.creada_en, m.es_admin,
                (SELECT COUNT(*) FROM miembros x WHERE x.liga_id = l.id) AS miembros,
                (SELECT COUNT(*) FROM partidas p WHERE p.liga_id = l.id) AS partidas
         FROM miembros m JOIN ligas l ON l.id = m.liga_id
         WHERE m.usuario_id = ?
         ORDER BY l.creada_en DESC`,
      )
        .bind(yo.id)
        .all()
      return json({ ligas: results })
    }

    // POST /api/ligas — crear
    if (partes.length === 1 && metodo === 'POST') {
      const { nombre, colores, foto } = await cuerpo<Record<string, unknown>>()
      const nom = String(nombre ?? '').trim()
      if (!nom) return json({ error: 'Ponle nombre a la liga' }, 400)
      if (!Array.isArray(colores) || colores.length === 0)
        return json({ error: 'Define al menos un color de ficha' }, 400)
      const revisada = revisarFoto(foto ?? null)
      if ('error' in revisada) return json({ error: revisada.error }, revisada.status)

      const id = nuevoId()
      // Un choque de código es improbable, pero si pasa se reintenta en vez de fallar.
      let codigo = ''
      for (let intento = 0; intento < 5; intento++) {
        codigo = nuevoCodigoLiga()
        const choca = await env.DB.prepare('SELECT 1 FROM ligas WHERE codigo = ?').bind(codigo).first()
        if (!choca) break
        codigo = ''
      }
      if (!codigo) return json({ error: 'No se pudo generar el código, inténtalo otra vez' }, 500)

      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO ligas (id, nombre, codigo, colores, foto, creada_por, creada_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(id, nom, codigo, JSON.stringify(colores), revisada.foto, yo.id, ahora()),
        env.DB.prepare(
          'INSERT INTO miembros (liga_id, usuario_id, es_admin, entro_en) VALUES (?, ?, 1, ?)',
        ).bind(id, yo.id, ahora()),
      ])
      return json({ liga: { id, nombre: nom, codigo, es_admin: 1 } }, 201)
    }

    // POST /api/ligas/unirme — entrar con código
    if (partes[1] === 'unirme' && metodo === 'POST') {
      const { codigo } = await cuerpo<Record<string, unknown>>()
      const cod = String(codigo ?? '').trim().toUpperCase()
      const liga = await env.DB.prepare('SELECT id, nombre FROM ligas WHERE codigo = ?')
        .bind(cod)
        .first<{ id: string; nombre: string }>()
      if (!liga) return json({ error: 'Ese código no existe' }, 404)

      const ya = await membresia(env, liga.id, yo.id)
      if (ya) return json({ liga, yaEstaba: true })

      await env.DB.prepare('INSERT INTO miembros (liga_id, usuario_id, es_admin, entro_en) VALUES (?, ?, 0, ?)')
        .bind(liga.id, yo.id, ahora())
        .run()
      return json({ liga, yaEstaba: false }, 201)
    }

    /*
     * GET /api/ligas/invitacion/:codigo — sólo el nombre.
     *
     * Es para poder preguntar "¿entrar a Los Domingos?" en vez de "¿entrar a 5GNNTH?".
     * No filtra nada: quien trae el código ya podía entrar con él.
     */
    if (partes[1] === 'invitacion' && partes[2] && metodo === 'GET') {
      const liga = await env.DB.prepare('SELECT id, nombre FROM ligas WHERE codigo = ?')
        .bind(String(partes[2]).trim().toUpperCase())
        .first<{ id: string; nombre: string }>()
      if (!liga) return json({ error: 'Esa invitación ya no sirve' }, 404)
      return json({ liga, yaEstaba: !!(await membresia(env, liga.id, yo.id)) })
    }

    const ligaId = partes[1]
    if (ligaId) {
      const mia = await membresia(env, ligaId, yo.id)
      if (!mia && !yo.es_admin_app) return json({ error: 'No perteneces a esa liga' }, 403)
      const esAdminLiga = mia?.es_admin === 1 || yo.es_admin_app === 1

      // GET /api/ligas/:id — liga con sus miembros
      if (partes.length === 2 && metodo === 'GET') {
        const liga = await env.DB.prepare('SELECT * FROM ligas WHERE id = ?').bind(ligaId).first()
        if (!liga) return json({ error: 'Liga no encontrada' }, 404)
        const { results: miembros } = await env.DB.prepare(
          `SELECT u.id, u.usuario, u.nombre, u.foto, m.es_admin
           FROM miembros m JOIN usuarios u ON u.id = m.usuario_id
           WHERE m.liga_id = ? ORDER BY u.nombre COLLATE NOCASE`,
        )
          .bind(ligaId)
          .all()
        return json({
          liga: { ...liga, colores: JSON.parse(String(liga.colores)) },
          miembros,
          soyAdmin: esAdminLiga,
        })
      }

      // PATCH /api/ligas/:id — nombre e inventario de fichas
      if (partes.length === 2 && metodo === 'PATCH') {
        if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede cambiar esto' }, 403)
        const { nombre, colores, foto, reglas } = await cuerpo<Record<string, unknown>>()
        const actual = await env.DB.prepare('SELECT nombre, colores, foto FROM ligas WHERE id = ?')
          .bind(ligaId)
          .first<{ nombre: string; colores: string; foto: string | null }>()
        if (!actual) return json({ error: 'Liga no encontrada' }, 404)

        const nom = nombre === undefined ? actual.nombre : String(nombre).trim()
        if (!nom) return json({ error: 'La liga necesita un nombre' }, 400)
        const cols = colores === undefined ? actual.colores : JSON.stringify(colores)
        /* `foto: null` la quita; no mandarla la deja como estaba. */
        let img = actual.foto
        if (foto !== undefined) {
          const r = revisarFoto(foto)
          if ('error' in r) return json({ error: r.error }, r.status)
          img = r.foto
        }

        await env.DB.prepare(
          'UPDATE ligas SET nombre = ?, colores = ?, foto = ?, reglas = COALESCE(?, reglas) WHERE id = ?',
        )
          .bind(nom, cols, img, reglas === undefined ? null : JSON.stringify(reglas), ligaId)
          .run()
        return json({ ok: true })
      }

      // POST /api/ligas/:id/admin — dar o quitar admin de liga
      if (partes[2] === 'admin' && metodo === 'POST') {
        if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede cambiar esto' }, 403)
        const { usuarioId, esAdmin } = await cuerpo<Record<string, unknown>>()
        const objetivo = String(usuarioId ?? '')
        if (!(await membresia(env, ligaId, objetivo)))
          return json({ error: 'Esa persona no está en la liga' }, 404)

        // No se permite quedarse sin ningún admin.
        if (!esAdmin) {
          const { total } = (await env.DB.prepare(
            'SELECT COUNT(*) AS total FROM miembros WHERE liga_id = ? AND es_admin = 1',
          )
            .bind(ligaId)
            .first<{ total: number }>())!
          if (total <= 1) return json({ error: 'La liga necesita al menos un admin' }, 409)
        }

        await env.DB.prepare('UPDATE miembros SET es_admin = ? WHERE liga_id = ? AND usuario_id = ?')
          .bind(esAdmin ? 1 : 0, ligaId, objetivo)
          .run()
        return json({ ok: true })
      }

      // DELETE /api/ligas/:id — borra la liga con todo su historial
      if (partes.length === 2 && metodo === 'DELETE') {
        const liga = await env.DB.prepare('SELECT creada_por FROM ligas WHERE id = ?')
          .bind(ligaId)
          .first<{ creada_por: string }>()
        if (!liga) return json({ error: 'Liga no encontrada' }, 404)
        // Borrar una liga destruye las partidas de TODOS sus miembros, no solo las
        // propias: por eso no basta ser admin de liga, tiene que ser quien la creó.
        if (liga.creada_por !== yo.id && yo.es_admin_app !== 1)
          return json({ error: 'Solo quien creó la liga puede borrarla' }, 403)

        await env.DB.prepare('DELETE FROM ligas WHERE id = ?').bind(ligaId).run()
        return json({ ok: true })
      }

      // DELETE /api/ligas/:id/miembros/:usuarioId — sacar a alguien, o salirse uno mismo
      if (partes[2] === 'miembros' && partes[3] && metodo === 'DELETE') {
        const objetivo = partes[3]
        const soyYo = objetivo === yo.id
        if (!soyYo && !esAdminLiga)
          return json({ error: 'Solo un admin de la liga puede sacar a alguien' }, 403)

        const suya = await membresia(env, ligaId, objetivo)
        if (!suya) return json({ error: 'Esa persona no está en la liga' }, 404)

        // La liga no se puede quedar sin nadie que la administre.
        if (suya.es_admin === 1) {
          const { total } = (await env.DB.prepare(
            'SELECT COUNT(*) AS total FROM miembros WHERE liga_id = ? AND es_admin = 1',
          )
            .bind(ligaId)
            .first<{ total: number }>())!
          if (total <= 1)
            return json(
              { error: soyYo ? 'Eres el único admin: nombra a otro antes de salirte' : 'La liga necesita al menos un admin' },
              409,
            )
        }

        // Se borra la membresía, no las participaciones: esas partidas se jugaron y
        // su historial sigue siendo cierto.
        await env.DB.prepare('DELETE FROM miembros WHERE liga_id = ? AND usuario_id = ?')
          .bind(ligaId, objetivo)
          .run()
        return json({ ok: true })
      }

      // GET /api/ligas/:id/posiciones — tabla acumulada de la liga
      if (partes[2] === 'posiciones' && metodo === 'GET') {
        return json(await calcularPosiciones(env, ligaId))
      }

      /* ===== partidas de la liga ===== */

      if (partes[2] === 'partidas') {
        if (metodo === 'GET') {
          const { results: filas } = await env.DB.prepare(
            `SELECT p.*, (SELECT COUNT(*) FROM participaciones x WHERE x.partida_id = p.id) AS jugadores
             FROM partidas p WHERE p.liga_id = ? ORDER BY p.fecha DESC, p.creada_en DESC`,
          )
            .bind(ligaId)
            .all<FilaPartidaLista>()

          /* El lobby abre con esta lista, así que cada noche llega con su podio ya
             resuelto: entrar a ver quién ganó una por una era el trabajo que hacía
             falta hacer a mano. Las abiertas no traen podio porque todavía no hay. */
          const cerradas = filas.filter((f) => f.estado === 'cerrada')
          const podios = new Map<string, Podio[]>()

          if (cerradas.length > 0) {
            const liga = await env.DB.prepare('SELECT colores FROM ligas WHERE id = ?')
              .bind(ligaId)
              .first<{ colores: string }>()
            const colores = leerJson<ColorFicha[]>(liga?.colores, [])
            const marcas = cerradas.map(() => '?').join(',')
            const { results: jugadores } = await env.DB.prepare(
              `SELECT p.partida_id, p.usuario_id, u.nombre, u.foto,
                      p.entrada, p.recompras, p.fichas_final, p.rebuys, p.addons, p.lugar
               FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
               WHERE p.partida_id IN (${marcas})`,
            )
              .bind(...cerradas.map((f) => f.id))
              .all<JugadorConNombre>()

            const porPartida = new Map<string, JugadorConNombre[]>()
            for (const j of jugadores) {
              const lista = porPartida.get(j.partida_id) ?? []
              lista.push(j)
              porPartida.set(j.partida_id, lista)
            }

            for (const f of cerradas) {
              const suyos = porPartida.get(f.id) ?? []
              if (suyos.length === 0) continue
              podios.set(
                f.id,
                podioDe(f, suyos, colores)
                  .slice(0, 3)
                  .map((n) => ({
                    usuarioId: n.jugador.usuario_id,
                    nombre: n.jugador.nombre,
                    foto: n.jugador.foto,
                    resultado: n.resultado,
                    lugar: n.lugar,
                  })),
              )
            }
          }

          /* El derecho a presumir es de la última noche cerrada, no de todas: por eso
             el mensaje viejo desaparece solo en cuanto se cierra otra partida. */
          const ultima = cerradas[0]
          const presume =
            ultima && ultima.presume
              ? {
                  texto: ultima.presume,
                  partidaId: ultima.id,
                  etiqueta: ultima.nombre || ultima.fecha,
                  autor: podios.get(ultima.id)?.[0]?.nombre ?? null,
                  foto: podios.get(ultima.id)?.[0]?.foto ?? null,
                }
              : null

          return json({
            partidas: filas.map((f) => ({ ...f, podio: podios.get(f.id) ?? [] })),
            presume,
          })
        }

        if (metodo === 'POST') {
          if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede crear partidas' }, 403)
          const { fecha, nombre, tipo, torneo, jefeId } = await cuerpo<Record<string, unknown>>()

          /* El jefe de la noche: quien funge de banco. Si no dicen quién, es quien la
             creó, que es el que está con el teléfono en la mano. */
          const jefe = jefeId === undefined || jefeId === null ? yo.id : String(jefeId)
          if (!(await membresia(env, ligaId, jefe)))
            return json({ error: 'El jefe de la partida tiene que estar en la liga' }, 400)
          const f = String(fecha ?? '').trim() || ahora().slice(0, 10)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return json({ error: 'La fecha no es válida' }, 400)

          const t = tipo === 'torneo' ? 'torneo' : 'cash'
          // El torneo nace con una estructura por defecto para que se pueda abrir
          // la partida y ajustarla adentro, sin trabar la creación.
          const configTorneo =
            t === 'torneo'
              ? JSON.stringify(
                  torneo ?? { buyIn: 0, rebuyPrice: 0, addOnPrice: 0, payouts: [{ pct: 50 }, { pct: 30 }, { pct: 20 }] },
                )
              : null

          const id = nuevoId()
          await env.DB.prepare(
            'INSERT INTO partidas (id, liga_id, fecha, nombre, tipo, torneo, estado, jefe_id, creada_por, creada_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
            .bind(id, ligaId, f, String(nombre ?? '').trim() || null, t, configTorneo, 'abierta', jefe, yo.id, ahora())
            .run()
          return json(
            { partida: { id, liga_id: ligaId, fecha: f, tipo: t, estado: 'abierta', jefe_id: jefe } },
            201,
          )
        }
      }
    }
  }

  /* ===== una partida ===== */

  if (partes[0] === 'partidas' && partes[1]) {
    const partidaId = partes[1]
    const partida = await env.DB.prepare('SELECT * FROM partidas WHERE id = ?')
      .bind(partidaId)
      .first<{ id: string; liga_id: string; estado: string; jefe_id: string | null }>()
    if (!partida) return json({ error: 'Partida no encontrada' }, 404)

    const mia = await membresia(env, partida.liga_id, yo.id)
    if (!mia && !yo.es_admin_app) return json({ error: 'No perteneces a esa liga' }, 403)
    const esAdminLiga = mia?.es_admin === 1 || yo.es_admin_app === 1

    if (partes.length === 2 && metodo === 'GET') {
      const liga = await env.DB.prepare('SELECT id, nombre, colores FROM ligas WHERE id = ?')
        .bind(partida.liga_id)
        .first<{ id: string; nombre: string; colores: string }>()
      const { results: participaciones } = await env.DB.prepare(
        `SELECT p.*, u.nombre, u.usuario, u.foto,
                (SELECT c.nombre FROM usuarios c WHERE c.id = p.contadas_por) AS contadas_por_nombre
         FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.partida_id = ? ORDER BY u.nombre COLLATE NOCASE`,
      )
        .bind(partidaId)
        .all()
      /* Quién ganó lo dice el servidor, no la pantalla: es lo mismo que decide quién
         tiene derecho a presumir, y las dos respuestas tienen que ser una sola. */
      const completa = partida as unknown as { tipo: string; torneo: string | null }
      const gano =
        partida.estado === 'cerrada'
          ? ganadorDe(
              completa,
              participaciones as unknown as JugadorConNombre[],
              JSON.parse(liga!.colores) as ColorFicha[],
            )
          : null

      return json({
        partida,
        liga: { ...liga, colores: JSON.parse(liga!.colores) },
        participaciones,
        soyAdmin: esAdminLiga,
        soyJefe: partida.jefe_id ? partida.jefe_id === yo.id : esAdminLiga,
        ganadorId: gano?.usuario_id ?? null,
      })
    }

    if (partes.length === 2 && metodo === 'DELETE') {
      if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede borrar la partida' }, 403)
      await env.DB.prepare('DELETE FROM partidas WHERE id = ?').bind(partidaId).run()
      return json({ ok: true })
    }

    if (partes.length === 2 && metodo === 'PATCH') {
      const { estado, nombre, fecha, torneo, redondeo, estructura, reloj } =
        await cuerpo<Record<string, unknown>>()
      if (estado !== undefined && estado !== 'abierta' && estado !== 'cerrada')
        return json({ error: 'Estado inválido' }, 400)

      /*
       * Abrir y cerrar la noche es del jefe de la partida y de nadie más, aunque haya
       * otros admins en la liga y aunque el jefe no sea admin: es quien recibió el
       * dinero y a quien le reclaman si algo no cuadra.
       *
       * Las partidas de antes de que existiera el jefe no tienen a nadie apuntado; ésas
       * las sigue cerrando cualquier admin, como siempre.
       */
      const esJefe = partida.jefe_id ? partida.jefe_id === yo.id : esAdminLiga
      if (estado !== undefined && !esJefe && yo.es_admin_app !== 1) {
        const jefe = await env.DB.prepare('SELECT nombre FROM usuarios WHERE id = ?')
          .bind(partida.jefe_id)
          .first<{ nombre: string }>()
        return json(
          { error: `Esta partida la cierra ${jefe?.nombre ?? 'su jefe'}, que llevó el banco` },
          403,
        )
      }

      /* Todo lo demás de la partida —nombre, fecha, ciegas, reloj— sigue siendo de los
         admins: el jefe lleva el banco, no la configuración. */
      const tocaAlgoMas = [nombre, fecha, torneo, redondeo, estructura, reloj].some(
        (v) => v !== undefined,
      )
      if (tocaAlgoMas && !esAdminLiga)
        return json({ error: 'Solo un admin de la liga puede cambiar la partida' }, 403)
      await env.DB.prepare(
        `UPDATE partidas SET
           estado = COALESCE(?, estado),
           nombre = COALESCE(?, nombre),
           fecha  = COALESCE(?, fecha),
           torneo = COALESCE(?, torneo),
           redondeo = COALESCE(?, redondeo),
           estructura = COALESCE(?, estructura),
           reloj = COALESCE(?, reloj)
         WHERE id = ?`,
      )
        .bind(
          estado ?? null,
          nombre ?? null,
          fecha ?? null,
          torneo === undefined ? null : JSON.stringify(torneo),
          redondeo === undefined ? null : Math.max(1, Math.floor(Number(redondeo) || 1)),
          estructura === undefined ? null : JSON.stringify(estructura),
          reloj === undefined ? null : JSON.stringify(reloj),
          partidaId,
        )
        .run()
      return json({ ok: true })
    }

    /*
     * GET /api/partidas/:id/resultado — cómo quedó esa noche, ya ordenado.
     *
     * Es lo que le da de comer a la vista "por partida" de la tabla de la liga. Se
     * calcula aquí y no en el teléfono para que use la misma regla que el podio del
     * lobby y que la tabla acumulada: una sola cuenta de quién ganó una noche.
     */
    if (partes[2] === 'resultado' && metodo === 'GET') {
      const liga = await env.DB.prepare('SELECT colores FROM ligas WHERE id = ?')
        .bind(partida.liga_id)
        .first<{ colores: string }>()
      const { results: jugadores } = await env.DB.prepare(
        `SELECT p.partida_id, p.usuario_id, u.nombre, u.foto,
                p.entrada, p.recompras, p.fichas_final, p.rebuys, p.addons, p.lugar
         FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.partida_id = ?`,
      )
        .bind(partidaId)
        .all<JugadorConNombre>()

      const completa = await env.DB.prepare(
        'SELECT fecha, nombre, tipo, torneo, estado FROM partidas WHERE id = ?',
      )
        .bind(partidaId)
        .first<{ fecha: string; nombre: string | null; tipo: string; torneo: string | null; estado: string }>()

      const orden = podioDe(completa!, jugadores, leerJson<ColorFicha[]>(liga?.colores, []))
      return json({
        partida: {
          id: partidaId,
          fecha: completa!.fecha,
          nombre: completa!.nombre,
          tipo: completa!.tipo,
          estado: completa!.estado,
        },
        /* Lo que hubo sobre la mesa esa noche: la suma de lo que puso cada quien. */
        mesa: orden.reduce((t, n) => t + n.puso, 0),
        filas: orden.map((n) => ({
          usuarioId: n.jugador.usuario_id,
          nombre: n.jugador.nombre,
          foto: n.jugador.foto,
          puso: n.puso,
          saco: n.saco,
          resultado: n.resultado,
          lugar: n.lugar,
          /* El lugar del torneo lo captura un admin; el de la tabla sale del resultado.
             Los dos importan: uno paga el premio, el otro ordena la noche. */
          lugarTorneo: n.jugador.lugar || null,
          recompras: n.recompras,
        })),
      })
    }

    /*
     * PUT /api/partidas/:id/presume — el mensaje del que ganó la noche.
     *
     * No lo escribe un admin ni el jefe: lo escribe el que ganó, y nadie más. Por eso
     * el permiso no se pregunta por el rol sino por el resultado, con la misma cuenta
     * que arma el podio del lobby.
     */
    if (partes[2] === 'presume' && metodo === 'PUT') {
      if (partida.estado !== 'cerrada')
        return json({ error: 'Todavía no acaba la partida' }, 409)

      const liga = await env.DB.prepare('SELECT colores FROM ligas WHERE id = ?')
        .bind(partida.liga_id)
        .first<{ colores: string }>()
      const { results: jugadores } = await env.DB.prepare(
        `SELECT p.partida_id, p.usuario_id, u.nombre, u.foto,
                p.entrada, p.recompras, p.fichas_final, p.rebuys, p.addons, p.lugar
         FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.partida_id = ?`,
      )
        .bind(partidaId)
        .all<JugadorConNombre>()

      const completa = await env.DB.prepare('SELECT tipo, torneo FROM partidas WHERE id = ?')
        .bind(partidaId)
        .first<{ tipo: string; torneo: string | null }>()
      const gano = ganadorDe(completa!, jugadores, leerJson<ColorFicha[]>(liga?.colores, []))

      if (!gano || gano.usuario_id !== yo.id)
        return json({ error: 'Presume el que ganó la noche' }, 403)

      const { texto } = await cuerpo<Record<string, unknown>>()
      /* Vacío borra el mensaje: es cómo se baja uno del escenario. */
      const limpio = String(texto ?? '').trim().slice(0, 280)
      await env.DB.prepare('UPDATE partidas SET presume = ?, presume_en = ? WHERE id = ?')
        .bind(limpio || null, limpio ? ahora() : null, partidaId)
        .run()
      return json({ ok: true, presume: limpio || null })
    }

    // PUT /api/partidas/:id/jugadores — quiénes asistieron y con cuánto entran
    if (partes[2] === 'jugadores' && metodo === 'PUT') {
      if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede cargar jugadores' }, 403)
      const { jugadores } = await cuerpo<{ jugadores?: { usuarioId: string; entrada: number }[] }>()
      if (!Array.isArray(jugadores)) return json({ error: 'Faltan los jugadores' }, 400)

      const ids = jugadores.map((j) => String(j.usuarioId))
      // Solo se pueden cargar personas que estén en la liga.
      for (const id of ids) {
        if (!(await membresia(env, partida.liga_id, id)))
          return json({ error: 'Alguien de la lista no pertenece a la liga' }, 400)
      }

      const sentencias = [
        // quien ya no está en la lista sale de la partida
        ids.length
          ? env.DB.prepare(
              `DELETE FROM participaciones WHERE partida_id = ? AND usuario_id NOT IN (${ids.map(() => '?').join(',')})`,
            ).bind(partidaId, ...ids)
          : env.DB.prepare('DELETE FROM participaciones WHERE partida_id = ?').bind(partidaId),
        ...jugadores.map((j) =>
          env.DB.prepare(
            `INSERT INTO participaciones (id, partida_id, usuario_id, entrada)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (partida_id, usuario_id) DO UPDATE SET entrada = excluded.entrada`,
          ).bind(nuevoId(), partidaId, String(j.usuarioId), Number(j.entrada) || 0),
        ),
      ]
      await env.DB.batch(sentencias)
      return json({ ok: true })
    }
  }

  /* ===== una participación (recompras, fichas) ===== */

  if (partes[0] === 'participaciones' && partes[1] && metodo === 'PATCH') {
    const par = await env.DB.prepare(
      `SELECT p.*, pa.liga_id, pa.estado FROM participaciones p
       JOIN partidas pa ON pa.id = p.partida_id WHERE p.id = ?`,
    )
      .bind(partes[1])
      .first<{
        id: string
        usuario_id: string
        liga_id: string
        estado: string
        pagado: number | null
      }>()
    if (!par) return json({ error: 'No encontrado' }, 404)

    const mia = await membresia(env, par.liga_id, yo.id)
    if (!mia && !yo.es_admin_app) return json({ error: 'No perteneces a esa liga' }, 403)
    const esAdminLiga = mia?.es_admin === 1 || yo.es_admin_app === 1
    if (par.estado === 'cerrada') return json({ error: 'La partida ya está cerrada' }, 409)

    const { entrada, recompras, fichasManual, fichasFinal, rebuys, addons, lugar, pagado } =
      await cuerpo<Record<string, unknown>>()

    /*
     * Contar las fichas del final lo puede hacer cualquiera de la mesa, no sólo un
     * admin: el cash out se atora cuando una sola persona tiene que teclear el conteo
     * de todos. Contando en paralelo se acaba en una fracción del tiempo.
     *
     * El dinero es otra cosa. Lo que alguien puso, lo que recompró, en qué lugar quedó
     * y cuánto se le entregó sigue siendo del admin: eso no lo apura contar entre todos
     * y sí es lo que decide quién le debe a quién.
     */
    const delAdmin = { entrada, recompras, fichasManual, rebuys, addons, lugar, pagado }
    const soloEsElConteo = fichasFinal !== undefined && Object.values(delAdmin).every((v) => v === undefined)
    if (!esAdminLiga && !soloEsElConteo)
      return json({ error: 'Eso sólo lo cambia un admin de la liga' }, 403)

    const entero = (v: unknown) => (v === undefined ? null : Math.max(0, Math.floor(Number(v) || 0)))

    /*
     * Un conteo de fichas no puede ser negativo: no existen menos cuatro verdes. Sin
     * esto, un signo de menos tecleado sin querer se guarda tal cual y desde ahí
     * envenena el saldo de esa noche y la tabla de toda la liga —y el jugador aparece
     * habiéndose llevado dinero en negativo—.
     *
     * Se limpia aquí y no sólo en la pantalla porque ahora cualquiera de la mesa puede
     * capturar un conteo.
     */
    const soloFichas = (v: unknown): Record<string, number> => {
      const limpio: Record<string, number> = {}
      if (v && typeof v === 'object') {
        for (const [color, cuantas] of Object.entries(v as Record<string, unknown>)) {
          limpio[color] = Math.max(0, Math.floor(Number(cuantas) || 0))
        }
      }
      return limpio
    }

    await env.DB.prepare(
      `UPDATE participaciones SET
         entrada       = COALESCE(?, entrada),
         recompras     = COALESCE(?, recompras),
         fichas_manual = ?,
         fichas_final  = COALESCE(?, fichas_final),
         rebuys        = COALESCE(?, rebuys),
         addons        = COALESCE(?, addons),
         lugar         = COALESCE(?, lugar),
         pagado        = ?,
         contadas_por  = COALESCE(?, contadas_por)
       WHERE id = ?`,
    )
      .bind(
        entrada === undefined ? null : Number(entrada) || 0,
        recompras === undefined ? null : JSON.stringify(recompras),
        fichasManual === undefined || fichasManual === null
          ? null
          : JSON.stringify(soloFichas(fichasManual)),
        fichasFinal === undefined ? null : JSON.stringify(soloFichas(fichasFinal)),
        entero(rebuys),
        entero(addons),
        entero(lugar),
        /* Sin COALESCE a propósito: mandar `pagado: null` lo borra, que es distinto de
           haber entregado cero. No mandarlo deja lo que ya había. */
        pagado === undefined ? (par.pagado ?? null) : pagado === null ? null : Number(pagado) || 0,
        /* Quién capturó el conteo, para que el que lleva el banco pueda revisar de un
           vistazo antes de soltar el dinero. */
        fichasFinal === undefined ? null : yo.id,
        par.id,
      )
      .run()
    return json({ ok: true })
  }

  /* ===== admin de la app ===== */

  if (partes[0] === 'admin') {
    if (yo.es_admin_app !== 1) return json({ error: 'Solo el admin de la app' }, 403)

    if (partes[1] === 'usuarios' && partes.length === 2 && metodo === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT id, usuario, nombre, foto, es_admin_app, creado_en, bloqueado_hasta
         FROM usuarios ORDER BY creado_en DESC`,
      ).all()
      return json({ usuarios: results })
    }

    // POST /api/admin/usuarios/:id/pin — resetear el PIN de alguien que lo olvidó
    if (partes[1] === 'usuarios' && partes[3] === 'pin' && metodo === 'POST') {
      const { pin } = await cuerpo<Record<string, unknown>>()
      if (!pinValido(pin)) return json({ error: `El PIN debe ser de ${LARGO_PIN} dígitos` }, 400)
      const { hash, sal } = await hashearPin(pin)
      await env.DB.batch([
        env.DB.prepare(
          'UPDATE usuarios SET pin_hash = ?, pin_sal = ?, fallos = 0, bloqueado_hasta = NULL WHERE id = ?',
        ).bind(hash, sal, partes[2]),
        // al cambiar el PIN se cierran sus sesiones abiertas
        env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(partes[2]),
      ])
      return json({ ok: true })
    }
  }

  return null
}
