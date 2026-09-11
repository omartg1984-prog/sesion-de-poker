-- Esquema inicial: usuarios, ligas, partidas.
--
-- Notas de diseño:
--  * Los IDs son UUID generados en el Worker, no autoincrementales, para no filtrar
--    cuántos usuarios o ligas hay.
--  * El PIN nunca se guarda: se guarda su hash PBKDF2 con sal propia de cada usuario.
--  * Las fechas van como texto ISO 8601 en UTC (SQLite no tiene tipo fecha).
--  * Los colores de ficha y las cantidades van como JSON porque son una lista corta
--    que siempre se lee completa y nunca se consulta por dentro.

CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY,
  -- en minúsculas y sin espacios; es lo que se teclea para entrar
  usuario       TEXT NOT NULL UNIQUE,
  -- como se muestra en la app, con mayúsculas y acentos si quiere
  nombre        TEXT NOT NULL,
  foto          TEXT,
  pin_hash      TEXT NOT NULL,
  pin_sal       TEXT NOT NULL,
  es_admin_app  INTEGER NOT NULL DEFAULT 0,
  -- defensa contra adivinar el PIN a fuerza bruta
  fallos        INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT,
  creado_en     TEXT NOT NULL
);

-- Se guarda el hash del token, no el token: si alguien lee la base, no puede
-- suplantar sesiones abiertas.
CREATE TABLE sesiones (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en   TEXT NOT NULL,
  expira_en   TEXT NOT NULL
);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_expira ON sesiones(expira_en);

CREATE TABLE ligas (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  -- código corto para invitar; sin caracteres que se confundan (O/0, I/1)
  codigo      TEXT NOT NULL UNIQUE,
  -- JSON: [{ key, label, color, value, inventory }]
  colores     TEXT NOT NULL,
  creada_por  TEXT NOT NULL REFERENCES usuarios(id),
  creada_en   TEXT NOT NULL
);

CREATE TABLE miembros (
  liga_id    TEXT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- admin de liga: puede crear partidas y cargar jugadores
  es_admin   INTEGER NOT NULL DEFAULT 0,
  entro_en   TEXT NOT NULL,
  PRIMARY KEY (liga_id, usuario_id)
);
CREATE INDEX idx_miembros_usuario ON miembros(usuario_id);

CREATE TABLE partidas (
  id          TEXT PRIMARY KEY,
  liga_id     TEXT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  fecha       TEXT NOT NULL,
  nombre      TEXT,
  -- 'cash' o 'torneo'; se elige al crearla y no cambia después
  tipo        TEXT NOT NULL DEFAULT 'cash',
  -- solo en torneo, JSON: { buyIn, rebuyPrice, addOnPrice, payouts: [{pct}] }
  torneo      TEXT,
  -- 'abierta' mientras se juega, 'cerrada' cuando ya se contaron las fichas
  estado      TEXT NOT NULL DEFAULT 'abierta',
  creada_por  TEXT NOT NULL REFERENCES usuarios(id),
  creada_en   TEXT NOT NULL
);
CREATE INDEX idx_partidas_liga ON partidas(liga_id, fecha DESC);

CREATE TABLE participaciones (
  id            TEXT PRIMARY KEY,
  partida_id    TEXT NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  usuario_id    TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- dinero con el que entra a la mesa
  entrada       REAL NOT NULL DEFAULT 0,
  -- JSON: [{ dinero }]
  recompras     TEXT NOT NULL DEFAULT '[]',
  -- reparto de fichas; NULL = calculado automáticamente, con valor = editado a mano
  fichas_manual TEXT,
  -- conteo de fichas al final de la partida, JSON { colorKey: cantidad }
  fichas_final  TEXT NOT NULL DEFAULT '{}',
  -- solo en torneo
  rebuys        INTEGER NOT NULL DEFAULT 0,
  addons        INTEGER NOT NULL DEFAULT 0,
  -- lugar en el que quedó; 0 = sin asignar
  lugar         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (partida_id, usuario_id)
);
CREATE INDEX idx_participaciones_partida ON participaciones(partida_id);
