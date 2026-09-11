/*
 * El rey del logo, para donde haga falta una marca.
 *
 * `rey.png` es el rey recortado —el rojo del logo se quitó y quedó transparente—, así
 * que encima de la barra roja se ve exactamente como el logo original, y encima de un
 * fondo oscuro se ve el dibujo solo. Cuando el fondo no es rojo, `conFondo` le pone
 * atrás el disco rojo que le falta.
 */
export default function Logo({
  size = 24,
  conFondo = false,
  className = '',
}: {
  size?: number
  /** Le pone atrás el disco rojo del logo. Para fondos que no son de marca. */
  conFondo?: boolean
  className?: string
}) {
  if (!conFondo) {
    return (
      <img
        src="/rey.png"
        alt=""
        width={size}
        height={size}
        className={`shrink-0 select-none ${className}`}
        draggable={false}
      />
    )
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-marca ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/rey.png"
        alt=""
        width={Math.round(size * 0.86)}
        height={Math.round(size * 0.86)}
        className="select-none"
        draggable={false}
      />
    </span>
  )
}
