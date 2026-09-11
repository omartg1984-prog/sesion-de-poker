# Sesión de Póker

App web instalable (PWA) para llevar la cuenta de las partidas de póker en casa: cuánto pone
cada quien, cómo se reparten las fichas físicas según el inventario que tienes, y quién ganó.
Funciona sin internet, guarda todo sola en el dispositivo y no manda nada a ningún servidor.

## Cómo correrla

Necesitas Node.js 20 o más nuevo.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila la PWA a `dist/` |
| `npm run build:archivo` | Arma un solo `.html` con todo adentro en `dist-archivo/` |
| `npm run preview` | Sirve `dist/` para probar la PWA ya compilada |
| `npm test` | Corre los tests (Vitest) |

## Cómo llevarla al celular

### Opción A — archivo único por WhatsApp (no necesita la compu prendida)

```bash
npm run build:archivo
```

Queda `dist-archivo/index.html`: un solo archivo con la app completa adentro. Mándalo por
WhatsApp o correo, **descárgalo** en el celular y ábrelo desde *Descargas* con Chrome. Funciona
sin internet y guarda los datos en ese navegador. Es también la forma de compartirla con tus
amigos.

> Ábrelo desde Descargas, **no** desde el visor de WhatsApp: ahí la URL es `content://`, el
> navegador no conserva nada al salir y la app te lo avisa en pantalla. Si te toca usarlo así,
> guarda un respaldo antes de cerrar.

### Opción B — por wifi, desde la compu

```bash
npm run build
npm run preview -- --host
```

La terminal da una dirección tipo `http://192.168.100.4:4173`. Ábrela en el celular (mismo wifi)
y listo. Los datos se guardan en el navegador del celular. Requiere que la compu siga prendida
y en la misma red; por ser `http://` sin certificado, Chrome no ofrece instalarla ni funciona
sin conexión.

### Opción C — instalada de verdad (ícono, offline, sin depender de nadie)

Sube el contenido de `dist/` a cualquier hosting estático con **HTTPS** (Netlify, Vercel,
Cloudflare Pages, GitHub Pages). Desde esa URL:

- **Android / Chrome**: menú ⋮ → *Agregar a pantalla de inicio* (o *Instalar app*).
- **iPhone / Safari**: botón compartir → *Añadir a pantalla de inicio*.

El service worker necesita HTTPS (o `localhost`), por eso esta opción es la única que deja la
app instalada y funcionando sin internet.

## Cómo se usa

Arriba eliges **Cash** o **Torneo**; cada modo tiene sus pestañas. Lo capturado se conserva al
cambiar de modo.

**Cash** — `Entrada · Reparto · Recompra · Final · Resultado`
- *Entrada*: nombre, dinero y fichas con las que entra cada quien.
- *Reparto*: cuántas fichas de cada color darle a cada jugador (ver abajo).
- *Recompra*: recompras durante la partida.
- *Final*: conteo final de fichas, con el P/L en vivo.
- *Resultado*: total en la mesa, cuadre, ranking e imagen para WhatsApp.

`invertido = entrada + Σ recompras` · `valor final = Σ fichas × valor` · `P/L = final − invertido`

**Torneo** — `Torneo · Jugadores · Reparto · Resultado`
- *Torneo*: costo de entrada, recompra, add-on y los premios por lugar en % (con presets).
- *Jugadores*: recompras y add-ons por jugador, con la bolsa acumulada en vivo.
- *Resultado*: desglose de la bolsa, quién quedó en cada lugar, premio y neto por jugador.

`premio del lugar = bolsa × %` · `neto = premio − pagado` (los netos suman cero si los % suman 100)

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

## Datos y respaldo

Todo se guarda solo en `localStorage` en cada cambio. En **Guardar / Cargar datos** puedes
exportar un respaldo `.json`, importarlo en otro dispositivo, o empezar una sesión nueva.

## Estructura

```
src/
  store/
    types.ts          tipos del modelo de datos
    defaults.ts       colores, torneo y sesión por defecto
    session.ts        estado global (Zustand) + persistencia + reconciliación
  lib/
    distribution.ts   algoritmo de reparto de fichas
    money.ts          formato de $ y cálculos de cash/torneo
    shareImage.ts     imagen PNG en canvas + compartir/descargar
    backup.ts         export/import JSON y portapapeles
    __tests__/        tests de distribution y money
  components/         Chip, ChipsGrid, NumInput, MoneyInput, Stepper, Toast,
                      PlayerHeading, ColorsPanel, BackupPanel, ShareBlock
  screens/            una pantalla por pestaña (cash y torneo)
  App.tsx             encabezado, selector de modo, pestañas y armado
  index.css           tema de Tailwind (fieltro + dorado) y clases compartidas
public/               íconos de la PWA
```

Stack: Vite + React + TypeScript, Tailwind CSS v4, Zustand, `vite-plugin-pwa`, Vitest.
Sin backend, sin cuentas, sin analytics.
