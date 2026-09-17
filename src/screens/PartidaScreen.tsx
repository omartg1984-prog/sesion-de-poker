import Esqueleto from '../components/Esqueleto'
import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  Lock,
  LockOpen,
  RefreshCw,
  Share2,
  Trash2,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import NumInput from '../components/NumInput'
import Sheet from '../components/Sheet'
import {
  api,
  leerJson,
  type ConfigTorneo,
  type DetallePartida,
  type Miembro,
  type Participacion,
} from '../lib/api'
import { useRecargarAlVolver } from '../lib/recargar'
import { conAviso, useApp } from '../store/app'
import { ENTRADA_POR_DEFECTO } from './partida/comun'
import { linkDePartida } from '../components/Invitacion'
import { compartirTextoNativo, esNativo } from '../lib/nativo'
import { copyText } from '../lib/portapapeles'
import BannerCaja from './partida/BannerCaja'
import BannerFichas from './partida/BannerFichas'
import Numeros from './partida/Numeros'
import Presume from './partida/Presume'
import { useAvisoDeNivel } from './partida/usarReloj'
import { calcularCuadre, porQueNoSePuedeCerrar } from './partida/cuadre'
import { calcularRepartoCash, invertidoDe } from './partida/comun'
import { dineroDeLaCaja } from '../lib/distribution'
import { RELOJ_PARADO, pausarReloj, type Estructura, type RelojTorneo } from '../lib/torneo'
import TiempoDeJuego from './partida/TiempoDeJuego'
import PartidaCash, { PESTANAS_CASH, type PestanaCash } from './partida/PartidaCash'
import PartidaTorneo, {
  PESTANAS_TORNEO,
  TORNEO_POR_DEFECTO,
  type PestanaTorneo,
} from './partida/PartidaTorneo'

type Pestana = PestanaCash | PestanaTorneo | 'numeros'

/**
 * Junta los cambios seguidos y manda uno solo por campo: teclear un monto no dispara
 * una petición por tecla. La clave agrupa por participación + campo, así dos ediciones
 * distintas del mismo jugador no se pisan.
 */
function useGuardadoDiferido(ms = 600) {
  const pendientes = useRef(new Map<string, () => Promise<unknown>>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (clave: string, fn: () => Promise<unknown>) => {
    pendientes.current.set(clave, fn)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const tareas = [...pendientes.current.values()]
      pendientes.current.clear()
      for (const t of tareas) void conAviso(t)
    }, ms)
  }
}

export default function PartidaScreen() {
  const partidaId = useApp((s) => s.partidaId)!
  const ligaId = useApp((s) => s.ligaId)
  const irALiga = useApp((s) => s.irALiga)
  const irAHome = useApp((s) => s.irAHome)
  const avisar = useApp((s) => s.avisar)
  const yo = useApp((s) => s.usuario)

  const [datos, setDatos] = useState<DetallePartida | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [pestana, setPestana] = useState<Pestana>('jugadores')
  const [cargando, setCargando] = useState(true)
  const [eligiendo, setEligiendo] = useState(false)
  const [seleccion, setSeleccion] = useState<Record<string, number>>({})
  const [ocupado, setOcupado] = useState(false)
  const [torneo, setTorneo] = useState<ConfigTorneo>(TORNEO_POR_DEFECTO)
  const [borrando, setBorrando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  const diferido = useGuardadoDiferido()
  /** Para saber si la pestaña de arranque ya se eligió o es la primera vez que se abre. */
  const primeraCarga = useRef(true)

  const cargar = async () => {
    const d = await conAviso(() => api.partida(partidaId))
    if (d) {
      setDatos(d)
      setTorneo(leerJson<ConfigTorneo>(d.partida.torneo, TORNEO_POR_DEFECTO))
      /*
       * Un torneo abre en su pestaña, que es donde está el reloj: recién creado lo
       * primero que se hace es arrancarlo, y ya empezado es lo que se viene a mirar.
       * Sólo la primera vez —después manda donde estaba, que si no, recargar al volver
       * de otra app te sacaría del registro a media captura.
       */
      if (primeraCarga.current) {
        primeraCarga.current = false
        setPestana(d.partida.tipo === 'torneo' ? 'torneo' : 'jugadores')
      } else if (d.partida.tipo === 'torneo') {
        setPestana((p) => (p === 'final' ? 'torneo' : p))
      }
      const l = await conAviso(() => api.liga(d.partida.liga_id))
      if (l) setMiembros(l.miembros)
    }
    setCargando(false)
  }

  useEffect(() => {
    primeraCarga.current = true
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId])

  // Otro admin pudo haber tocado la partida desde su teléfono mientras no mirabas.
  useRecargarAlVolver(() => void cargar())

  /*
   * El aviso de que subieron las ciegas suena estés en la pestaña que estés.
   *
   * Se memoriza contra el texto crudo y no contra el objeto: abrirlo en cada render
   * daría un objeto nuevo cada vez y el reloj del aviso se estaría reiniciando solo.
   */
  const crudoEstructura =
    datos?.partida.tipo === 'torneo' ? (datos.partida.estructura ?? null) : null
  const crudoReloj = datos?.partida.reloj ?? null
  const estructuraDelAviso = useMemo(
    () => leerJson<Estructura | null>(crudoEstructura, null),
    [crudoEstructura],
  )
  const relojDelAviso = useMemo(
    () => leerJson<RelojTorneo>(crudoReloj, RELOJ_PARADO),
    [crudoReloj],
  )
  useAvisoDeNivel(estructuraDelAviso, relojDelAviso)

  const colores = useMemo(() => datos?.liga.colores ?? [], [datos])
  const esTorneo = datos?.partida.tipo === 'torneo'
  const cerrada = datos?.partida.estado === 'cerrada'
  const puedeEditar = !!datos?.soyAdmin && !cerrada
  /* Contar fichas es de todos los de la mesa; cerrar la noche es sólo del que llevó
     el banco, aunque haya otros admins en la liga. */
  const puedeContar = !cerrada
  const soyJefe = !!datos?.soyJefe
  const pestanas = [
    ...(esTorneo ? PESTANAS_TORNEO : PESTANAS_CASH),
    { id: 'numeros' as const, label: 'Estadísticas' },
  ]

  /** Cambia una participación en pantalla al instante y la manda al servidor con retraso. */
  const tocar = (
    id: string,
    enPantalla: Partial<Participacion>,
    aGuardar: Record<string, unknown>,
  ) => {
    setDatos((d) =>
      d
        ? {
            ...d,
            participaciones: d.participaciones.map((p) =>
              p.id === id ? { ...p, ...enPantalla } : p,
            ),
          }
        : d,
    )
    diferido(id + ':' + Object.keys(aGuardar).join(), () =>
      api.guardarParticipacion(id, aGuardar as Parameters<typeof api.guardarParticipacion>[1]),
    )
  }

  /* El billete más chico cambia de una noche a otra según con cuánta feria llegaron. */
  const cambiarRedondeo = (paso: number) => {
    setDatos((d) => (d ? { ...d, partida: { ...d.partida, redondeo: paso } } : d))
    diferido('redondeo', () => api.guardarPartida(partidaId, { redondeo: paso }))
  }

  /* La tabla de ciegas se guarda ya calculada: si guardáramos los parámetros, cambiar
     el stack a media noche movería las ciegas de los niveles ya jugados. */
  const cambiarEstructura = (e: Estructura) => {
    setDatos((d) => (d ? { ...d, partida: { ...d.partida, estructura: JSON.stringify(e) } } : d))
    diferido('estructura', () => api.guardarPartida(partidaId, { estructura: e }))
  }

  /* El reloj se guarda al instante y sin diferir: si alguien le da pausa, los demás
     teléfonos tienen que enterarse ya, no en dos segundos. */
  const cambiarReloj = (r: RelojTorneo) => {
    setDatos((d) => (d ? { ...d, partida: { ...d.partida, reloj: JSON.stringify(r) } } : d))
    void api.guardarPartida(partidaId, { reloj: r })
  }

  const cambiarTorneo = (t: ConfigTorneo) => {
    setTorneo(t)
    diferido('torneo', () => api.guardarPartida(partidaId, { torneo: t }))
  }

  if (cargando)
    return (
      <div className="mx-auto max-w-[640px] px-3.5 pt-[max(3rem,env(safe-area-inset-top))]">
        <Esqueleto filas={3} />
      </div>
    )
  if (!datos) return null

  const volver = () => (ligaId ? irALiga(ligaId) : irAHome())

  const abrirSelector = () => {
    const actual: Record<string, number> = {}
    for (const p of datos.participaciones) actual[p.usuario_id] = p.entrada
    setSeleccion(actual)
    setEligiendo(true)
  }

  const guardarJugadores = async () => {
    if (ocupado) return
    setOcupado(true)
    const jugadores = Object.entries(seleccion).map(([usuarioId, entrada]) => ({
      usuarioId,
      // En torneo todos pagan lo mismo: el costo de entrada manda.
      entrada: esTorneo ? torneo.buyIn : entrada,
    }))
    const r = await conAviso(() => api.cargarJugadores(partidaId, jugadores))
    setOcupado(false)
    if (r) {
      setEligiendo(false)
      void cargar()
    }
  }

  const cerrarPartida = async () => {
    const r = await conAviso(() => api.guardarPartida(partidaId, { estado: 'cerrada' }))
    if (r) {
      setCerrando(false)
      avisar('Partida cerrada. Ya cuenta para la liga')
      void cargar()
    }
  }

  const borrarPartida = async () => {
    const r = await conAviso(() => api.borrarPartida(partidaId))
    if (r) {
      avisar('Partida borrada')
      volver()
    }
  }

  const comunes = { datos, colores, puedeEditar, puedeContar, tocar, recargar: cargar }

  /*
   * Apuntarse es cosa de cada quien: se manda el link al grupo y cada uno se anota. El
   * admin sigue pudiendo cargar y quitar a quien sea, pero ya no tiene que perseguir a
   * nadie para saber quién va.
   */
  const estoyApuntado = datos.participaciones.some((p) => p.usuario_id === yo?.id)
  /*
   * El registro se cierra por dos vías y basta una: a mano, o al llegar la hora a la que
   * se quedó de empezar. La segunda no necesita que nadie apriete nada: se compara con
   * el reloj al pintar, igual que hace el servidor al recibir a alguien.
   */
  const cierraA = datos.partida.registro_hasta ?? null
  const yaDioLaHora = !!cierraA && Date.now() >= Date.parse(cierraA)
  const registroCerrado = datos.partida.registro_cerrado === 1 || yaDioLaHora

  const horaDelCierre = cierraA
    ? new Date(cierraA).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null

  /* Cerrar el registro es "ya estamos todos", no "ya se acabó la noche". Al reabrirlo
     hay que borrar también la hora: si no, se volvería a cerrar solo al instante. */
  const cambiarRegistro = (cerrar: boolean) => {
    setDatos((d) =>
      d
        ? {
            ...d,
            partida: {
              ...d.partida,
              registro_cerrado: cerrar ? 1 : 0,
              registro_hasta: cerrar ? d.partida.registro_hasta : null,
            },
          }
        : d,
    )
    void conAviso(() =>
      api.guardarPartida(partidaId, {
        registroCerrado: cerrar,
        ...(cerrar ? {} : { registroHasta: null }),
      }),
    )
    avisar(cerrar ? 'Registro cerrado' : 'Registro abierto otra vez')
  }

  const compartirPartida = async () => {
    const link = linkDePartida(partidaId, datos.liga.codigo)
    const cuando = datos.partida.nombre || datos.partida.fecha
    const texto = `🃏 ${esTorneo ? 'Torneo' : 'Cash'} en ${datos.liga.nombre} — ${cuando}\nApúntate aquí:\n${link}`
    try {
      if (esNativo()) {
        await compartirTextoNativo(texto, 'Invitación a la partida')
        return
      }
      if (navigator.share) {
        await navigator.share({ title: cuando, text: texto })
        return
      }
    } catch {
      /* si cancela o el teléfono no deja, queda el portapapeles */
    }
    avisar((await copyText(texto)) ? 'Link copiado' : 'No se pudo copiar')
  }

  /*
   * A qué hora empezó de verdad. En torneo lo apunta el primer play del reloj; la cash
   * no tiene reloj que apretar, así que lleva su propio botón.
   */
  const arrancoEn = datos.partida.arrancado_en ?? null
  const terminoEn = datos.partida.terminado_en ?? null
  const arrancar = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.guardarPartida(partidaId, { arrancarAhora: true }))
    setOcupado(false)
    if (!r) return
    avisar('Arrancó la partida')
    void cargar()
  }

  /*
   * Terminar es la última mano, no el cierre de la noche. De aquí en adelante viene el
   * cash out —contar, cuadrar, pagar— y eso se lleva su rato; la partida se cierra
   * cuando ya no queda dinero por repartir.
   *
   * En torneo, además, para el reloj: dejarlo corriendo después de la última mano hace
   * subir ciegas de una mesa que ya se levantó.
   */
  const terminar = async (terminarAhora: boolean) => {
    if (ocupado) return
    setOcupado(true)
    if (terminarAhora && esTorneo && relojDelAviso.corriendo) cambiarReloj(pausarReloj(relojDelAviso))
    const r = await conAviso(() => api.guardarPartida(partidaId, { terminarAhora }))
    setOcupado(false)
    if (!r) return
    avisar(terminarAhora ? 'Se acabó el juego' : 'Siguen jugando')
    void cargar()
  }

  /* Refrescar a mano: en la mesa hay varios teléfonos tocando la misma partida y lo
     que tienes en pantalla puede ser de hace rato. */
  const refrescar = async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  const apuntarme = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() =>
      estoyApuntado ? api.desapuntarme(partidaId) : api.apuntarme(partidaId),
    )
    setOcupado(false)
    if (!r) return
    avisar(estoyApuntado ? 'Te borraste de la partida' : 'Quedaste apuntado')
    void cargar()
  }

  /* El cuadre de la noche. En torneo no aplica: ahí no se cuentan fichas al final, el
     resultado sale de los premios por lugar. */
  const repartoCash = esTorneo ? null : calcularRepartoCash(datos.participaciones, colores)
  const cuadre = repartoCash
    ? calcularCuadre(datos.participaciones, colores, repartoCash, invertidoDe)
    : null
  const trabaParaCerrar = cuadre ? porQueNoSePuedeCerrar(cuadre) : null

  /* Lo que le queda a la caja, en dinero. Es la cuenta de "¿alcanza para otra
     recompra?", y por eso vive arriba mientras se captura y no al fondo. En torneo no
     aplica: ahí las fichas son puntos. */
  const caja =
    repartoCash && datos.participaciones.length > 0
      ? dineroDeLaCaja(colores, repartoCash)
      : null
  // La configuración del torneo se tiene que poder abrir ANTES de cargar a nadie:
  // ahí se define el costo de entrada con el que entran todos.
  const sinJugadores =
    datos.participaciones.length === 0 && pestana !== 'torneo' && pestana !== 'numeros'

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-3 border-b border-white/8 bg-marca/92 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={volver}
            aria-label="Volver a la liga"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white active:scale-90"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate font-display text-[17px] leading-tight font-bold tracking-[.5px] text-white uppercase">
              {datos.partida.nombre || datos.partida.fecha}
            </h1>
            <span className="text-[11px] text-white">
              {esTorneo ? 'Torneo' : 'Cash'} · {datos.liga.nombre}
            </span>
          </div>
          {cerrada && <Lock size={15} className="shrink-0 text-white/85" />}

          {/* En la mesa hay varios teléfonos tocando la misma partida. Esto trae lo que
              hayan capturado los demás sin salirse ni recargar la app. */}
          <button
            type="button"
            onClick={() => void refrescar()}
            disabled={refrescando}
            aria-label="Traer lo último"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white active:scale-90 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              strokeWidth={2.4}
              className={refrescando ? 'animate-spin' : undefined}
            />
          </button>
        </div>

        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto rounded-xl bg-black/25 p-1">
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={pestana === t.id ? 'page' : undefined}
              onClick={() => setPestana(t.id)}
              className={`flex-1 cursor-pointer rounded-[9px] border-none px-3 py-2 text-[12.5px] font-bold whitespace-nowrap transition-colors ${
                pestana === t.id ? 'bg-white text-marca-tinta' : 'bg-transparent text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {cuadre && pestana === 'final' && datos.participaciones.length > 0 && (
          <BannerFichas cuadre={cuadre} />
        )}

        {caja && pestana === 'jugadores' && <BannerCaja caja={caja} />}
      </header>

      {/* De qué hora a qué hora se jugó. Va hasta arriba y no al fondo de la lista: es
          lo primero que se hace al sentarse y lo primero al levantarse. Lo aprieta
          cualquiera de los que están jugando, no sólo el que lleva el banco.

          En cash vive en el registro y en torneo junto al reloj, que es la pestaña que
          se tiene abierta en cada caso. */}
      {!sinJugadores && pestana === (esTorneo ? 'torneo' : 'jugadores') && (
        <TiempoDeJuego
          arrancoEn={arrancoEn}
          terminoEn={terminoEn}
          puede={!cerrada && (soyJefe || estoyApuntado)}
          ocupado={ocupado}
          onArrancar={esTorneo ? null : () => void arrancar()}
          onTerminar={() => void terminar(true)}
          onSeguir={() => void terminar(false)}
          oscuro={esTorneo}
        />
      )}

      {sinJugadores ? (
        <section className="panel text-center">
          <Users size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
          <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Nadie cargado aún</p>
          <p className="mx-auto mb-3 max-w-[300px] text-[13px] leading-snug text-ink-soft">
            {datos.soyAdmin
              ? registroCerrado
                ? 'El registro ya cerró, pero tú puedes cargar a quien llegue.'
                : esTorneo
                  ? 'Elige quiénes llegaron, o manda el link para que se apunten solos. Todos entran con el costo que definiste al crear el torneo.'
                  : 'Elige quiénes llegaron, o manda el link para que se apunten solos.'
              : registroCerrado
                ? 'El registro ya cerró. Pídele a un admin que te meta.'
                : 'Todavía no se apunta nadie. Puedes ser el primero.'}
          </p>
          {puedeEditar && (
            <button type="button" className="btn btn-marca" onClick={abrirSelector}>
              <UserPlus size={18} strokeWidth={2.5} />
              Cargar jugadores
            </button>
          )}
        </section>
      ) : pestana === 'numeros' ? (
        <Numeros {...comunes} torneo={torneo} />
      ) : esTorneo ? (
        <PartidaTorneo
          {...comunes}
          pestana={pestana as PestanaTorneo}
          torneo={torneo}
          cambiarTorneo={cambiarTorneo}
          onEstructura={cambiarEstructura}
          onReloj={cambiarReloj}
        />
      ) : (
        <PartidaCash {...comunes} pestana={pestana as PestanaCash} onRedondeo={cambiarRedondeo} />
      )}

      {/* Quiénes van. Todo junto y en el registro, que es donde se mira la lista: el
          admin mete y saca, y cualquiera se apunta solo mientras el registro esté
          abierto. */}
      {pestana === 'jugadores' && !cerrada && (
        <>
          {/* Con la mesa vacía el botón ya está arriba, en el hueco; repetirlo aquí
              dejaba dos botones seguidos para lo mismo. */}
          {puedeEditar && !sinJugadores && (
            <button type="button" className="btn btn-marca mb-2" onClick={abrirSelector}>
              <UserPlus size={17} strokeWidth={2.4} />
              Agregar o quitar jugadores
            </button>
          )}

          {registroCerrado ? (
            <div className="balance balance-ok mb-2">
              <Lock size={16} strokeWidth={2.4} />
              <span>
                {yaDioLaHora ? `Registro cerrado a las ${horaDelCierre}.` : 'Registro cerrado.'}{' '}
                {puedeEditar ? 'Sólo tú puedes mover la lista.' : 'Pídele a un admin que te meta.'}
              </span>
            </div>
          ) : (
            <>
              {horaDelCierre && (
                <p className="mt-0 mb-2 text-center text-[12px] text-ink-soft">
                  El registro se cierra solo a las <b className="text-ink">{horaDelCierre}</b>.
                </p>
              )}

              <button
                type="button"
                className="btn btn-share mb-2"
                onClick={() => void compartirPartida()}
              >
                <Share2 size={17} strokeWidth={2.4} />
                Compartir para que se apunten
              </button>

              <button
                type="button"
                className="btn btn-ghost mb-2 disabled:opacity-45"
                disabled={ocupado}
                onClick={() => void apuntarme()}
              >
                {estoyApuntado ? (
                  <>
                    <UserMinus size={17} strokeWidth={2.4} />
                    Ya no voy
                  </>
                ) : (
                  <>
                    <UserPlus size={17} strokeWidth={2.4} />
                    Apuntarme
                  </>
                )}
              </button>
            </>
          )}

          {/* Cerrar el registro es la señal de "ya estamos todos". No cierra la
              partida: eso pasa mucho después, cuando ya se contaron las fichas. */}
          {puedeEditar && (
            <button
              type="button"
              className="btn btn-ghost mb-2"
              onClick={() => cambiarRegistro(!registroCerrado)}
            >
              {registroCerrado ? (
                <>
                  <LockOpen size={17} strokeWidth={2.4} />
                  Volver a abrir el registro
                </>
              ) : (
                <>
                  <Lock size={17} strokeWidth={2.4} />
                  Cerrar el registro
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* Es la acción que cierra la noche, así que va en rojo y no escondida al final. */}
      {!sinJugadores &&
        (soyJefe || estoyApuntado) &&
        !cerrada &&
        (pestana === 'resultado' || pestana === 'numeros') && (
        <>
          <button
            type="button"
            className="btn btn-marca mt-2 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={trabaParaCerrar !== null}
            onClick={() => setCerrando(true)}
          >
            <Lock size={17} strokeWidth={2.4} />
            Terminar partida
          </button>
          {trabaParaCerrar && (
            <p className="mt-2 mb-0 flex items-start gap-1.5 text-center text-[12px] leading-snug text-loss-alto">
              <AlertTriangle size={13} strokeWidth={2.6} className="mt-0.5 shrink-0" />
              <span className="flex-1 text-left">{trabaParaCerrar}</span>
            </p>
          )}
        </>
      )}

      {/* El micrófono del ganador. Sale al final de la partida cerrada, que es cuando
          ya se sabe de qué presumir. */}
      {cerrada && datos.ganadorId && yo && datos.ganadorId === yo.id && (
        <Presume
          partidaId={partidaId}
          actual={datos.partida.presume ?? null}
          onGuardado={(texto) =>
            setDatos((d) => (d ? { ...d, partida: { ...d.partida, presume: texto } } : d))
          }
        />
      )}

      {datos.soyAdmin && (
        <button type="button" className="btn btn-borrar mt-6" onClick={() => setBorrando(true)}>
          <Trash2 size={17} strokeWidth={2.4} />
          Borrar esta partida
        </button>
      )}

      {/* ---- terminar la partida ---- */}
      <Sheet abierta={cerrando} onCerrar={() => setCerrando(false)} titulo="Terminar la partida">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Al cerrarla queda como está: ya nadie podrá cambiar montos, fichas ni el reparto del
          dinero. Es lo que conviene hacer cuando ya se pagó todo y todos se van.
        </p>
        <div className="balance balance-ok mb-4">
          <Trophy size={16} strokeWidth={2.4} />
          <span>Desde ese momento cuenta para la tabla y el campeonato de la liga.</span>
        </div>
        <button type="button" className="btn btn-marca mb-2" onClick={() => void cerrarPartida()}>
          <Lock size={17} strokeWidth={2.4} />
          Sí, terminar la partida
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => setCerrando(false)}>
          Todavía no
        </button>
      </Sheet>

      <Sheet abierta={borrando} onCerrar={() => setBorrando(false)} titulo="Borrar la partida">
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>
            Se borra para todos, con lo capturado de los {datos.participaciones.length} jugadores.
            No se puede deshacer.
          </span>
        </div>
        <p className="mt-0 mb-4 text-[13px] leading-snug text-ink-soft">
          También sale de la tabla de posiciones de la liga.
        </p>
        <button
          type="button"
          className="btn mb-2 bg-loss text-white hover:bg-loss/90"
          onClick={() => void borrarPartida()}
        >
          <Trash2 size={17} strokeWidth={2.4} />
          Sí, borrarla
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => setBorrando(false)}>
          Mejor no
        </button>
      </Sheet>

      {/* ---- elegir quiénes jugaron ---- */}
      <Sheet abierta={eligiendo} onCerrar={() => setEligiendo(false)} titulo="¿Quiénes jugaron?">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          {esTorneo
            ? `Marca a los que llegaron. Todos entran con ${money0(torneo.buyIn)}, el costo de entrada del torneo.`
            : `Marca a los que llegaron. Entran con ${money0(ENTRADA_POR_DEFECTO)} salvo que le cambies el monto a alguien.`}
        </p>
        <ul className="m-0 mb-4 list-none p-0">
          {miembros.map((m) => {
            const puesto = m.id in seleccion
            return (
              <li
                key={m.id}
                className="border-b border-dashed border-paper-line py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={puesto}
                    aria-label={`${m.nombre} jugó`}
                    className="h-5 w-5 shrink-0"
                    onChange={(e) =>
                      setSeleccion((s) => {
                        const n = { ...s }
                        if (e.target.checked)
                          n[m.id] = esTorneo ? torneo.buyIn : ENTRADA_POR_DEFECTO
                        else delete n[m.id]
                        return n
                      })
                    }
                  />
                  <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{m.nombre}</b>
                  {puesto && !esTorneo && (
                    <div className="flex w-[120px] shrink-0 items-center rounded-lg border border-paper-line bg-white px-2">
                      <span className="font-bold text-ink-soft">$</span>
                      <NumInput
                        value={seleccion[m.id]}
                        mode="decimal"
                        aria-label={`Dinero de ${m.nombre}`}
                        className="w-full border-none bg-transparent px-1 py-2 text-[15px] font-semibold outline-none"
                        onChange={(v) => setSeleccion((s) => ({ ...s, [m.id]: v }))}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="btn btn-marca mb-2"
          disabled={ocupado}
          onClick={() => void guardarJugadores()}
        >
          <Coins size={17} strokeWidth={2.4} />
          Guardar y repartir fichas
        </button>
      </Sheet>
    </div>
  )
}

/** Formato corto de dinero para textos cortos dentro de la interfaz. */
function money0(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}
