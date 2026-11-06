-- Las temporadas de una liga.
--
-- Las reglas de la casa ya hablaban de temporada —"corre de julio a diciembre", "en
-- diciembre se cierra con posada y ahí se cobra el semestre"—, pero la tabla contaba
-- todas las noches desde que existe la liga. Esto parte el campeonato en semestres.
--
-- Una temporada es un rango de fechas, y cada noche cae en la suya sola por su fecha:
-- así no hay que etiquetar nada al crear la partida, y si una fecha salió mal se
-- arregla moviendo el rango en vez de tocando veinte noches. `hasta` en NULL es la
-- temporada que sigue corriendo.
--
-- Una liga sin temporadas se comporta igual que siempre: la tabla cuenta todo. El
-- corte empieza el día que se crea la primera, y eso lo decide cada liga.
CREATE TABLE temporadas (
  id        TEXT PRIMARY KEY,
  liga_id   TEXT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  -- 'YYYY-MM-DD', los dos extremos dentro de la temporada
  desde     TEXT NOT NULL,
  hasta     TEXT,
  creada_en TEXT NOT NULL
);

CREATE INDEX idx_temporadas_liga ON temporadas(liga_id, desde DESC);

-- La noche suelta que no entra al campeonato: el torneo de cumpleaños, la mano que se
-- jugó de más. Se cuenta igual su dinero en la partida, pero no suma puntos ni sale en
-- la tabla. Por defecto toda noche cuenta, que es lo que ha pasado siempre.
ALTER TABLE partidas ADD COLUMN cuenta_para_tabla INTEGER NOT NULL DEFAULT 1;
