import { Check, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Avatar, { AvatarEditable } from '../../components/Avatar'
import Sheet from '../../components/Sheet'
import type { Liga } from '../../lib/api'

/*
 * La ficha de la liga: su foto en grande, su nombre y de qué va.
 *
 * Se abre al tocar la foto de la barra. Ver y editar están separados a propósito: antes
 * tocar la foto abría el carrete del teléfono de golpe, así que quien sólo quería verla
 * acababa buscando el botón de cancelar. Ahora tocar es ver, y editar tiene su botón.
 */

const LARGO_DESCRIPCION = 400

interface Props {
  abierta: boolean
  liga: Liga
  soyAdmin: boolean
  /** Abrir directo en modo edición, para el lápiz de la barra. */
  editandoDeEntrada?: boolean
  onCerrar: () => void
  onGuardar: (cambios: { nombre: string; descripcion: string }) => Promise<void> | void
  onFoto: (foto: string | null) => void
  onError: (mensaje: string) => void
}

export default function LaLiga({
  abierta,
  liga,
  soyAdmin,
  editandoDeEntrada = false,
  onCerrar,
  onGuardar,
  onFoto,
  onError,
}: Props) {
  const [editando, setEditando] = useState(editandoDeEntrada)
  const [nombre, setNombre] = useState(liga.nombre)
  const [descripcion, setDescripcion] = useState(liga.descripcion ?? '')
  const [ocupado, setOcupado] = useState(false)

  /* Al abrirla se parte siempre de lo que hay guardado: si alguien dejó a medias una
     edición y cerró, no tiene por qué reaparecer después. */
  useEffect(() => {
    if (!abierta) return
    setEditando(editandoDeEntrada && soyAdmin)
    setNombre(liga.nombre)
    setDescripcion(liga.descripcion ?? '')
  }, [abierta, editandoDeEntrada, soyAdmin, liga.nombre, liga.descripcion])

  const guardar = async () => {
    if (ocupado || !nombre.trim()) return
    setOcupado(true)
    await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() })
    setOcupado(false)
    setEditando(false)
  }

  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="La liga">
      {/* La foto, en grande. En modo edición trae encima su propio botón de cámara. */}
      <div className="mb-4 flex justify-center">
        {editando ? (
          <AvatarEditable
            foto={liga.foto}
            nombre={liga.nombre}
            size={148}
            etiqueta="Cambiar la foto de la liga"
            onCambiar={onFoto}
            onError={onError}
          />
        ) : (
          <Avatar foto={liga.foto} nombre={liga.nombre} size={148} />
        )}
      </div>

      {editando ? (
        <>
          <label className="mb-3 block">
            <span className="field-label">Nombre de la liga</span>
            <input
              type="text"
              value={nombre}
              maxLength={60}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>

          <label className="mb-1 block">
            <span className="field-label">De qué va</span>
            <textarea
              value={descripcion}
              rows={3}
              maxLength={LARGO_DESCRIPCION}
              placeholder="ej. Cash los domingos en casa de Beto, entrada de $500. Torneo el último sábado del mes."
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-1 w-full resize-none rounded-xl border border-paper-line bg-white px-3 py-2.5 text-[14px] leading-snug text-ink outline-none focus:border-marca"
            />
          </label>
          <p className="mt-0 mb-4 text-right text-[11px] text-ink-soft">
            {descripcion.length}/{LARGO_DESCRIPCION}
          </p>

          <button
            type="button"
            className="btn btn-marca mb-2 disabled:opacity-45"
            disabled={ocupado || !nombre.trim()}
            onClick={() => void guardar()}
          >
            <Check size={17} strokeWidth={2.6} />
            Guardar
          </button>
          {!nombre.trim() && (
            <p className="mt-0 mb-2 text-center text-[12px] text-loss">
              La liga necesita un nombre.
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost mb-2"
            onClick={() => {
              setNombre(liga.nombre)
              setDescripcion(liga.descripcion ?? '')
              setEditando(false)
            }}
          >
            Mejor no
          </button>

          {liga.foto && (
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
            {liga.nombre}
          </h3>

          {liga.descripcion ? (
            <p className="mx-auto mt-2 mb-4 max-w-[46ch] text-center text-[14px] leading-relaxed whitespace-pre-line text-ink-soft">
              {liga.descripcion}
            </p>
          ) : (
            <p className="mx-auto mt-2 mb-4 max-w-[40ch] text-center text-[13px] leading-snug text-ink-soft/70">
              {soyAdmin
                ? 'Todavía no dice de qué va. Escríbelo para que el que llegue nuevo sepa cómo se juega aquí.'
                : 'Todavía nadie ha escrito de qué va esta liga.'}
            </p>
          )}

          {soyAdmin && (
            <button type="button" className="btn btn-ghost mb-2" onClick={() => setEditando(true)}>
              <Pencil size={16} strokeWidth={2.4} />
              Editar la liga
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
