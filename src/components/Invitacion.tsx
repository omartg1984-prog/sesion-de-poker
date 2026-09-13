import { LogIn, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { api } from '../lib/api'
import { conAviso, useApp } from '../store/app'

/*
 * Entrar a una liga por liga con un link, en vez de teclear el código.
 *
 * El link trae el código pegado atrás (`?liga=ABC123`). Al abrirlo, la app lo guarda y
 * limpia la dirección —para que recargar no vuelva a preguntar— y en cuanto hay sesión
 * pregunta por el nombre de la liga y ofrece entrar. Si todavía no ha entrado a su
 * cuenta, la invitación espera: se guarda en la pestaña y aparece después de que entre.
 */

const GUARDADA = 'onlycards_invitacion'

/** El link que se manda al grupo. */
export const linkDeInvitacion = (codigo: string) =>
  `${window.location.origin}/?liga=${encodeURIComponent(codigo)}`

function leerDeLaUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const codigo = params.get('liga')
  if (!codigo) return null
  /* Se borra de la dirección para que recargar la página no vuelva a preguntar. */
  params.delete('liga')
  const limpia = window.location.pathname + (params.toString() ? `?${params}` : '')
  window.history.replaceState(null, '', limpia)
  return codigo.trim().toUpperCase()
}

export default function Invitacion() {
  const usuario = useApp((s) => s.usuario)
  const irALiga = useApp((s) => s.irALiga)
  const avisar = useApp((s) => s.avisar)

  const [codigo, setCodigo] = useState<string | null>(null)
  const [liga, setLiga] = useState<{ id: string; nombre: string } | null>(null)
  const [yaEstaba, setYaEstaba] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  /* El código puede llegar antes que la sesión, así que se guarda y se espera. */
  useEffect(() => {
    const deLaUrl = leerDeLaUrl()
    if (deLaUrl) {
      try {
        sessionStorage.setItem(GUARDADA, deLaUrl)
      } catch {
        /* en una pestaña privada no se puede guardar; la invitación vale para este rato */
      }
      setCodigo(deLaUrl)
      return
    }
    try {
      setCodigo(sessionStorage.getItem(GUARDADA))
    } catch {
      setCodigo(null)
    }
  }, [])

  const olvidar = () => {
    try {
      sessionStorage.removeItem(GUARDADA)
    } catch {
      /* da igual: de todos modos se limpia el estado */
    }
    setCodigo(null)
    setLiga(null)
  }

  useEffect(() => {
    if (!codigo || !usuario) return
    let cancelado = false
    void (async () => {
      const r = await conAviso(() => api.invitacion(codigo))
      if (cancelado) return
      if (!r) {
        olvidar()
        return
      }
      setLiga(r.liga)
      setYaEstaba(r.yaEstaba)
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, usuario])

  const entrar = async () => {
    if (!codigo || ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.unirme(codigo))
    setOcupado(false)
    if (!r) return
    olvidar()
    avisar(r.yaEstaba ? `Ya estabas en ${r.liga.nombre}` : `Bienvenido a ${r.liga.nombre}`)
    irALiga(r.liga.id)
  }

  if (!liga) return null

  return (
    <Sheet abierta onCerrar={olvidar} titulo="Te invitaron">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-marca/25 bg-gradient-to-br from-[#2a1016] to-[#100e12] px-4 py-3.5">
        <PartyPopper size={26} className="shrink-0 text-marca-alta" strokeWidth={2.2} />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[1px] text-tiza-suave uppercase">
            {yaEstaba ? 'Ya juegas aquí' : 'Liga'}
          </div>
          <div className="truncate font-display text-xl font-bold text-marca-alta">
            {liga.nombre}
          </div>
        </div>
      </div>

      <p className="mt-0 mb-4 text-[13px] leading-snug text-ink-soft">
        {yaEstaba
          ? 'Ya eres parte de esta liga. Te llevo directo.'
          : 'Vas a entrar como jugador. Vas a ver las partidas, la tabla y las reglas de la casa.'}
      </p>

      <button
        type="button"
        className="btn btn-marca mb-2"
        disabled={ocupado}
        onClick={() => void entrar()}
      >
        <LogIn size={17} strokeWidth={2.4} />
        {yaEstaba ? 'Ir a la liga' : 'Entrar a la liga'}
      </button>
      <button type="button" className="btn btn-ghost mb-2" onClick={olvidar}>
        Ahora no
      </button>
    </Sheet>
  )
}
