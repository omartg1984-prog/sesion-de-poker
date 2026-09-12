-- Las reglas de la casa, por liga.
--
-- JSON: [{ id, titulo, reglas: [texto, ...] }, ...]. Se guarda la lista completa y no
-- sólo lo que cambió respecto a un set original, porque la gracia es que cada liga
-- borre lo que no aplica y escriba lo suyo: al tercer cambio, el "original" ya no
-- describe a nadie.
--
-- En NULL quiere decir que esa liga todavía no abrió las reglas; la app le muestra el
-- set de arranque y lo guarda la primera vez que le mueven algo.
ALTER TABLE ligas ADD COLUMN reglas TEXT;
