/**
 * Genera todos los iconos de la app a partir de `assets/logo.jpg`.
 *
 *   npm run iconos
 *
 * Deja los PNG de la PWA en public/ y las imágenes fuente para Android en assets/,
 * que es de donde las toma `npx @capacitor/assets generate`.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEN = join(RAIZ, 'assets/logo.jpg')

/** El rojo del logo, para que el fondo del icono adaptable no haga costura. */
const ROJO = { r: 223, g: 31, b: 46, alpha: 1 }
/** Verde musgo de la app, para la pantalla de arranque. */
const FIELTRO = { r: 27, g: 36, b: 26, alpha: 1 }
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 }

const salida = (ruta) => {
  const destino = join(RAIZ, ruta)
  mkdirSync(dirname(destino), { recursive: true })
  return destino
}

/** Reescala el logo. lanczos3 es el que menos ablanda al agrandar. */
const logo = (lado) =>
  sharp(ORIGEN).resize(lado, lado, { fit: 'cover', kernel: sharp.kernel.lanczos3 }).png()

/**
 * Igual que `logo`, pero con paleta.
 *
 * El logo son tres colores, pero viene de un JPEG y sus artefactos lo llenan de
 * tonos que no aportan nada y hacen que el PNG pese ocho veces más. Estos iconos
 * viajan al teléfono en cada carga, así que se cuantizan; los de 1024 que consume
 * el generador de Android se quedan completos.
 */
const logoLigero = (lado) =>
  sharp(ORIGEN)
    .resize(lado, lado, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .png({ palette: true, colors: 32, effort: 10 })

/**
 * El logo sin su fondo rojo: solo el rey, con transparencia alrededor.
 *
 * Hace falta para el primer plano del icono adaptable. Si se dejara el rojo propio
 * del archivo, al encogerlo se vería el canto del cuadro contra el fondo rojo del
 * icono. El logo es plano (rojo, negro y blanco), así que basta con volver
 * transparente lo que sea rojo; el negro y el blanco se quedan.
 */
async function reyRecortado() {
  const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const cx = (info.width - 1) / 2
  const cy = (info.height - 1) / 2
  const radio = Math.min(cx, cy)

  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % info.width
    const py = Math.floor(i / 4 / info.width)
    // El dibujo vive dentro de un círculo; fuera solo queda el canto del archivo,
    // que sobre el fondo rojo se vería como un cuadro fantasma.
    const fuera = Math.hypot(px - cx, py - cy) > radio - 2
    const esRojoDeFondo = data[i] > 140 && data[i + 1] < 100 && data[i + 2] < 110
    if (fuera || esRojoDeFondo) data[i + 3] = 0
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

/**
 * Una capa centrada sobre un lienzo de color, ocupando `proporcion` del lado.
 *
 * Android dibuja el icono adaptable en un lienzo del que solo garantiza ver el 66%
 * central: lo de fuera se lo puede comer la máscara del teléfono. Por eso el rey va
 * holgado, o pierde la corona.
 */
async function centrado(lado, proporcion, fondo, origen = null) {
  const dentro = Math.round(lado * proporcion)
  const capa = await sharp(origen ?? ORIGEN)
    .resize(dentro, dentro, { fit: 'contain', background: TRANSPARENTE, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer()

  return sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
    .composite([{ input: capa, gravity: 'center' }])
    .png()
}

const trabajos = [
  // PWA
  ['public/icon-192.png', () => logoLigero(192)],
  ['public/icon-512.png', () => logoLigero(512)],
  ['public/favicon.png', () => logoLigero(64)],

  // Android: icono normal
  ['assets/icon.png', () => logo(1024)],
  ['assets/icon-only.png', () => logo(1024)],

  // Android: icono adaptable. El logo va al 62% para sobrevivir al recorte.
  ['assets/icon-foreground.png', async () => centrado(1024, 0.62, TRANSPARENTE, await reyRecortado())],
  [
    'assets/icon-background.png',
    () => sharp({ create: { width: 1024, height: 1024, channels: 4, background: ROJO } }).png(),
  ],

  // El rey recortado, para poder usarlo dentro de las fichas de la app
  ['public/rey.png', async () => sharp(await reyRecortado()).resize(256, 256, { fit: 'inside' }).png({ palette: true, colors: 32, effort: 10 })],

  // Pantalla de arranque: el logo chico sobre el fondo de la app
  ['assets/splash.png', () => centrado(2732, 0.26, FIELTRO)],
  ['assets/splash-dark.png', () => centrado(2732, 0.26, FIELTRO)],
]

for (const [ruta, hacer] of trabajos) {
  const img = await hacer()
  const info = await img.toFile(salida(ruta))
  console.log(`✓ ${ruta} (${info.width}×${info.height})`)
}
