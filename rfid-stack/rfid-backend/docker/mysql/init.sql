-- docker/mysql/init.sql
-- Configuración inicial de MySQL para el sistema RFID

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Habilitar event scheduler para tareas programadas en DB
SET GLOBAL event_scheduler = ON;

-- Zona horaria Colombia (UTC-5)
SET GLOBAL time_zone = '-05:00';

-- Optimizaciones para carga alta de inserts (eventos RFID)
SET GLOBAL innodb_buffer_pool_size = 256 * 1024 * 1024;  -- 256 MB
SET GLOBAL innodb_log_file_size    = 64  * 1024 * 1024;  -- 64 MB

-- Permisos al usuario
GRANT ALL PRIVILEGES ON rfid_db.* TO 'rfid_user'@'%';
FLUSH PRIVILEGES;
