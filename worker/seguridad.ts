/**
 * PIN, sesiones y códigos de liga.
 *
 * El PIN es numérico y corto por decisión de producto (nadie quiere teclear una
 * contraseña larga en la mesa), así que la defensa no puede apoyarse en su longitud:
 *  - se guarda como hash PBKDF2 con 150 000 vueltas y sal propia, nunca en claro;
 *  - la cuenta se bloquea temporalmente tras varios intentos fallidos, que es lo que
 *    de verdad frena el adivinar a fuerza bruta;
 *  - las comparaciones son de tiempo constante.
 */

const VUELTAS = 150_000
const LARGO_SAL = 16
const LARGO_CLAVE = 32

/** Intentos fallidos seguidos antes de bloquear la cuenta. */
export const FALLOS_PERMITIDOS = 5
/** Cuánto dura el bloqueo. */
export const MINUTOS_BLOQUEO = 15
/** Cuánto vive una sesión sin volver a pedir el PIN. */
export const DIAS_SESION = 60

export const LARGO_PIN = 6

const cod = new TextEncoder()

function aHex(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function aleatorio(bytes: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(bytes))
}

async function derivar(pin: string, salHex: string): Promise<string> {
  const sal = Uint8Array.from(salHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const base = await crypto.subtle.importKey('raw', cod.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: VUELTAS },
    base,
    LARGO_CLAVE * 8,
  )
  return aHex(bits)
}

/** Compara sin filtrar por cuánto tardó en encontrar la diferencia. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

export function pinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && new RegExp(`^\\d{${LARGO_PIN}}$`).test(pin)
}

export async function hashearPin(pin: string): Promise<{ hash: string; sal: string }> {
  const sal = aHex(aleatorio(LARGO_SAL))
  return { hash: await derivar(pin, sal), sal }
}

export async function pinCoincide(pin: string, hash: string, sal: string): Promise<boolean> {
  return igualesEnTiempoConstante(await derivar(pin, sal), hash)
}

/* ---- sesiones ---- */

/** Devuelve el token que va al cliente y el hash que se guarda en la base. */
export async function nuevoToken(): Promise<{ token: string; hash: string }> {
  const token = aHex(aleatorio(32))
  return { token, hash: await hashearToken(token) }
}

export async function hashearToken(token: string): Promise<string> {
  return aHex(await crypto.subtle.digest('SHA-256', cod.encode(token)))
}

/* ---- identificadores ---- */

export function nuevoId(): string {
  return crypto.randomUUID()
}

/** Sin O/0 ni I/1: estos códigos se dictan en voz alta y se copian a mano. */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function nuevoCodigoLiga(largo = 6): string {
  const bytes = aleatorio(largo)
  return [...bytes].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('')
}

/** Normaliza el nombre de usuario: lo que se teclea para entrar. */
export function normalizarUsuario(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

export function usuarioValido(u: string): boolean {
  return /^[a-z0-9._-]{3,20}$/.test(u)
}
