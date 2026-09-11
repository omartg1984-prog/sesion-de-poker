import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/*
 * Arma el APK firmado.
 *
 * Existe como script y no como una línea en package.json porque el envoltorio de Gradle
 * se llama distinto según el sistema: en Windows `cmd` no encuentra `gradlew` sin el
 * `.bat`, y en Mac y Linux hay que invocarlo como `./gradlew`.
 */
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const android = join(raiz, 'android')

if (!existsSync(android)) {
  console.error('No existe android/. Córrelo primero: npx cap add android')
  process.exit(1)
}

if (!existsSync(join(raiz, 'keystore.properties'))) {
  console.error(
    'Falta keystore.properties en la raíz: sin él el APK sale sin firmar y no se puede\n' +
      'instalar. Si perdiste la llave, revisa el README antes de generar otra.',
  )
  process.exit(1)
}

/* Ruta absoluta: `cmd` no siempre resuelve un .bat por nombre suelto aunque esté en
   el directorio de trabajo, y en Windows Node exige shell para poder correr un .bat. */
const esWindows = process.platform === 'win32'
const envoltorio = join(android, esWindows ? 'gradlew.bat' : 'gradlew')
/* En Windows la tarea va dentro de la cadena, no como argumento suelto: pasar
   argumentos junto a `shell: true` está deprecado porque no se escapan. */
const r = esWindows
  ? spawnSync(`"${envoltorio}" assembleRelease`, { cwd: android, stdio: 'inherit', shell: true })
  : spawnSync(envoltorio, ['assembleRelease'], { cwd: android, stdio: 'inherit' })

if (r.status !== 0) process.exit(r.status ?? 1)

console.log('\n✓ android/app/build/outputs/apk/release/app-release.apk')
