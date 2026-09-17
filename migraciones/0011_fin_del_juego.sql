-- A qué hora se dejó de jugar.
--
-- No es lo mismo que cerrar la partida. Se deja de repartir cartas a una hora y a partir
-- de ahí viene el cash out: contar fichas, cuadrar y pagarle a cada quien. Eso puede
-- llevarse media hora larga, y a veces la partida se cierra al día siguiente.
--
-- Guardar las dos por separado es lo único que hace que "cuánto jugamos" sea una cuenta
-- de verdad: de `arrancado_en` a `terminado_en`, no hasta que alguien se acordó de cerrar.
ALTER TABLE partidas ADD COLUMN terminado_en TEXT;
