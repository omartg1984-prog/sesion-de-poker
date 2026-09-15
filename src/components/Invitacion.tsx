import { CalendarCheck, LogIn, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { api, type InvitacionPartida } from '../lib/api'
import { money } from '../lib/money'
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

  return (
    <Sheet abierta onCerrar={olvidar} titulo={noche ? 'Te invitan a jugar' : 'Te invitaron'}>
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-marca/25 bg-gradient-to-br from-[#2a1016] to-[#100e12] px-4 py-3.5">
        {noche ? (
          <CalendarCheck size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
        ) : (
          <PartyPopper size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
        )}
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[1px] text-tiza-suave uppercase">
            {noche ? `${esTorneo ? 'Torneo' : 'Cash'} · ${liga.nombre}` : yaEnLaLiga ? 'Ya juegas aquí' : 'Liga'}
          </div>
          <div className="truncate font-display text-xl font-bold text-marca-alta">
            {noche ? noche.partida.nombre || fechaLarga(noche.partida.fecha) : liga.nombre}
          </div>
          {noche && (
            <div className="text-[12px] text-tiza-suave">
              {noche.partida.nombre ? `${fechaLarga(noche.partida.fecha)} · ` : ''}
              {noche.jugadores} {noche.jugadores === 1 ? 'apuntado' : 'apuntados'}
              {noche.cuesta > 0 && ` · entra con ${money(noche.cuesta)}`}
            </div>
          )}
        </div>
      </div>

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

      <button
        type="button"
        className="btn btn-marca mb-2 disabled:opacity-45"
        disabled={ocupado || cerrada || registroCerrado}
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
