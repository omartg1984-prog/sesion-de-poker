import { useState } from 'react'
import { CalendarRange, Check, Plus, Trash2, X } from 'lucide-react'
import type { Temporada } from '../../lib/api'
import { cuandoCorre, semestreDe } from '../../lib/temporadas'

/*
 * Las temporadas de la liga.
 *
 * Las reglas de la casa ya decían "la temporada corre de julio a diciembre, y en
 * diciembre se cierra con posada y ahí se cobra el semestre", pero la tabla contaba
 * todas las noches desde que existe la liga. Una temporada es un rango de fechas y cada
 * noche cae en la suya sola, así que no hay nada que etiquetar al crear la partida y un
 * rango mal puesto se arregla moviendo una fecha.
 *
 * Una liga sin temporadas se ve como siempre: la tabla cuenta todo y aquí no aparece
 * nada. El encabezado sale el día que hay la primera.
 */

const hoy = () => new Date().toISOString().slice(0, 10)

/* ------------------------------------------------------------------ el encabezado */

/**
 * Qué temporada se está viendo, en una línea que se toca para cambiarla.
 *
 * Se probó también con las temporadas como fichas en fila, y no: justo debajo vive el
 * interruptor de "Toda la liga / Por partida", y dos filas de fichas pegadas que hacen
 * cosas distintas se leen mal. Así además aguanta diez temporadas sin deslizarse.
 */
export function EncabezadoDeTemporada({
  temporadas,
  viendo,
  onAbrir,
}: {
  temporadas: Temporada[]
  viendo: string | null
  onAbrir: () => void
}) {
  if (temporadas.length === 0) return null
  const puesta = temporadas.find((t) => t.id === viendo) ?? null

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="mb-3 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none bg-black/30 px-3 py-2.5 text-left"
    >
      <CalendarRange size={18} strokeWidth={2.4} className="shrink-0 text-marca-alta" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold tracking-[.4px] text-tiza-suave uppercase">
          Temporada
        </span>
        <b className="block truncate text-[14.5px] text-white">
          {puesta ? puesta.nombre : 'Toda la historia'}
        </b>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-marca-alta">Cambiar</span>
    </button>
  )
}

/* ------------------------------------------------------------------ el editor */

interface Borrador {
  nombre: string
  desde: string
  hasta: string
  /** Sin fecha de cierre: la temporada que sigue corriendo. */
  corriendo: boolean
}

const deTemporada = (t: Temporada): Borrador => ({
  nombre: t.nombre,
  desde: t.desde,
  hasta: t.hasta ?? '',
  corriendo: t.hasta === null,
})

const nueva = (): Borrador => {
  const s = semestreDe(hoy())
  return { nombre: s.nombre, desde: s.desde, hasta: s.hasta, corriendo: false }
}

/** Los campos de una temporada, los mismos para crear y para corregir. */
function Campos({ valor, onCambio }: { valor: Borrador; onCambio: (b: Borrador) => void }) {
  const campo =
    'mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-2.5 text-[15px] font-semibold text-ink outline-none focus:border-marca'

  return (
    <>
      <label className="mb-3 block">
        <span className="field-label">Cómo se llama</span>
        <input
          type="text"
          value={valor.nombre}
          maxLength={24}
          placeholder="2026 · Jul–Dic"
          onChange={(e) => onCambio({ ...valor, nombre: e.target.value })}
          className={campo}
        />
      </label>

      <div className="mb-3 flex gap-2.5">
        <label className="block min-w-0 flex-1">
          <span className="field-label">Empieza</span>
          <input
            type="date"
            value={valor.desde}
            onChange={(e) => onCambio({ ...valor, desde: e.target.value })}
            className={campo}
          />
        </label>
        <label className="block min-w-0 flex-1">
          <span className="field-label">Termina</span>
          <input
            type="date"
            value={valor.hasta}
            disabled={valor.corriendo}
            onChange={(e) => onCambio({ ...valor, hasta: e.target.value })}
            className={`${campo} disabled:bg-[#efece6] disabled:text-ink-soft`}
          />
        </label>
      </div>

      {/* La de ahora no tiene por qué saber cuándo cierra: a veces se decide en el
          camino. Sin fecha de cierre se queda con todas las noches que vengan. */}
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-soft">
        <input
          type="checkbox"
          checked={valor.corriendo}
          onChange={(e) =>
            onCambio({
              ...valor,
              corriendo: e.target.checked,
              hasta: e.target.checked ? '' : semestreDe(valor.desde || hoy()).hasta,
            })
          }
          className="h-4 w-4 accent-[var(--color-marca)]"
        />
        Todavía no sé cuándo cierra
      </label>
    </>
  )
}

export function EditorDeTemporadas({
  temporadas,
  soyAdmin,
  ocupado,
  viendo,
  onVer,
  onCrear,
  onCambiar,
  onQuitar,
}: {
  temporadas: Temporada[]
  soyAdmin: boolean
  ocupado: boolean
  /** Cuál se está viendo en la tabla, para marcarla aquí. */
  viendo?: string | null
  /** Tocar una temporada la pone en la tabla. Sin esto, la lista sólo se administra. */
  onVer?: (id: string | null) => void
  onCrear: (datos: { nombre: string; desde: string; hasta: string | null }) => void
  onCambiar: (id: string, cambios: { nombre: string; desde: string; hasta: string | null }) => void
  onQuitar: (id: string) => void
}) {
  const [creando, setCreando] = useState(false)
  const [borrador, setBorrador] = useState<Borrador>(nueva)
  /** La que se está corrigiendo, si hay alguna. */
  const [editando, setEditando] = useState<string | null>(null)

  const listo = (b: Borrador) => b.nombre.trim() !== '' && b.desde !== ''
  const aDatos = (b: Borrador) => ({
    nombre: b.nombre.trim(),
    desde: b.desde,
    hasta: b.corriendo ? null : b.hasta || null,
  })

  return (
    <>
      <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
        El campeonato se juega por temporada: los puntos, el saldo, los récords y los títulos
        cuentan sólo las noches de la que se está viendo. Cada noche entra en la suya por su
        fecha, no hay que marcar nada.
        {!soyAdmin && ' Solo un admin de la liga puede cambiarlas.'}
      </p>

      {temporadas.length === 0 && !creando && (
        <div className="balance balance-off">
          <CalendarRange size={16} strokeWidth={2.4} />
          <span>Sin temporadas, la tabla cuenta todas las noches desde que existe la liga.</span>
        </div>
      )}

      <ul className="m-0 mb-3 list-none p-0">
        {/* La historia completa de la liga, que es donde viven los récords de siempre. */}
        {onVer && temporadas.length > 0 && (
          <li className="border-b border-dashed border-paper-line py-3">
            <button
              type="button"
              onClick={() => onVer(null)}
              className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
            >
              <b
                className={`flex items-center gap-1.5 text-[15px] ${
                  viendo === null ? 'text-marca-tinta' : 'text-ink'
                }`}
              >
                {/* La palomita y no un "· se está viendo" pegado al nombre: con los
                    nombres largos aquello se cortaba justo donde decía lo importante. */}
                {viendo === null && <Check size={15} strokeWidth={3} className="shrink-0" />}
                Siempre
              </b>
              <span className="text-[12px] text-ink-soft">
                Todas las noches desde que existe la liga
              </span>
            </button>
          </li>
        )}
        {temporadas.map((t) => (
          <li key={t.id} className="border-b border-dashed border-paper-line py-3 last:border-b-0">
            {editando === t.id ? (
              <>
                <Campos valor={borrador} onCambio={setBorrador} />
                <div className="flex gap-2.5">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>
                    <X size={16} strokeWidth={2.4} />
                    Dejarlo
                  </button>
                  <button
                    type="button"
                    className="btn btn-marca"
                    disabled={!listo(borrador) || ocupado}
                    onClick={() => {
                      onCambiar(t.id, aDatos(borrador))
                      setEditando(null)
                    }}
                  >
                    <Check size={16} strokeWidth={2.4} />
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!onVer}
                  onClick={() => onVer?.(t.id)}
                  className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left disabled:cursor-default"
                >
                  <b
                    className={`flex items-center gap-1.5 text-[15px] ${
                      viendo === t.id ? 'text-marca-tinta' : 'text-ink'
                    }`}
                  >
                    {viendo === t.id && <Check size={15} strokeWidth={3} className="shrink-0" />}
                    <span className="truncate">{t.nombre}</span>
                  </b>
                  <span className="text-[12px] text-ink-soft">{cuandoCorre(t)}</span>
                </button>
                {soyAdmin && (
                  <>
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded-[9px] border-none bg-[#e6e1d8] px-3 py-2 text-[12.5px] font-bold text-ink-soft"
                      onClick={() => {
                        setCreando(false)
                        setBorrador(deTemporada(t))
                        setEditando(t.id)
                      }}
                    >
                      Corregir
                    </button>
                    {/* Quitarla no borra ninguna noche: las partidas se quedan enteras y
                        vuelven a contar donde les toque. Por eso no pregunta dos veces,
                        como sí hace borrar una liga. */}
                    <button
                      type="button"
                      aria-label={`Quitar ${t.nombre}`}
                      className="icon-btn icon-btn-danger"
                      disabled={ocupado}
                      onClick={() => onQuitar(t.id)}
                    >
                      <Trash2 size={15} strokeWidth={2.4} />
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {soyAdmin &&
        (creando ? (
          <div className="rounded-xl border border-paper-line bg-[#faf7f1] p-3">
            <p className="panel-title">
              <span>Nueva temporada</span>
            </p>
            <Campos valor={borrador} onCambio={setBorrador} />
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={() => setCreando(false)}>
                <X size={16} strokeWidth={2.4} />
                Dejarlo
              </button>
              <button
                type="button"
                className="btn btn-marca"
                disabled={!listo(borrador) || ocupado}
                onClick={() => {
                  onCrear(aDatos(borrador))
                  setCreando(false)
                }}
              >
                <Check size={16} strokeWidth={2.4} />
                Crear
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-dashed"
            onClick={() => {
              setEditando(null)
              setBorrador(nueva())
              setCreando(true)
            }}
          >
            <Plus size={15} strokeWidth={2.6} className="-mt-0.5 mr-1 inline" />
            {temporadas.length === 0 ? 'Partir la liga en temporadas' : 'Nueva temporada'}
          </button>
        ))}
    </>
  )
}
