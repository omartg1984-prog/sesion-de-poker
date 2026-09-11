/**
 * Genera todos los iconos de la app (ficha de póker sobre fieltro verde) sin dependencias.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Deja los PNG de la PWA en public/ y las imágenes fuente para Android en assets/,
 * que es de donde las toma `npx @capacitor/assets generate`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const FIELTRO = [13, 92, 55]
const FIELTRO_HONDO = [8, 63, 38]
const ORO = [232, 197, 106]
const ORO_CLARO = [247, 215, 116]
const CREMA = [246, 242, 232]

const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

/* ---- codificador PNG (RGBA) ---- */

const TABLA_CRC = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** `pixel(x, y)` devuelve [r, g, b] o [r, g, b, a]. */
function png(tam, pixel) {
  const raw = Buffer.alloc(tam * (tam * 4 + 1))
  let o = 0
  for (let y = 0; y < tam; y++) {
    raw[o++] = 0 // filtro "none"
    for (let x = 0; x < tam; x++) {
      const [r, g, b, a = 255] = pixel(x, y)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
      raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0)
  ihdr.writeUInt32BE(tam, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(raw, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ])
}

/* ---- la ficha ---- */

/**
 * ¿El punto (x, y) cae dentro de una pica? Coordenadas normalizadas a [-1, 1] con la
 * y hacia abajo. Una pica son dos lóbulos abajo, un triángulo arriba y el tallo.
 */
function enPica(x, y) {
  const triangulo = y >= -0.66 && y <= 0.14 && Math.abs(x) <= (y + 0.66) * 0.70
  const loboIzq = Math.hypot(x + 0.30, y - 0.10) <= 0.36
  const loboDer = Math.hypot(x - 0.30, y - 0.10) <= 0.36
  // el tallo se abre hacia abajo
  const tallo = y >= 0.16 && y <= 0.66 && Math.abs(x) <= 0.045 + (y - 0.16) * 0.46
  return triangulo || loboIzq || loboDer || tallo
}

/**
 * Anatomía de la ficha. `d` es la distancia al centro normalizada (0 en el centro,
 * 1 en el borde). Fuera de la ficha devuelve null.
 *
 * Es la misma ficha que dibuja la app: cuerpo, muescas en el canto, anillo punteado
 * y disco central. En el ícono el centro lleva una pica en vez del valor, porque no
 * representa una denominación sino a la app entera.
 */
function anilloFicha(d, angulo, x, y) {
  if (d > 1) return null
  if (d > 0.93) return ORO
  if (d > 0.78) {
    // 6 muescas de fieltro repartidas en el canto
    const seg = ((angulo / Math.PI) * 3 + 6) % 1
    return seg < 0.46 ? FIELTRO_HONDO : ORO
  }
  if (d > 0.70) return ORO
  if (d > 0.66) return CREMA
  // anillo punteado: fino y espaciado, si no parece engrane
  if (d > 0.62) {
    const seg = ((angulo / Math.PI) * 9 + 18) % 1
    return seg < 0.42 ? ORO : CREMA
  }
  // disco central con la pica
  const px = x / 0.60
  const py = y / 0.60
  return enPica(px, py) ? FIELTRO_HONDO : CREMA
}

/**
 * @param tam         lado en píxeles
 * @param proporcion  qué tanto del lienzo ocupa la ficha (1 = de borde a borde)
 * @param fondo       'fieltro' | 'transparente'
 */
function ficha(tam, proporcion = 1, fondo = 'fieltro') {
  const c = (tam - 1) / 2
  const radio = c * proporcion
  return (x, y) => {
    const dx = x - c
    const dy = y - c
    const dist = Math.hypot(dx, dy)
    const color = anilloFicha(dist / radio, Math.atan2(dy, dx), dx / radio, dy / radio)
    if (color) return color
    if (fondo === 'transparente') return [0, 0, 0, 0]
    return mezcla(FIELTRO, FIELTRO_HONDO, Math.min(1, dist / c))
  }
}

const fieltroLiso = (tam) => {
  const c = (tam - 1) / 2
  return (x, y) => mezcla(FIELTRO, FIELTRO_HONDO, Math.min(1, Math.hypot(x - c, y - c) / c))
}

/* ---- salida ---- */

const salidas = [
  // PWA
  ['public/icon-192.png', 192, ficha(192, 0.86)],
  ['public/icon-512.png', 512, ficha(512, 0.86)],
  // Android: icono normal
  ['assets/icon.png', 1024, ficha(1024, 0.86)],
  ['assets/icon-only.png', 1024, ficha(1024, 0.86)],
  // Android: icono adaptable (el sistema recorta, por eso la ficha va más chica)
  ['assets/icon-foreground.png', 1024, ficha(1024, 0.52, 'transparente')],
  ['assets/icon-background.png', 1024, fieltroLiso(1024)],
  // Pantalla de arranque
  ['assets/splash.png', 2732, ficha(2732, 0.26)],
  ['assets/splash-dark.png', 2732, ficha(2732, 0.26)],
]

for (const [ruta, tam, pixel] of salidas) {
  const destino = join(RAIZ, ruta)
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, png(tam, pixel))
  console.log(`✓ ${ruta} (${tam}×${tam})`)
}
