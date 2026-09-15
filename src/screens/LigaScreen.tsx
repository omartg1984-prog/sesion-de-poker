import Esqueleto from '../components/Esqueleto'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarPlus,
  ChevronRight,
  Coins,
  Megaphone,
  Pencil,
  Share2,
  LogOut,
  Shield,
  Trash2,
  Trophy,
  UserMinus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import EditorFichas from '../components/EditorFichas'
import Sheet from '../components/Sheet'
import Avatar from '../components/Avatar'
import LaLiga from './liga/LaLiga'
import CrearTorneo from './liga/CrearTorneo'
import Reglas from './liga/Reglas'
import type { SeccionReglas } from '../lib/reglas'
import { copyText } from '../lib/portapapeles'
import Medalla from '../components/Medalla'
import SelectorJugador from '../components/SelectorJugador'
import { linkDeInvitacion } from '../components/Invitacion'
import { compartirTextoNativo, esNativo } from '../lib/nativo'
import { signed } from '../lib/money'
import {
  api,
  type Liga,
  type Miembro,
  type PartidaResumen,
  type Presume,
  type TablaPosiciones as Tabla,
  type TipoPartida,
  leerJson,
} from '../lib/api'
import TablaPosiciones from './liga/TablaPosiciones'
import { useRecargarAlVolver } from '../lib/recargar'
import { conAviso, useApp } from '../store/app'
import type { ChipColor } from '../store/types'

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * El instante exacto que corresponde a una fecha y una hora del reloj de aquí.
 *
 * Se resuelve en el teléfono porque es donde se sabe la zona horaria; el servidor sólo
 * compara instantes. Sin esto, un "20:00" guardado tal cual cerraría el registro seis
 * horas antes o después según dónde corra el código.
 */
function instanteDe(fecha: string, hora: string): string | null {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  if (![a, m, d, h, min].every(Number.isFinite)) return null
  return new Date(a, m - 1, d, h, min).toISOString()
}

function fechaLarga(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function LigaScreen() {
  const ligaId = useApp((s) => s.ligaId)!
  const yo = useApp((s) => s.usuario)!
  const irAHome = useApp((s) => s.irAHome)
  const irAPartida = useApp((s) => s.irAPartida)
  const avisar = useApp((s) => s.avisar)

  const [liga, setLiga] = useState<Liga | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [soyAdmin, setSoyAdmin] = useState(false)
  const [partidas, setPartidas] = useState<PartidaResumen[]>([])
  const [presume, setPresume] = useState<Presume | null>(null)
  const [tabla, setTabla] = useState<Tabla | null>(null)
  /*
   * Abre en Partidas. La tabla acumulada es mucha información de golpe para lo primero
   * que ves; las noches jugadas, con quién ganó cada una, se leen de un vistazo y son
   * de lo que se habla al día siguiente. La tabla sigue a un toque.
   */
  const [pestana, setPestana] = useState<'partidas' | 'posiciones' | 'reglas'>('partidas')
  const [borrando, setBorrando] = useState(false)
  const [confirmaNombre, setConfirmaNombre] = useState('')

  const [ficha, setFicha] = useState(false)
  const [editandoLiga, setEditandoLiga] = useState(false)
  const [creando, setCreando] = useState(false)
  const [fichas, setFichas] = useState(false)
  const [gente, setGente] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const [fecha, setFecha] = useState(hoy())
  const [nombrePartida, setNombrePartida] = useState('')
  const [tipo, setTipo] = useState<TipoPartida>('cash')
  /* Quién funge de banco esa noche. Por defecto, quien está creando la partida. */
  const [jefe, setJefe] = useState<string>(yo.id)
  /* A qué hora se queda de empezar. Es cuando deja de apuntarse gente sola. */
  const [horaInicio, setHoraInicio] = useState('20:00')
  const [colores, setColores] = useState<ChipColor[]>([])

  const cargar = async () => {
    const [l, p, t] = await Promise.all([
      conAviso(() => api.liga(ligaId)),
      conAviso(() => api.partidas(ligaId)),
      conAviso(() => api.posiciones(ligaId)),
    ])
    if (l) {
      setLiga(l.liga)
      setMiembros(l.miembros)
      setSoyAdmin(l.soyAdmin)
      setColores(l.liga.colores)
    }
    if (p) {
      setPartidas(p.partidas)
      setPresume(p.presume)
    }
    if (t) setTabla(t)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligaId])

  // Otro admin pudo haber creado partidas desde su teléfono mientras no mirabas.
  useRecargarAlVolver(() => void cargar())

  const crearPartida = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() =>
      /* Sólo las de cash pasan por aquí: el torneo lo crea su asistente, que ya llega
         con jugadores, fichas y escalera de ciegas. */
      api.crearPartida(ligaId, {
        fecha,
        nombre: nombrePartida.trim() || undefined,
        tipo: 'cash',
        jefeId: jefe,
        /* Se manda el instante, no la hora suelta: aquí sí se sabe en qué zona horaria
           está quien la crea, y el servidor corre en UTC. */
        registroHasta: instanteDe(fecha, horaInicio),
      }),
    )
    setOcupado(false)
    if (r) {
      setCreando(false)
      setNombrePartida('')
      irAPartida(r.partida.id, ligaId)
    }
  }

  /*
   * Invitar: se manda un link, no un código.
   *
   * Se intenta con la hoja de compartir del teléfono —que es donde está el grupo de
   * WhatsApp— y si no hay, se copia al portapapeles.
   */
  const invitar = async () => {
    if (!liga) return
    const link = linkDeInvitacion(liga.codigo)
    const texto = `Te invito a ${liga.nombre} en OnlyCards:
${link}`
    try {
      if (esNativo()) {
        await compartirTextoNativo(texto, 'Invitación a la liga')
        return
      }
      if (navigator.share) {
        await navigator.share({ title: liga.nombre, text: texto })
        return
      }
    } catch {
      /* si cancela o el teléfono no deja, queda el portapapeles */
    }
    avisar((await copyText(texto)) ? 'Link copiado' : 'No se pudo copiar')
  }

  /* La foto se guarda sola al elegirla: no hay nada más que confirmar. */
  const cambiarFoto = async (foto: string | null) => {
    if (!liga) return
    setLiga({ ...liga, foto })
    const r = await conAviso(() => api.guardarLiga(ligaId, { foto }))
    if (r) avisar(foto ? 'Foto actualizada' : 'Foto quitada')
    else setLiga(liga)
  }

  const guardarLaLiga = async ({ nombre, descripcion }: { nombre: string; descripcion: string }) => {
    if (!liga) return
    const antes = liga
    setLiga({ ...liga, nombre, descripcion: descripcion || null })
    const r = await conAviso(() => api.guardarLiga(ligaId, { nombre, descripcion }))
    if (r) avisar('Liga actualizada')
    else setLiga(antes)
  }

  const guardarReglas = async (reglas: SeccionReglas[]) => {
    if (!liga) return
    setLiga({ ...liga, reglas: JSON.stringify(reglas) })
    const r = await conAviso(() => api.guardarLiga(ligaId, { reglas }))
    if (r) avisar('Reglas guardadas')
  }

  const guardarFichas = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.guardarLiga(ligaId, { colores }))
    setOcupado(false)
    if (r) {
      setFichas(false)
      avisar('Fichas actualizadas')
      void cargar()
    }
  }

  const alternarAdmin = async (m: Miembro) => {
    const r = await conAviso(() => api.cambiarAdminLiga(ligaId, m.id, m.es_admin !== 1))
    if (r) void cargar()
  }

  const sacar = async (m: Miembro) => {
    const soyYo = m.id === yo.id
    const mensaje = soyYo
      ? '¿Salirte de esta liga? Tus partidas jugadas se quedan en el historial.'
      : `¿Sacar a ${m.nombre} de la liga? Sus partidas jugadas se quedan en el historial.`
    if (!window.confirm(mensaje)) return
    const r = await conAviso(() => api.sacarMiembro(ligaId, m.id))
    if (r) {
      if (soyYo) {
        avisar('Saliste de la liga')
        irAHome()
      } else {
        avisar(`${m.nombre} ya no está en la liga`)
        void cargar()
      }
    }
  }

  const borrarLiga = async () => {
    const r = await conAviso(() => api.borrarLiga(ligaId))
    if (r) {
      avisar('Liga borrada')
      irAHome()
    }
  }

  if (!liga) {
    return (
      <div className="mx-auto max-w-[640px] px-3.5 pt-[max(3rem,env(safe-area-inset-top))]">
        <Esqueleto filas={3} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-4 flex items-center gap-3 border-b border-white/8 bg-marca/92 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={irAHome}
          aria-label="Volver a tus ligas"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white active:scale-90"
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        {/* Tocar la foto es verla, no cambiarla: editar tiene su propio botón. */}
        <button
          type="button"
          onClick={() => {
            setEditandoLiga(false)
            setFicha(true)
          }}
          aria-label={`Ver la liga ${liga.nombre}`}
          className="shrink-0 cursor-pointer rounded-full border-none bg-transparent p-0 active:scale-95"
        >
          <Avatar foto={liga.foto} nombre={liga.nombre} size={52} oscuro />
        </button>

        <button
          type="button"
          onClick={() => {
            setEditandoLiga(false)
            setFicha(true)
          }}
          className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
        >
          <h1 className="m-0 truncate font-display text-[17px] font-bold tracking-[.5px] text-white uppercase">
            {liga.nombre}
          </h1>
          {liga.descripcion && (
            <span className="block truncate text-[11px] text-white/70">{liga.descripcion}</span>
          )}
        </button>

        {soyAdmin && (
          <button
            type="button"
            aria-label="Editar la liga"
            onClick={() => {
              setEditandoLiga(true)
              setFicha(true)
            }}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white active:scale-90"
          >
            <Pencil size={16} strokeWidth={2.5} />
          </button>
        )}
      </header>

      {/* invitar: se manda un link que se abre y se acepta, no un código que teclear */}
      <button
        type="button"
        onClick={() => void invitar()}
        className="mb-3.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-marca/25 bg-gradient-to-br from-[#2a1016] to-[#100e12] px-4 py-3 text-left active:scale-[.99]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[1px] text-tiza-suave uppercase">
            Invitar a la liga
          </div>
          <div className="font-display text-2xl font-bold tracking-[4px] text-marca-alta">
            {liga.codigo}
          </div>
          <div className="mt-0.5 text-[11px] text-tiza-suave">
            Manda el link; con abrirlo y aceptar ya están dentro.
          </div>
        </div>
        <Share2 size={18} className="shrink-0 text-marca-alta" />
      </button>

      {/* Los dos cuartos de atrás de la liga: quién juega aquí y qué fichas hay. Arriba,
          porque son lo que se consulta al armar la noche, no al final de todo. */}
      <div className="mb-3.5 flex gap-2.5">
        <button type="button" className="btn btn-ghost" onClick={() => setGente(true)}>
          <Users size={17} strokeWidth={2.4} />
          Jugadores en la liga
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setFichas(true)}>
          <Coins size={17} strokeWidth={2.4} />
          Inventario de fichas
        </button>
      </div>

      {/* El que ganó la última noche tiene la palabra. Va sobre el fondo oscuro de la
          liga y no sobre una tarjeta crema, por eso el texto es claro: con tinta oscura
          aquí no se lee nada. */}
      {presume && (
        <div className="mb-3.5 flex items-start gap-3 rounded-xl border border-win/35 bg-noche-honda bg-gradient-to-br from-[#12291d] to-[#100e12] px-3.5 py-3">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-win-alto" strokeWidth={2.4} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[14px] leading-snug font-semibold text-white">
              “{presume.texto}”
            </p>
            <p className="mt-1 mb-0 text-[11px] text-tiza-suave">
              {presume.autor ?? 'El ganador'} · ganó {presume.etiqueta}
            </p>
          </div>
        </div>
      )}

      <div className="mb-3.5 flex gap-1 rounded-xl bg-black/30 p-1">
        {(
          [
            ['partidas', 'Partidas'],
            ['posiciones', 'Posiciones'],
            ['reglas', 'Reglas'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-current={pestana === id ? 'page' : undefined}
            onClick={() => setPestana(id)}
            className={`flex-1 cursor-pointer rounded-[9px] border-none py-2 text-[13px] font-bold transition-colors ${
              pestana === id ? 'bg-marca text-white' : 'bg-transparent text-tiza-suave'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'posiciones' && (
        <TablaPosiciones tabla={tabla} nombreLiga={liga.nombre} partidas={partidas} />
      )}

      {pestana === 'reglas' && (
        <Reglas
          reglas={leerJson<SeccionReglas[] | null>(liga.reglas, null)}
          soyAdmin={soyAdmin}
          onGuardar={(r) => void guardarReglas(r)}
        />
      )}

      {/* partidas */}
      {pestana === 'partidas' && (
        <section className="panel">
          <p className="panel-title">
            <span>Partidas</span>
          </p>

          {partidas.length === 0 ? (
            <p className="m-0 mb-3 text-[13px] text-ink-soft">
              Todavía no hay partidas.{' '}
              {soyAdmin ? 'Crea la primera.' : 'Un admin tiene que crearlas.'}
            </p>
          ) : (
            <ul className="m-0 mb-3 list-none p-0">
              {partidas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => irAPartida(p.id, ligaId)}
                    className="flex w-full cursor-pointer items-start gap-2.5 border-none border-b border-dashed border-paper-line bg-transparent px-0.5 py-3 text-left last:border-b-0"
                  >
                    {p.tipo === 'torneo' ? (
                      <Trophy size={17} className="shrink-0 text-marca-tinta" strokeWidth={2.3} />
                    ) : (
                      <Banknote size={17} className="shrink-0 text-marca-tinta" strokeWidth={2.3} />
                    )}
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] text-ink">
                        {p.nombre || fechaLarga(p.fecha)}
                      </b>
                      <span className="block text-xs text-ink-soft">
                        {p.nombre ? `${fechaLarga(p.fecha)} · ` : ''}
                        {p.jugadores} {p.jugadores === 1 ? 'jugador' : 'jugadores'}
                        {p.estado === 'abierta' && ' · en juego'}
                      </span>

                      {/* Cómo quedó esa noche, sin tener que entrar a verla. */}
                      {p.podio && p.podio.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {p.podio.map((q) => (
                            <span key={q.usuarioId} className="flex items-center gap-1">
                              <Medalla lugar={q.lugar} size={13} />
                              <span className="max-w-[86px] truncate text-[12px] font-semibold text-ink">
                                {q.nombre}
                              </span>
                              <span
                                className={`text-[12px] font-bold tabular-nums ${
                                  q.resultado > 0
                                    ? 'text-win'
                                    : q.resultado < 0
                                      ? 'text-loss'
                                      : 'text-ink-soft'
                                }`}
                              >
                                {signed(q.resultado)}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-soft/45" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {soyAdmin && (
            <button
              type="button"
              className="btn-dashed flex items-center justify-center gap-1.5"
              onClick={() => setCreando(true)}
            >
              <CalendarPlus size={16} strokeWidth={2.5} />
              Nueva partida
            </button>
          )}
        </section>
      )}

      {/* accesos a jugadores y fichas */}
      <div className="flex gap-2.5">
        <button type="button" className="btn btn-ghost" onClick={() => setGente(true)}>
          <Users size={17} strokeWidth={2.4} />
          {miembros.length} {miembros.length === 1 ? 'jugador' : 'jugadores'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setFichas(true)}>
          <Coins size={17} strokeWidth={2.4} />
          Fichas
        </button>
      </div>

      {liga.creada_por === yo.id && (
        <button
          type="button"
          className="btn btn-borrar mt-6"
          onClick={() => {
            setConfirmaNombre('')
            setBorrando(true)
          }}
        >
          <Trash2 size={17} strokeWidth={2.4} />
          Borrar esta liga
        </button>
      )}

      <Sheet abierta={borrando} onCerrar={() => setBorrando(false)} titulo="Borrar la liga">
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>
            Esto borra {partidas.length} {partidas.length === 1 ? 'partida' : 'partidas'} y el
            historial de {miembros.length} {miembros.length === 1 ? 'jugador' : 'jugadores'}, no
            solo el tuyo. No se puede deshacer.
          </span>
        </div>

        <p className="mt-0 mb-2 text-[13px] leading-snug text-ink-soft">
          Si solo te quieres salir, usa el botón de salir en la lista de jugadores; la liga sigue
          para los demás.
        </p>

        <label className="mb-4 block">
          <span className="field-label">
            Escribe <b className="text-ink">{liga.nombre}</b> para confirmar
          </span>
          <input
            type="text"
            value={confirmaNombre}
            onChange={(e) => setConfirmaNombre(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Nombre de la liga para confirmar"
            className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-loss"
          />
        </label>

        <button
          type="button"
          className="btn mb-2 bg-loss text-white hover:bg-loss/90 disabled:opacity-40"
          disabled={confirmaNombre.trim() !== liga.nombre}
          onClick={() => void borrarLiga()}
        >
          <Trash2 size={17} strokeWidth={2.4} />
          Borrar la liga y todo su historial
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => setBorrando(false)}>
          Mejor no
        </button>
      </Sheet>

      {/* ---- nueva partida ---- */}
      <Sheet abierta={creando} onCerrar={() => setCreando(false)} titulo="Nueva partida">
        <span className="field-label">Tipo</span>
        <div className="mt-1 mb-4 flex gap-1 rounded-xl bg-ink/8 p-1">
          {(
            [
              ['cash', 'Cash', Banknote],
              ['torneo', 'Torneo', Trophy],
            ] as const
          ).map(([t, texto, Icono]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border-none py-2.5 text-sm font-bold transition-colors ${
                tipo === t ? 'bg-marca text-white shadow-sm' : 'bg-transparent text-ink-soft'
              }`}
            >
              <Icono size={15} strokeWidth={2.4} />
              {texto}
            </button>
          ))}
        </div>

        {/* El torneo se arma por pasos: quiénes, cuánto cuesta, cuánto dura y el plan.
            La de cash no necesita nada de eso, con la fecha basta. */}
        {tipo === 'torneo' ? (
          <CrearTorneo
            ligaId={ligaId}
            nombreLiga={liga.nombre}
            yoId={yo.id}
            miembros={miembros}
            colores={colores}
            onCreada={() => void cargar()}
            onIrAlTorneo={(id) => {
              setCreando(false)
              irAPartida(id, ligaId)
            }}
          />
        ) : (
          <>
            <label className="mb-4 block">
              <span className="field-label">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
              />
            </label>

            <label className="mb-4 block">
              <span className="field-label">Nombre (opcional)</span>
              <input
                type="text"
                value={nombrePartida}
                onChange={(e) => setNombrePartida(e.target.value)}
                placeholder="ej. Cumpleaños de Beto"
                className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
              />
            </label>

            <label className="mb-4 block">
              <span className="field-label">Empieza a las</span>
              <p className="mt-0.5 mb-1 text-[12px] leading-snug text-ink-soft">
                A esa hora se cierra el registro solo. Tú puedes seguir metiendo a los que
                lleguen tarde.
              </p>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
              />
            </label>

            <div className="mb-4">
              <span className="field-label">Quién lleva el banco</span>
              <p className="mt-0.5 mb-1.5 text-[12px] leading-snug text-ink-soft">
                Recibe el dinero y es el único que puede cerrar la partida al final.
              </p>
              <SelectorJugador
                titulo="¿Quién lleva el banco?"
                valor={jefe}
                onChange={(id) => setJefe(id ?? yo.id)}
                opciones={miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.foto }))}
              />
            </div>

            <button
              type="button"
              className="btn btn-marca mb-2"
              disabled={ocupado}
              onClick={() => void crearPartida()}
            >
              Crear partida
            </button>
          </>
        )}
      </Sheet>

      {/* ---- la ficha de la liga ---- */}
      <LaLiga
        abierta={ficha}
        liga={liga}
        soyAdmin={soyAdmin}
        editandoDeEntrada={editandoLiga}
        onCerrar={() => setFicha(false)}
        onGuardar={guardarLaLiga}
        onFoto={(f) => void cambiarFoto(f)}
        onError={avisar}
      />

      {/* ---- jugadores de la liga ---- */}
      <Sheet abierta={gente} onCerrar={() => setGente(false)} titulo="Jugadores en la liga">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Se unen con el código de la liga.{' '}
          {soyAdmin && 'Toca el escudo para dar o quitar permisos de admin.'}
        </p>
        <ul className="m-0 list-none p-0">
          {miembros.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink/8">
                {m.foto ? (
                  <img src={m.foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
                    {m.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] text-ink">
                  {m.nombre}
                  {m.id === yo.id && <span className="font-normal text-ink-soft"> (tú)</span>}
                </b>
                <span className="block truncate text-xs text-ink-soft">{m.usuario}</span>
              </span>
              <button
                type="button"
                disabled={!soyAdmin}
                onClick={() => void alternarAdmin(m)}
                aria-label={
                  m.es_admin === 1 ? `Quitar admin a ${m.nombre}` : `Hacer admin a ${m.nombre}`
                }
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-none transition-colors ${
                  m.es_admin === 1 ? 'bg-marca/22 text-marca-tinta' : 'bg-ink/8 text-ink-soft/45'
                } ${soyAdmin ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
              >
                <Shield size={15} strokeWidth={2.6} />
              </button>
              {(soyAdmin || m.id === yo.id) && (
                <button
                  type="button"
                  onClick={() => void sacar(m)}
                  aria-label={
                    m.id === yo.id ? 'Salirme de la liga' : `Sacar a ${m.nombre} de la liga`
                  }
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft/55 transition-colors hover:bg-loss/12 hover:text-loss active:scale-95"
                >
                  {m.id === yo.id ? (
                    <LogOut size={15} strokeWidth={2.5} />
                  ) : (
                    <UserMinus size={15} strokeWidth={2.5} />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Sheet>

      {/* ---- fichas de la casa ---- */}
      <Sheet abierta={fichas} onCerrar={() => setFichas(false)} titulo="Inventario de fichas">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Con esto la app calcula cuántas fichas darle a cada quien según el dinero con el que
          entra.
          {!soyAdmin && ' Solo un admin de la liga puede cambiarlo.'}
        </p>
        <EditorFichas colores={colores} onChange={setColores} soloLectura={!soyAdmin} />
        {soyAdmin && (
          <button
            type="button"
            className="btn btn-marca mt-4 mb-2"
            disabled={ocupado}
            onClick={() => void guardarFichas()}
          >
            Guardar fichas
          </button>
        )}
      </Sheet>
    </div>
  )
}
