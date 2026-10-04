import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { reglasDeArranque, type SeccionReglas } from '../../lib/reglas'

/*
 * Las reglas de la casa: el reglamento de la liga y cómo portarse en la mesa.
 *
 * Se ven de corrido y se editan con un botón, en vez de dejar los campos siempre
 * abiertos: casi siempre se entra a leerlas —"¿cuántos puntos da el tercer lugar?"— y
 * no a cambiarlas. Todo se puede cambiar: el texto, el título, y secciones enteras se
 * agregan o se borran, porque el reglamento de arranque es el de esta liga y otra casa
 * querrá el suyo.
 */

interface Props {
  reglas: SeccionReglas[] | null
  soyAdmin: boolean
  onGuardar: (r: SeccionReglas[]) => void
}

export default function Reglas({ reglas, soyAdmin, onGuardar }: Props) {
  const guardadas = reglas ?? reglasDeArranque()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<SeccionReglas[]>(guardadas)

  const abrir = () => {
    setBorrador(guardadas.map((s) => ({ ...s, reglas: [...s.reglas] })))
    setEditando(true)
  }

  const guardar = () => {
    /* Los renglones vacíos se caen solos: es la forma natural de borrar uno. */
    const limpias = borrador
      .map((s) => ({
        ...s,
        titulo: s.titulo.trim(),
        reglas: s.reglas.map((r) => r.trim()).filter(Boolean),
      }))
      /* Una sección sin título y sin reglas se dejó a medias: se cae sola, como los
         renglones vacíos. */
      .filter((s) => s.titulo || s.reglas.length > 0)
      .map((s) => ({ ...s, titulo: s.titulo || 'Sin título' }))
    onGuardar(limpias)
    setEditando(false)
  }

  const cambiar = (si: number, ri: number, texto: string) =>
    setBorrador((b) =>
      b.map((s, i) =>
        i === si ? { ...s, reglas: s.reglas.map((r, j) => (j === ri ? texto : r)) } : s,
      ),
    )

  const quitar = (si: number, ri: number) =>
    setBorrador((b) =>
      b.map((s, i) => (i === si ? { ...s, reglas: s.reglas.filter((_, j) => j !== ri) } : s)),
    )

  const agregar = (si: number) =>
    setBorrador((b) => b.map((s, i) => (i === si ? { ...s, reglas: [...s.reglas, ''] } : s)))

  /* El id sale del reloj: no se ve en pantalla y sólo tiene que no repetirse. */
  const agregarSeccion = () =>
    setBorrador((b) => [...b, { id: `s${Date.now()}`, titulo: '', reglas: [''] }])

  const quitarSeccion = (si: number) => setBorrador((b) => b.filter((_, i) => i !== si))

  if (!editando) {
    return (
      <>
        {guardadas.map((s) => (
          <section key={s.id} className="panel">
            <p className="panel-title">
              <span>{s.titulo}</span>
            </p>
            <ol className="m-0 list-none p-0">
              {s.reglas.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 border-b border-dashed border-paper-line py-2.5 text-[14px] leading-snug text-ink last:border-b-0"
                >
                  <span className="font-display text-[15px] font-bold text-marca-tinta">
                    {i + 1}
                  </span>
                  <span className="flex-1">{r}</span>
                </li>
              ))}
              {s.reglas.length === 0 && (
                <li className="py-2.5 text-[13px] text-ink-soft">Sin reglas todavía.</li>
              )}
            </ol>
          </section>
        ))}

        {soyAdmin && (
          <button type="button" className="btn btn-ghost" onClick={abrir}>
            <Pencil size={16} strokeWidth={2.4} />
            Editar las reglas
          </button>
        )}

        {!reglas && (
          <p className="mt-2 mb-0 text-center text-[12px] leading-snug text-tiza-suave">
            Son las de arranque. {soyAdmin ? 'Edítalas' : 'Un admin puede editarlas'} para dejar las
            de su casa.
          </p>
        )}
      </>
    )
  }

  return (
    <>
      {borrador.map((s, si) => (
        <section key={s.id} className="panel">
          <div className="mb-2 flex items-center gap-1.5">
            <input
              type="text"
              value={s.titulo}
              aria-label="Título de la sección"
              placeholder="De qué va esta sección"
              onChange={(e) =>
                setBorrador((b) =>
                  b.map((x, i) => (i === si ? { ...x, titulo: e.target.value } : x)),
                )
              }
              className="min-w-0 flex-1 border-none border-b-2 border-paper-line bg-transparent px-0.5 py-1 font-display text-lg font-semibold text-ink outline-none focus:border-b-marca"
              style={{ borderBottomStyle: 'solid', borderBottomWidth: 2 }}
            />
            <button
              type="button"
              aria-label={`Borrar la sección ${s.titulo || si + 1}`}
              onClick={() => quitarSeccion(si)}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss active:scale-95"
            >
              <Trash2 size={14} strokeWidth={2.4} />
            </button>
          </div>

          {s.reglas.map((r, ri) => (
            <div key={ri} className="mb-2 flex items-start gap-1.5">
              <textarea
                value={r}
                rows={2}
                aria-label={`Regla ${ri + 1} de ${s.titulo}`}
                placeholder="Escribe la regla"
                onChange={(e) => cambiar(si, ri, e.target.value)}
                className="min-w-0 flex-1 resize-none rounded-lg border border-paper-line bg-white px-2.5 py-2 text-[13px] leading-snug text-ink outline-none focus:border-marca"
              />
              <button
                type="button"
                aria-label={`Quitar la regla ${ri + 1}`}
                onClick={() => quitar(si, ri)}
                className="mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-ink/8 text-ink-soft hover:bg-loss/12 hover:text-loss"
              >
                <X size={13} strokeWidth={2.6} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn-dashed flex items-center justify-center gap-1.5"
            onClick={() => agregar(si)}
          >
            <Plus size={15} strokeWidth={2.6} />
            Agregar regla
          </button>
        </section>
      ))}

      <button
        type="button"
        className="btn-dashed mb-3 flex items-center justify-center gap-1.5"
        onClick={agregarSeccion}
      >
        <Plus size={15} strokeWidth={2.6} />
        Agregar una sección
      </button>

      <button type="button" className="btn btn-marca mb-2" onClick={guardar}>
        <Check size={17} strokeWidth={2.6} />
        Guardar las reglas
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>
        Mejor no
      </button>
    </>
  )
}
