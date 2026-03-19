# Arturo Calle — RFID Stack (Fullstack)

Sistema de inventario RFID 860–960 MHz con backend Node/Express, frontend React/Vite y base de datos MySQL, orquestados con Docker Compose.

---

## Arquitectura del stack

```
Browser ──► nginx :80 ──► /api/*       ──► rfid_api :3000  ──► MySQL :3306
                     └──► /socket.io/* ──► rfid_api :3000
                     └──► /*           ──► React SPA (index.html)
```

| Contenedor      | Imagen                      | Puerto host | Descripción                    |
|-----------------|-----------------------------|-------------|-------------------------------|
| `rfid_mysql`    | mysql:8.0                   | 3306        | Base de datos                  |
| `rfid_api`      | build: rfid-backend         | 3000        | REST API + WebSocket           |
| `rfid_frontend` | build: rfid-frontend/nginx  | 80          | SPA servida + proxy inverso    |
| `rfid_adminer`  | adminer:4 *(opcional)*      | 8080        | UI para inspeccionar la BD     |

---

## Requisitos

- Docker >= 24
- Docker Compose >= 2.20

---

## Levantar el stack

### 1. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env y cambiar los secretos JWT antes de producción
```

### 2. Construir e iniciar

```bash
docker-compose up -d --build
```

### 3. Seed de datos iniciales (primera vez)

```bash
docker-compose exec api npm run db:seed
```

Esto crea el usuario admin por defecto:
- **Email:** `admin@arturo-calle.com`
- **Password:** `Admin123!`

### 4. Verificar que todo esté sano

```bash
# Health check del API
curl http://localhost:3000/api/v1/health

# Logs
docker-compose logs -f api
docker-compose logs -f frontend
```

### 5. Abrir en el navegador

- **App:** http://localhost
- **API directo:** http://localhost:3000/api/v1/health
- **Adminer (BD):** `docker-compose --profile tools up -d adminer` → http://localhost:8080

---

## Desarrollo local (sin Docker)

### Backend

```bash
cd rfid-backend
cp .env.example .env          # ajustar DATABASE_URL al MySQL local o al de Docker
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```

### Frontend

```bash
cd rfid-frontend
cp .env.example .env.local    # dejar VITE_API_URL vacío para usar el proxy de Vite
npm install
npm run dev                   # http://localhost:5173
```

El `vite.config.ts` ya tiene el proxy configurado:
- `/api/*`       → `http://localhost:3000`
- `/socket.io/*` → `http://localhost:3000` (WebSocket)

---

## Variables de entorno clave

| Variable              | Descripción                                      | Default                  |
|-----------------------|--------------------------------------------------|--------------------------|
| `JWT_SECRET`          | Secreto de access token (≥32 chars)              | ⚠️ cambiar en producción |
| `JWT_REFRESH_SECRET`  | Secreto de refresh token (≥32 chars)             | ⚠️ cambiar en producción |
| `RFID_REAL_READERS`   | `false` = simulador · `true` = lectoras físicas  | `false`                  |
| `LOW_STOCK_THRESHOLD` | Umbral para alerta de stock bajo                 | `10`                     |
| `MYSQL_PASSWORD`      | Contraseña del usuario MySQL                     | `rfid_password`          |

---

## Flujo de autenticación (frontend ↔ backend)

```
POST /api/v1/auth/login  →  { accessToken, refreshToken }
     ↓
Axios interceptor guarda tokens en localStorage
     ↓
Cada request adjunta:  Authorization: Bearer <accessToken>
     ↓
Si 401 → POST /api/v1/auth/refresh → nuevo accessToken → reintenta
     ↓
WebSocket conecta con:  { auth: { token: "Bearer <accessToken>" } }
```

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `rfid_api` no arranca | MySQL todavía iniciando | Esperar el healthcheck; el `depends_on` lo gestiona |
| 502 Bad Gateway en `/api/` | `rfid_api` no está sano | `docker-compose logs api` |
| WebSocket no conecta | nginx sin header `Upgrade` | El `nginx.conf` incluido ya lo configura correctamente |
| `db:seed` falla | Migración pendiente | El CMD del Dockerfile ejecuta `prisma migrate deploy` automáticamente antes de `node dist/server.js` |

---

## Archivos modificados vs originales

| Archivo                                   | Cambio                                                              |
|-------------------------------------------|---------------------------------------------------------------------|
| `docker-compose.yml` *(nuevo)*            | Compose unificado que orquesta los 3 servicios + volúmenes nombrados |
| `.env.example` *(nuevo)*                  | Variables centralizadas para todo el stack                          |
| `rfid-frontend/nginx.conf`                | Añadidos `gzip_vary`, `proxy_http_version`, `X-Forwarded-*`, timeout WS |
| `rfid-frontend/docker-compose.fullstack.yml` *(original)* | Tenía bug: healthcheck en línea con `;` en vez de campos YAML — reemplazado por el nuevo `docker-compose.yml` |
