import { json } from './index'
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
import { aPublico, type Env, type FilaUsuario } from './tipos'

const COOKIE = 'sesion'
/** Una foto de perfil no tiene por qué pesar más que esto ya redimensionada. */
const MAX_FOTO = 300_000

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

function cookieSesion(token: string, dias = DIAS_SESION): string {
  const attrs = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.round(dias * 86400)}`
  return `${COOKIE}=${token}; ${attrs}`
}

const cookieBorrada = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

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
    return json({ usuario: aPublico(fila!) }, 201, { 'set-cookie': cookieSesion(token) })
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

    return json({ usuario: aPublico(fila) }, 200, { 'set-cookie': cookieSesion(token) })
  }

  if (partes[0] === 'salir' && metodo === 'POST') {
    const token = leerCookie(peticion, COOKIE)
    if (token)
      await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await hashearToken(token)).run()
    return json({ ok: true }, 200, { 'set-cookie': cookieBorrada })
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
        if (foto === null || foto === '') nuevaFoto = null
        else {
          const f = String(foto)
          if (!f.startsWith('data:image/')) return json({ error: 'La foto no es una imagen válida' }, 400)
          if (f.length > MAX_FOTO) return json({ error: 'La foto pesa demasiado' }, 413)
          nuevaFoto = f
        }
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
        `SELECT l.id, l.nombre, l.codigo, l.creada_en, m.es_admin,
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
      const { nombre, colores } = await cuerpo<Record<string, unknown>>()
      const nom = String(nombre ?? '').trim()
      if (!nom) return json({ error: 'Ponle nombre a la liga' }, 400)
      if (!Array.isArray(colores) || colores.length === 0)
        return json({ error: 'Define al menos un color de ficha' }, 400)

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
          'INSERT INTO ligas (id, nombre, codigo, colores, creada_por, creada_en) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(id, nom, codigo, JSON.stringify(colores), yo.id, ahora()),
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
        const { nombre, colores } = await cuerpo<Record<string, unknown>>()
        const actual = await env.DB.prepare('SELECT nombre, colores FROM ligas WHERE id = ?')
          .bind(ligaId)
          .first<{ nombre: string; colores: string }>()
        if (!actual) return json({ error: 'Liga no encontrada' }, 404)

        const nom = nombre === undefined ? actual.nombre : String(nombre).trim()
        if (!nom) return json({ error: 'La liga necesita un nombre' }, 400)
        const cols = colores === undefined ? actual.colores : JSON.stringify(colores)

        await env.DB.prepare('UPDATE ligas SET nombre = ?, colores = ? WHERE id = ?')
          .bind(nom, cols, ligaId)
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

      /* ===== partidas de la liga ===== */

      if (partes[2] === 'partidas') {
        if (metodo === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT p.*, (SELECT COUNT(*) FROM participaciones x WHERE x.partida_id = p.id) AS jugadores
             FROM partidas p WHERE p.liga_id = ? ORDER BY p.fecha DESC, p.creada_en DESC`,
          )
            .bind(ligaId)
            .all()
          return json({ partidas: results })
        }

        if (metodo === 'POST') {
          if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede crear partidas' }, 403)
          const { fecha, nombre, tipo, torneo } = await cuerpo<Record<string, unknown>>()
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
            'INSERT INTO partidas (id, liga_id, fecha, nombre, tipo, torneo, estado, creada_por, creada_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
            .bind(id, ligaId, f, String(nombre ?? '').trim() || null, t, configTorneo, 'abierta', yo.id, ahora())
            .run()
          return json({ partida: { id, liga_id: ligaId, fecha: f, tipo: t, estado: 'abierta' } }, 201)
        }
      }
    }
  }

  /* ===== una partida ===== */

  if (partes[0] === 'partidas' && partes[1]) {
    const partidaId = partes[1]
    const partida = await env.DB.prepare('SELECT * FROM partidas WHERE id = ?')
      .bind(partidaId)
      .first<{ id: string; liga_id: string; estado: string }>()
    if (!partida) return json({ error: 'Partida no encontrada' }, 404)

    const mia = await membresia(env, partida.liga_id, yo.id)
    if (!mia && !yo.es_admin_app) return json({ error: 'No perteneces a esa liga' }, 403)
    const esAdminLiga = mia?.es_admin === 1 || yo.es_admin_app === 1

    if (partes.length === 2 && metodo === 'GET') {
      const liga = await env.DB.prepare('SELECT id, nombre, colores FROM ligas WHERE id = ?')
        .bind(partida.liga_id)
        .first<{ id: string; nombre: string; colores: string }>()
      const { results: participaciones } = await env.DB.prepare(
        `SELECT p.*, u.nombre, u.usuario, u.foto
         FROM participaciones p JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.partida_id = ? ORDER BY u.nombre COLLATE NOCASE`,
      )
        .bind(partidaId)
        .all()
      return json({
        partida,
        liga: { ...liga, colores: JSON.parse(liga!.colores) },
        participaciones,
        soyAdmin: esAdminLiga,
      })
    }

    if (partes.length === 2 && metodo === 'PATCH') {
      if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede cambiar la partida' }, 403)
      const { estado, nombre, fecha, torneo } = await cuerpo<Record<string, unknown>>()
      if (estado !== undefined && estado !== 'abierta' && estado !== 'cerrada')
        return json({ error: 'Estado inválido' }, 400)
      await env.DB.prepare(
        `UPDATE partidas SET
           estado = COALESCE(?, estado),
           nombre = COALESCE(?, nombre),
           fecha  = COALESCE(?, fecha),
           torneo = COALESCE(?, torneo)
         WHERE id = ?`,
      )
        .bind(
          estado ?? null,
          nombre ?? null,
          fecha ?? null,
          torneo === undefined ? null : JSON.stringify(torneo),
          partidaId,
        )
        .run()
      return json({ ok: true })
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
      .first<{ id: string; usuario_id: string; liga_id: string; estado: string }>()
    if (!par) return json({ error: 'No encontrado' }, 404)

    const mia = await membresia(env, par.liga_id, yo.id)
    if (!mia && !yo.es_admin_app) return json({ error: 'No perteneces a esa liga' }, 403)
    const esAdminLiga = mia?.es_admin === 1 || yo.es_admin_app === 1
    if (!esAdminLiga) return json({ error: 'Solo un admin de la liga puede editar la partida' }, 403)
    if (par.estado === 'cerrada') return json({ error: 'La partida ya está cerrada' }, 409)

    const { entrada, recompras, fichasManual, fichasFinal, rebuys, addons, lugar } =
      await cuerpo<Record<string, unknown>>()
    const entero = (v: unknown) => (v === undefined ? null : Math.max(0, Math.floor(Number(v) || 0)))

    await env.DB.prepare(
      `UPDATE participaciones SET
         entrada       = COALESCE(?, entrada),
         recompras     = COALESCE(?, recompras),
         fichas_manual = ?,
         fichas_final  = COALESCE(?, fichas_final),
         rebuys        = COALESCE(?, rebuys),
         addons        = COALESCE(?, addons),
         lugar         = COALESCE(?, lugar)
       WHERE id = ?`,
    )
      .bind(
        entrada === undefined ? null : Number(entrada) || 0,
        recompras === undefined ? null : JSON.stringify(recompras),
        fichasManual === undefined || fichasManual === null ? null : JSON.stringify(fichasManual),
        fichasFinal === undefined ? null : JSON.stringify(fichasFinal),
        entero(rebuys),
        entero(addons),
        entero(lugar),
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
