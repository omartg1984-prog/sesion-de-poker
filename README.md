# OnlyCards

**▶ https://sesion-de-poker.omartg-1984.workers.dev**

App para llevar la cuenta de las partidas de póker en casa: quién entró y con cuánto, cómo se
reparten las fichas físicas según el inventario que tienes, quién ganó, y el acumulado de la
liga a lo largo de la temporada.

Cada quien se hace una cuenta con usuario y un PIN de seis dígitos —no se pide correo— y entra
a una liga con un código. Los datos viven en Cloudflare (Workers + D1), no en el teléfono, así
que todos ven lo mismo y nadie pierde nada al cambiar de aparato.

Hay un APK de Android que abre este mismo sitio; ver más abajo.

Cada `git push` a `main` la republica sola en Cloudflare (~1 min).

## Cómo correrla

Necesitas Node.js 20 o más nuevo. Son **dos procesos**: Vite sirve la interfaz y `wrangler dev`
atiende el API, y Vite le reenvía `/api` para que el navegador vea todo en el mismo origen (si
no, la cookie de sesión no funciona).

```bash
npm install
npx wrangler dev        # en una terminal: el API en el 8787
npm run dev             # en otra: la interfaz en el 5173
```

Abre `http://localhost:5173`. Sin el primero, la app carga pero no deja entrar.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Interfaz en desarrollo |
| `npm run build` | Compila a `dist/` |
| `npm test` | Corre los tests (Vitest) |
| `npm run check` | Revisa tipos de la app y del worker |
| `npm run apk:preparar` | Íconos y splash desde `assets/logo.jpg` |
| `npm run apk:sync` | Compila y sincroniza el proyecto de Android |

## Cómo llevarla al celular

Abre la dirección de arriba en Chrome y usa *Agregar a pantalla de inicio*; queda con su ícono
como cualquier app. En iPhone es el botón de compartir → *Añadir a pantalla de inicio*.

Para Android también hay APK, que es lo que conviene repartir entre amigos: ver más abajo.

## Cómo se usa

Creas una **liga** y le pones el inventario de fichas de la casa: qué colores hay, cuánto vale
cada uno y cuántas tienes. Compartes el código de la liga y los demás entran con él.

Dentro de la liga vas creando **partidas** con fecha, de tipo *Cash* o *Torneo*. Un admin marca
quiénes llegaron —entran con $500 salvo que le cambies el monto a alguien— y la app calcula
sola cuántas fichas de cada color darle a cada quien.

**Cash** — `Jugadores · Reparto · Final · Resultado · Números`
- *Jugadores*: quién entró, con cuánto, y sus recompras.
- *Reparto*: cuántas fichas de cada color le tocan a cada uno (ver abajo).
- *Final*: conteo final de fichas, con el resultado en vivo.
- *Resultado*: total en la mesa, cuadre, ranking e imagen para WhatsApp.
- *Números*: las estadísticas de esa noche y los destacados.

`invertido = entrada + Σ recompras` · `valor final = Σ fichas × valor` · `P/L = final − invertido`

**Torneo** — `Torneo · Jugadores · Reparto · Resultado · Números`
- *Torneo*: costo de entrada, recompra, add-on y los premios por lugar en % (con presets).
- *Jugadores*: recompras y add-ons por jugador, con la bolsa acumulada en vivo.
- *Resultado*: desglose de la bolsa, quién quedó en cada lugar, premio y neto por jugador.

`premio del lugar = bolsa × %` · `neto = premio − pagado` (los netos suman cero si los % suman 100)

Al **cerrar** una partida entra al acumulado de la liga: la pestaña *Posiciones* arma el podio,
el saldo y el rendimiento de cada quien, los récords de la temporada y los títulos (el Rey, el
Tiburón, el Cajero…). Tanto la tabla de la liga como los números de cada noche se comparten al
chat como imagen.

## El reparto de fichas

Es la parte con más chiste. Dado lo que pone cada jugador y un **inventario compartido** de
fichas físicas, reparte de forma pareja sin que a nadie le toquen puras fichas de un color:

1. **Tope justo por color** = `floor(inventario / nº de jugadores)`, para que alcance a todos.
   Con el switch *Ignorar inventario* no hay tope.
2. **Pila de cambio acotada**: a cada quien le toca una cantidad fija de cada denominación
   excepto la más grande — topes `[16, 12, 8, 6, 4, 3, 2, 2…]` de menor a mayor valor. Así nadie
   acapara las fichas chicas.
3. **El resto va en fichas grandes**, de mayor a menor valor. Una entrada más grande se cubre con
   más verdes, no con más blancas.
4. **Reparación exacta**: ajusta con la ficha más grande que quepa hasta cuadrar el monto justo.
5. Si el inventario no alcanza, reparte lo máximo posible y **reporta el faltante**.

Con los colores por defecto (25/10/5/2/1) e inventario amplio: `$500` → 14 verdes, 7 negras,
8 rojas, 12 azules, 16 blancas; `$300` → 6 verdes y las mismas chicas.

**Edición manual**: cambia cualquier número y ese jugador queda marcado como *Manual*. El cálculo
aparta primero sus fichas y reparte lo que sobra entre los automáticos, que **se reacomodan en
vivo**. El botón *Auto* lo regresa al reparto automático, y *Recalcular todo en automático*
limpia todos. Abajo ves el inventario usado por color y un aviso en rojo si te pasas.

## Cuentas y datos

Todo vive en D1 (el SQLite de Cloudflare). El PIN no se guarda: se guarda su hash PBKDF2-SHA256
con sal propia y 100 000 vueltas, que es el tope que permite Cloudflare. Tras cinco intentos
fallidos la cuenta se bloquea quince minutos. La sesión es una cookie `HttpOnly` que dura 60
días y de la que sólo se guarda el hash del token.

**No se pide correo**, así que nadie puede recuperar su PIN solo: se lo reinicia quien
administra la app, desde *Administrar usuarios*. Ese papel lo toma el primero que se registra.

Dentro de cada liga puede haber varios admins —quien ya es admin puede nombrar a otro— y la
liga nunca se queda sin ninguno. Borrar la liga entera sólo lo puede hacer quien la creó.

## El APK de Android

El APK **no lleva la app adentro**: abre el sitio ya publicado en Cloudflare
(`capacitor.config.ts` → `server.url`).

Tiene que ser así. La app pide todo con rutas relativas (`fetch('/api/...')`) y la
sesión viaja en una cookie del mismo sitio. Si los archivos vivieran dentro del APK,
el WebView correría en el origen `https://localhost` y `/api/entrar` daría contra los
propios archivos empaquetados, donde no hay servidor: no se podría ni entrar.

La consecuencia buena es que **una actualización no obliga a reinstalar**. Se sube el
cambio a Cloudflare y a todos les llega la próxima vez que abren la app. El APK sólo
se vuelve a repartir si cambia algo del cascarón: el ícono, el nombre, los permisos o
la configuración de Capacitor.

```bash
npm run apk:preparar   # íconos y splash desde assets/logo.jpg
npm run apk:sync       # build + npx cap sync android
cd android && ./gradlew assembleDebug
```

El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`.

**Java: tiene que ser el 21, ni más ni menos.** Capacitor 8 compila contra 21, así que
un JDK 17 falla con `invalid source release: 21`; y Gradle 8.14 no entiende el JDK 25
que trae Android Studio, así que ese falla con `Unsupported class file major version 69`.
Se resuelve apuntando Gradle al 21 en `android/gradle.properties`:

```properties
org.gradle.java.home=C:/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot
```

Ojo: `android/` está en `.gitignore` porque se regenera con `npx cap add android`, así
que esa línea hay que volver a ponerla si se regenera el proyecto.

**Compartir y guardar dentro del APK** pasan por `@capacitor/share` y
`@capacitor/filesystem` (ver `src/lib/nativo.ts`). El WebView de Android no trae
`navigator.share`, y una descarga que arranca la página se pierde sin avisar. El puente
nativo sí funciona aunque la app venga de un servidor remoto, pero los plugins se
registran del lado nativo: **agregar un plugin obliga a repartir un APK nuevo**.

## Estructura

```
worker/
  rutas.ts          todos los endpoints del API
  seguridad.ts      hash del PIN, tokens de sesión, códigos de liga
  posiciones.ts     tabla acumulada de la liga, récords y títulos
migraciones/        el esquema de D1
src/
  lib/
    distribution.ts algoritmo de reparto de fichas
    money.ts        formato de $ y cálculos de cash/torneo
    api.ts          llamadas al API y tipos compartidos
    lienzo.ts       paleta y brochas de las imágenes que salen al chat
    shareImage.ts   imagen de resultados de cash y torneo
    imagenTablas.ts imagen de la tabla de la liga y de los números de una noche
    nativo.ts       compartir y guardar archivos dentro del APK
    __tests__/      tests de distribution y money
  components/       Chip, ChipsGrid, Logo, Medalla, Titulos, ShareBlock, Sheet…
  screens/          una pantalla por sección; partida/ y liga/ por pestaña
  store/app.ts      sesión, navegación y avisos (Zustand)
  index.css         paleta y clases compartidas (Tailwind v4)
```

Stack: Vite + React + TypeScript, Tailwind CSS v4, Zustand, Vitest, Capacitor.
Backend en Cloudflare Workers + D1, con cuentas por usuario y PIN.
