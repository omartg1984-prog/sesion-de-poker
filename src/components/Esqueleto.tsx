/**
 * Relleno mientras llegan los datos.
 *
 * Un "Cargando…" centrado deja la pantalla vacía y hace sentir la espera más larga.
 * Dibujar la forma de lo que viene hace que la transición no dé el salto.
 */
export default function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="panel animate-pulse">
          <div className="mb-3 h-4 w-1/3 rounded bg-ink/10" />
          <div className="mb-2 h-3 w-2/3 rounded bg-ink/8" />
          <div className="h-3 w-1/2 rounded bg-ink/8" />
        </div>
      ))}
    </div>
  )
}
