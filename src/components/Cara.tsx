/*
 * La foto de alguien, o su inicial cuando no tiene.
 *
 * Vivía dentro de la tabla de posiciones y ahora la usa también la mesa del simulador:
 * en los dos lados la gente se reconoce por la cara antes que por el nombre.
 */
export default function Cara({
  nombre,
  foto,
  size = 34,
}: {
  nombre: string
  foto: string | null
  size?: number
}) {
  return (
    <span
      /* `block` no es adorno: un span en linea ignora el ancho y el alto, y dentro del
         podio —que no es flex— la foto se salía del tamaño pedido. */
      className="block shrink-0 overflow-hidden rounded-full bg-ink/8"
      style={{ width: size, height: size }}
    >
      {foto ? (
        <img src={foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
          {nombre.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}
