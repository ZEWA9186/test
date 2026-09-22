-- 1. Включаем dblink (без него ругается на function does not exist)
CREATE EXTENSION IF NOT EXISTS dblink;

-- 2. Переливаем данные чистым SQL-запросом
INSERT INTO code_entity (id, code, created_at)
SELECT id, code, created_at
FROM dblink(
             'host=host.docker.internal port=5432 dbname=db_test user=postgres password=123',
             'SELECT id, code, created_at FROM code_entity'
     ) AS t(id INT, code VARCHAR(255), created_at TIMESTAMP);

-- 3. Выравниваем сиквенс по фактическому максимуму ID
SELECT setval(
               pg_get_serial_sequence('code_entity', 'id'),
               COALESCE((SELECT MAX(id) FROM code_entity), 1),
               true
       );