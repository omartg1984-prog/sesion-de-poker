import { CalendarCheck, Check, LogIn, PartyPopper, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { api, type InvitacionPartida } from '../lib/api'
import { money } from '../lib/money'
import { resumenDeTorneo } from '../lib/resumenTorneo'
import { conAviso, useApp } from '../store/app'

/*
 * Entrar a una liga —o apuntarse a una partida— con un link, en vez de teclear códigos.
 *
 * El link trae lo suyo pegado atrás: `?liga=ABC123` para la liga, y además
 * `&partida=<id>` cuando es la invitación a una noche concreta. Al abrirlo, la app lo
 * guarda, limpia la dirección —para que recargar no vuelva a preguntar— y en cuanto hay
 * sesión pregunta. Si todavía no ha entrado a su cuenta, la invitación espera en la
 * pestaña y aparece después.
 *
 * El caso que hace esto valer la pena es el de alguien que no está en la liga: con un
 * solo link entra a la liga y se apunta a la partida de un tirón.
 */

const GUARDADA = 'onlycards_invitacion'

/** El link de la liga: entrar y ya. */
export const linkDeInvitacion = (codigo: string) =>
  `${window.location.origin}/?liga=${encodeURIComponent(codigo)}`

/** El link de una partida. Lleva el código de la liga para que sirva con quien no está. */
export const linkDePartida = (partidaId: string, codigoLiga: string) =>
  `${window.location.origin}/?liga=${encodeURIComponent(codigoLiga)}&partida=${encodeURIComponent(partidaId)}`

function fechaLarga(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

interface Pendiente {
  codigo: string | null
  partida: string | null
}

function leerDeLaUrl(): Pendiente | null {
  const params = new URLSearchParams(window.location.search)
  const codigo = params.get('liga')
  const partida = params.get('partida')
  if (!codigo && !partida) return null
  /* Se borra de la dirección para que recargar la página no vuelva a preguntar. */
  params.delete('liga')
  params.delete('partida')
  const limpia = window.location.pathname + (params.toString() ? `?${params}` : '')
  window.history.replaceState(null, '', limpia)
  return { codigo: codigo ? codigo.trim().toUpperCase() : null, partida: partida || null }
}

function guardada(): Pendiente | null {
  try {
    const crudo = sessionStorage.getItem(GUARDADA)
    return crudo ? (JSON.parse(crudo) as Pendiente) : null
  } catch {
    return null
  }
}

export default function Invitacion() {
  const usuario = useApp((s) => s.usuario)
  const irALiga = useApp((s) => s.irALiga)
  const irAPartida = useApp((s) => s.irAPartida)
  const avisar = useApp((s) => s.avisar)

  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [liga, setLiga] = useState<{ id: string; nombre: string } | null>(null)
  const [yaEnLaLiga, setYaEnLaLiga] = useState(false)
  const [noche, setNoche] = useState<InvitacionPartida | null>(null)
  const [ocupado, setOcupado] = useState(false)
  /*
   * En un torneo hay reglas que se discuten a media noche —hasta cuándo se recompra,
   * cómo se reparte la bolsa— y siempre acaba habiendo alguien que dice que no sabía.
   * Aquí están antes de entrar, y hay que marcarlas para poder apuntarse.
   */
  const [deAcuerdo, setDeAcuerdo] = useState(false)

  /* Lo del link puede llegar antes que la sesión, así que se guarda y se espera. */
  useEffect(() => {
    const deLaUrl = leerDeLaUrl()
    if (deLaUrl) {
      try {
        sessionStorage.setItem(GUARDADA, JSON.stringify(deLaUrl))
      } catch {
        /* en una pestaña privada no se puede guardar; vale para este rato */
      }
      setPendiente(deLaUrl)
      return
    }
    setPendiente(guardada())
  }, [])

  const olvidar = () => {
    try {
      sessionStorage.removeItem(GUARDADA)
    } catch {
      /* da igual: de todos modos se limpia el estado */
    }
    setPendiente(null)
    setLiga(null)
    setNoche(null)
    setDeAcuerdo(false)
  }

  useEffect(() => {
    if (!pendiente || !usuario) return
    let cancelado = false

    void (async () => {
      let soyDeLaLiga = !pendiente.codigo
      let ligaId: string | null = null

      if (pendiente.codigo) {
        const r = await conAviso(() => api.invitacion(pendiente.codigo!))
        if (cancelado) return
        if (!r) {
          olvidar()
          return
        }
        setLiga(r.liga)
        setYaEnLaLiga(r.yaEstaba)
        soyDeLaLiga = r.yaEstaba
        ligaId = r.liga.id
      }

      /* La partida sólo se puede mirar siendo de la liga. Al que no está se le enseña
         primero la liga, y al aceptar entra y se apunta de una vez. */
      if (pendiente.partida && soyDeLaLiga) {
        const p = await conAviso(() => api.invitacionPartida(pendiente.partida!))
        if (cancelado) return
        if (!p) {
          olvidar()
          return
        }
        setNoche(p)
        if (!ligaId) setLiga(p.liga)
      }
    })()

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendiente, usuario])

  const aceptar = async () => {
    if (!pendiente || ocupado) return
    setOcupado(true)

    let destinoLiga = liga?.id ?? null
    if (pendiente.codigo && !yaEnLaLiga) {
      const r = await conAviso(() => api.unirme(pendiente.codigo!))
      if (!r) {
        setOcupado(false)
        return
      }
      destinoLiga = r.liga.id
    }

    if (pendiente.partida) {
      const r = await conAviso(() => api.apuntarme(pendiente.partida!))
      setOcupado(false)
      if (!r) return
      olvidar()
      avisar(r.yaEstaba ? 'Ya estabas apuntado' : 'Quedaste apuntado')
      irAPartida(pendiente.partida, destinoLiga ?? undefined)
      return
    }

    setOcupado(false)
    olvidar()
    if (destinoLiga) {
      avisar(yaEnLaLiga ? `Ya estabas en ${liga?.nombre ?? 'la liga'}` : `Bienvenido a ${liga?.nombre ?? 'la liga'}`)
      irALiga(destinoLiga)
    }
  }

  if (!liga) return null

  const cerrada = noche?.partida.estado === 'cerrada'
  const registroCerrado = !!noche?.partida.registroCerrado && !noche.yaApuntado
  const esTorneo = noche?.partida.tipo === 'torneo'
  const foto = noche?.partida.foto ?? null

  /*
   * El resumen sólo se pide leer cuando hay algo que leer y cuando de verdad se está
   * entrando: al que ya está apuntado, o al que llega cuando ya cerró, no se le pone
   * una casilla en el camino.
   */
  const resumen = esTorneo && noche?.torneo ? resumenDeTorneo(noche.torneo, noche.jugadores) : null
  const hayQueLeer = !!resumen && !noche?.yaApuntado && !cerrada && !registroCerrado
  const horaInicio = noche?.torneo?.horaInicio
  const cierraA = noche?.partida.registroHasta
    ? new Date(noche.partida.registroHasta).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null

  const miles = (n: number) => Math.round(n).toLocaleString('es-MX')

  return (
    <Sheet
      abierta
      onCerrar={olvidar}
      titulo={noche ? (esTorneo ? 'Te invitan a un torneo' : 'Te invitan a jugar') : 'Te invitaron'}
    >
      {/* La cara de la noche, difuminada detrás del título: se reconoce de un vistazo
          sin que el cartel le gane al texto. */}
      <div className="relative mb-3 overflow-hidden rounded-xl border border-marca/25 bg-gradient-to-br from-[#2a1016] to-[#100e12]">
        {foto && (
          <>
            <img
              src={foto}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-md"
            />
            {/* Un velo encima: sin él, una foto clara se come las letras blancas. Va
                justo lo bastante oscuro para que el título se lea sobre cualquier
                imagen, y no más: la gracia es que la foto se vea. */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2a1016]/60 to-[#100e12]/80" />
          </>
        )}
        <div className="relative flex items-center gap-3 px-4 py-3.5">
          {noche ? (
            esTorneo ? (
              <Trophy size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
            ) : (
              <CalendarCheck size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
            )
          ) : (
            <PartyPopper size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[1px] text-tiza-suave uppercase">
              {noche
                ? `${esTorneo ? 'Torneo' : 'Cash'} · ${liga.nombre}`
                : yaEnLaLiga
                  ? 'Ya juegas aquí'
                  : 'Liga'}
            </div>
            <div className="truncate font-display text-xl font-bold text-marca-alta">
              {noche ? noche.partida.nombre || fechaLarga(noche.partida.fecha) : liga.nombre}
            </div>
            {noche && (
              <div className="text-[12px] text-tiza-suave">
                {noche.partida.nombre ? `${fechaLarga(noche.partida.fecha)} · ` : ''}
                {noche.jugadores} {noche.jugadores === 1 ? 'apuntado' : 'apuntados'}
                {!resumen && noche.cuesta > 0 && ` · entra con ${money(noche.cuesta)}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- de qué consta el torneo ---- */}
      {resumen && (
        <>
          {(horaInicio || cierraA) && (
            <p className="mt-0 mb-3 text-[12.5px] leading-snug text-ink-soft">
              {horaInicio && (
                <>
                  Empieza a las <b className="text-ink">{horaInicio}</b>.{' '}
                </>
              )}
              {cierraA && (
                <>
                  El registro se cierra a las <b className="text-ink">{cierraA}</b>.
                </>
              )}
            </p>
          )}

          <p className="field-label mt-0 mb-1.5">De qué consta</p>
          <ul className="m-0 mb-3 list-none p-0">
            {resumen.compras.map((c) => (
              <li
                key={c.que}
                className="border-b border-dashed border-paper-line py-2 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                  <span className="font-semibold text-ink">{c.que}</span>
                  <span className="text-ink-soft">
                    <b className="text-ink">{money(c.dinero)}</b> → {miles(c.fichas)} fichas
                  </span>
                </div>
                {c.hasta && (
                  <div className="mt-0.5 text-[11.5px] text-ink-soft">Se puede {c.hasta}.</div>
                )}
              </li>
            ))}

            {/* La cena va en la misma lista: es parte de lo que se paga, aunque no dé
                fichas. Y hay que decir que sale de la bolsa, porque es lo que hace que
                los premios sean menores de lo que la gente calcula de cabeza. */}
            {resumen.cenaPorPersona > 0 && (
              <li className="border-b border-dashed border-paper-line py-2 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                  <span className="font-semibold text-ink">Cena</span>
                  <span className="text-ink-soft">
                    <b className="text-ink">{money(resumen.cenaPorPersona)}</b> por persona
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-soft">
                  Sale de la bolsa antes de repartir premios.
                </div>
              </li>
            )}
          </ul>

          {resumen.premios.length > 0 && (
            <>
              <p className="field-label mt-0 mb-1.5">Cómo se reparte la bolsa</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {resumen.premios.map((x) => (
                  <span
                    key={x.lugar}
                    className="rounded-full bg-ink/8 px-2.5 py-1 text-[12.5px] font-semibold text-ink"
                  >
                    {x.lugar}º lugar · {x.pct}%
                  </span>
                ))}
              </div>
              {resumen.bolsaMinima > 0 && (
                <p className="mt-0 mb-3 text-[12px] leading-snug text-ink-soft">
                  Con los {noche!.jugadores} que van, la bolsa arranca en{' '}
                  <b className="text-ink">{money(resumen.bolsaMinima)}</b> y sube con cada recompra.
                </p>
              )}
            </>
          )}
        </>
      )}

      <p className="mt-0 mb-4 text-[13px] leading-snug text-ink-soft">
        {cerrada
          ? 'Esa partida ya se cerró, así que ya no se puede apuntar nadie.'
          : registroCerrado
            ? 'El registro de esa partida ya se cerró. Pídele a un admin que te meta.'
            : noche?.yaApuntado
              ? 'Ya estabas apuntado a esta partida. Te llevo a verla.'
              : pendiente?.partida && !yaEnLaLiga
                ? 'Entras a la liga y te apunto a la partida de una vez.'
                : pendiente?.partida
                  ? 'Te apunto a la lista. Si al final no puedes, te puedes borrar desde ahí mismo.'
                  : yaEnLaLiga
                    ? 'Ya eres parte de esta liga. Te llevo directo.'
                    : 'Vas a entrar como jugador. Vas a ver las partidas, la tabla y las reglas de la casa.'}
      </p>

      {/* El visto bueno. Sin él no se puede apuntar: es la diferencia entre "no sabía"
          y "lo leí y dije que sí". */}
      {hayQueLeer && (
        <button
          type="button"
          role="checkbox"
          aria-checked={deAcuerdo}
          onClick={() => setDeAcuerdo((v) => !v)}
          className={`mb-3 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
            deAcuerdo ? 'border-win/45 bg-win/10' : 'border-paper-line bg-paper-soft'
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
              deAcuerdo ? 'border-win bg-win text-white' : 'border-ink-soft/40 bg-white'
            }`}
          >
            {deAcuerdo && <Check size={13} strokeWidth={3.5} />}
          </span>
          <span className="text-[13px] leading-snug font-semibold text-ink">
            Leí todo y estoy de acuerdo
          </span>
        </button>
      )}

      <button
        type="button"
        className="btn btn-marca mb-2 disabled:opacity-45"
        disabled={ocupado || cerrada || registroCerrado || (hayQueLeer && !deAcuerdo)}
        onClick={() => void aceptar()}
      >
        <LogIn size={17} strokeWidth={2.4} />
        {cerrada
          ? 'Ya se cerró'
          : registroCerrado
            ? 'Registro cerrado'
            : noche?.yaApuntado
              ? 'Ver la partida'
              : pendiente?.partida
                ? 'Apuntarme'
                : yaEnLaLiga
                  ? 'Ir a la liga'
                  : 'Entrar a la liga'}
      </button>
      <button type="button" className="btn btn-ghost mb-2" onClick={olvidar}>
        Ahora no
      </button>
    </Sheet>
  )
}
