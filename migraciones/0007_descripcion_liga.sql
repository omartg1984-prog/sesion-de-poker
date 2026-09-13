-- De qué va esta liga.
--
-- El nombre solo no dice gran cosa cuando alguien llega por una invitación: "Los
-- Domingos" no le cuenta si se juega cash o torneo, cada cuándo, ni de cuánto. Aquí cabe
-- eso en dos renglones, escrito por los de la casa.
--
-- En NULL quiere decir que nadie la ha escrito todavía; la app entonces no muestra nada
-- en vez de inventar un texto.
ALTER TABLE ligas ADD COLUMN descripcion TEXT;
