import { Check, Pencil, Share2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Avatar, { AvatarEditable } from '../../components/Avatar'
import Sheet from '../../components/Sheet'
import type { ConfigTorneo, DetallePartida } from '../../lib/api'
import { money } from '../../lib/money'
import { resumenDeTorneo } from '../../lib/resumenTorneo'
import { duracionLarga, horaCorta } from '../../lib/tiempo'
import { invertidoDe } from './comun'

/*
 * La ficha de la noche: su foto en grande y de qué va la partida.
 *
 * Se abre al tocar el nombre en la barra. Hasta ahora todo eso —a qué hora empieza,
 * cuánto cuesta entrar, hasta cuándo se recompra, cómo se reparte— estaba repartido
 * entre tres pestañas, y al que llegaba a media noche había que contárselo de boca.
 *
 * Igual que en la liga, tocar es ver y editar tiene su botón: tocar la foto no abre el
 * carrete de golpe.
 */

function fechaLarga(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Un renglón del resumen: lo que se pregunta a la izquierda y la respuesta a la derecha. */
function Dato({ que, children }: { que: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-dashed border-paper-line py-2 last:border-b-0">
      <span className="shrink-0 text-[13px] text-ink-soft">{que}</span>
      <span className="text-right text-[13.5px] font-semibold text-ink">{children}</span>
    </li>
  )
}

interface Props {
  abierta: boolean
  datos: DetallePartida
  torneo: ConfigTorneo
  /** Quién lleva el banco esa noche. */
  jefe: string | null
  puedeEditar: boolean
  onCerrar: () => void
  onGuardarNombre: (nombre: string) => void
  onFoto: (foto: string | null) => void
  onCompartir: () => void
  onError: (mensaje: string) => void
}

export default function LaPartida({
  abierta,
  datos,
  torneo,
  jefe,
  puedeEditar,
  onCerrar,
  onGuardarNombre,
  onFoto,
  onCompartir,
  onError,
}: Props) {
  const p = datos.partida
  const esTorneo = p.tipo === 'torneo'
  const cerrada = p.estado === 'cerrada'
  const titulo = p.nombre || fechaLarga(p.fecha)

  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(p.nombre ?? '')

  /* Al abrirla se parte de lo que hay guardado: una edición que se dejó a medias no
     tiene por qué reaparecer después. */
  useEffect(() => {
    if (!abierta) return
    setEditando(false)
    setNombre(p.nombre ?? '')
  }, [abierta, p.nombre])

  const resumen = esTorneo ? resumenDeTorneo(torneo, datos.participaciones.length) : null
  const enLaMesa = datos.participaciones.reduce((s, x) => s + invertidoDe(x), 0)

  const arrancoEn = p.arrancado_en ?? null
  const terminoEn = p.terminado_en ?? null
  const cierraA = p.registro_hasta ?? null

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="La partida">
      <div className="mb-4 flex justify-center">
        {editando ? (
          <AvatarEditable
            foto={p.foto ?? null}
            nombre={titulo}
            size={148}
            etiqueta="Cambiar la foto de la partida"
            onCambiar={onFoto}
            onError={onError}
          />
        ) : (
          <Avatar foto={p.foto ?? null} nombre={titulo} size={148} />
        )}
      </div>

      {editando ? (
        <>
          <label className="mb-4 block">
            <span className="field-label">Nombre de la partida</span>
            <input
              type="text"
              value={nombre}
              maxLength={60}
              placeholder={fechaLarga(p.fecha)}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>

          <button
            type="button"
            className="btn btn-marca mb-2"
            onClick={() => {
              onGuardarNombre(nombre.trim())
              setEditando(false)
            }}
          >
            <Check size={17} strokeWidth={2.6} />
            Guardar
          </button>
          <button
            type="button"
            className="btn btn-ghost mb-2"
            onClick={() => {
              setNombre(p.nombre ?? '')
              setEditando(false)
            }}
          >
            Mejor no
          </button>

          {p.foto && (
            <button
              type="button"
              className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none bg-ink/8 py-2.5 text-[13px] font-semibold text-ink-soft active:scale-[.99]"
              onClick={() => onFoto(null)}
            >
              <Trash2 size={15} strokeWidth={2.4} />
              Quitar la foto
            </button>
          )}
        </>
      ) : (
        <>
          <h3 className="m-0 text-center font-display text-2xl font-bold tracking-[.5px] text-ink uppercase">
            {titulo}
          </h3>
          <p className="mt-1 mb-4 text-center text-[13px] text-ink-soft">
            {esTorneo ? 'Torneo' : 'Cash'} · {datos.liga.nombre}
            {p.nombre ? ` · ${fechaLarga(p.fecha)}` : ''}
            {cerrada ? ' · ya cerró' : ''}
          </p>

          <ul className="m-0 mb-4 list-none p-0">
            <Dato que="Apuntados">
              {datos.participaciones.length}{' '}
              {datos.participaciones.length === 1 ? 'jugador' : 'jugadores'}
            </Dato>
            {jefe && <Dato que="Lleva el banco">{jefe}</Dato>}

            {torneo.horaInicio && esTorneo && (
              <Dato que="Se quedó a las">{torneo.horaInicio}</Dato>
            )}
            {cierraA && !arrancoEn && (
              <Dato que="El registro cierra">{horaCorta(cierraA)}</Dato>
            )}
            {arrancoEn && !terminoEn && <Dato que="Arrancó a las">{horaCorta(arrancoEn)}</Dato>}
            {arrancoEn && terminoEn && (
              <Dato que="Se jugó de">
                {horaCorta(arrancoEn)} a {horaCorta(terminoEn)}
                {duracionLarga(arrancoEn, terminoEn) && (
                  <span className="font-normal text-ink-soft">
                    {' '}
                    · {duracionLarga(arrancoEn, terminoEn)}
                  </span>
                )}
              </Dato>
            )}

            {!esTorneo && enLaMesa > 0 && <Dato que="Dinero en la mesa">{money(enLaMesa)}</Dato>}
          </ul>

          {/* De qué consta el torneo: lo mismo que lee quien abre el link, para el que
              ya está dentro y llegó a media noche. */}
          {resumen && (
            <>
              <p className="field-label mt-0 mb-1.5">De qué consta</p>
              <ul className="m-0 mb-4 list-none p-0">
                {resumen.compras.map((c) => (
                  <li
                    key={c.que}
                    className="border-b border-dashed border-paper-line py-2 last:border-b-0"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                      <span className="font-semibold text-ink">{c.que}</span>
                      <span className="text-ink-soft">
                        <b className="text-ink">{money(c.dinero)}</b> →{' '}
                        {Math.round(c.fichas).toLocaleString('es-MX')} fichas
                      </span>
                    </div>
                    {(c.cuantas || c.hasta) && (
                      <div className="mt-0.5 text-[11.5px] text-ink-soft">
                        {[c.cuantas, c.hasta]
                          .filter(Boolean)
                          .join(', ')
                          .replace(/^./, (l) => l.toUpperCase())}
                        .
                      </div>
                    )}
                  </li>
                ))}
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
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {resumen.premios.map((x) => (
                      <span
                        key={x.lugar}
                        className="rounded-full bg-ink/8 px-2.5 py-1 text-[12.5px] font-semibold text-ink"
                      >
                        {x.lugar}º lugar · {x.pct}%
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {!cerrada && (
            <button type="button" className="btn btn-share mb-2" onClick={onCompartir}>
              <Share2 size={17} strokeWidth={2.4} />
              Compartir la partida
            </button>
          )}

          {puedeEditar && (
            <button type="button" className="btn btn-ghost mb-2" onClick={() => setEditando(true)}>
              <Pencil size={16} strokeWidth={2.4} />
              Cambiar nombre y foto
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
