# 🏷️ Arturo Calle — RFID Backend

Backend completo para sistema de inventario RFID UHF (860–960 MHz) en Node.js + Express + TypeScript.

## Stack

| Capa           | Tecnología                          |
|----------------|-------------------------------------|
| Runtime        | Node.js 20 + TypeScript 5           |
| Framework      | Express 4                           |
| ORM            | Prisma 5 → MySQL 8                  |
| RFID Protocol  | LLRP sobre TCP/IP (ISO 15961)       |
| Tiempo real    | Socket.io 4 (WebSocket)             |
| Auth           | JWT (access 15m + refresh 7d)       |
| Logs           | Winston + rotación diaria           |
| Reportes       | PDFKit + csv-writer                 |
| Container      | Docker + docker-compose             |

---

## Estructura

```
src/
├── config/
│   ├── env.ts          # Variables de entorno con validación Zod
│   ├── database.ts     # Prisma client singleton
│   └── logger.ts       # Winston con rotación
├── services/
│   ├── auth.service.ts         # JWT, bcrypt, refresh tokens
│   ├── alert.service.ts        # Alertas + WebSocket
│   ├── report.service.ts       # CSV + PDF
│   └── rfid/
│       ├── llrp.service.ts     # 🔑 Driver LLRP real + simulador
│       └── rfid-manager.service.ts  # Orquestador de lectoras
├── controllers/        # Lógica de cada endpoint
├── middlewares/        # Auth, roles, errores
├── routes/             # Definición de rutas
├── websocket/          # Socket.io
└── types/              # Interfaces TypeScript
prisma/
├── schema.prisma       # Esquema completo MySQL
└── seed.ts             # Datos iniciales
```

---

## Inicio rápido

### 1. Clonar y configurar

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 2. Docker (recomendado)

```bash
# Levantar MySQL + API
docker-compose up -d

# Correr migraciones y seed
docker-compose exec api npx prisma migrate deploy
docker-compose exec api npm run db:seed

# Ver logs
docker-compose logs -f api
```

### 3. Local (desarrollo)

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

### API disponible en:
- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- Adminer (DB UI): `http://localhost:8080` (con `--profile tools`)

---

## Endpoints

### Auth
| Método | Ruta                            | Descripción              |
|--------|---------------------------------|--------------------------|
| POST   | `/api/v1/auth/login`            | Login → access + refresh |
| POST   | `/api/v1/auth/refresh`          | Rotar tokens             |
| POST   | `/api/v1/auth/logout`           | Revocar refresh          |
| GET    | `/api/v1/auth/me`               | Perfil del usuario 🔒    |
| PUT    | `/api/v1/auth/change-password`  | Cambiar contraseña 🔒    |

### Lectoras RFID
| Método | Ruta                          | Roles           |
|--------|-------------------------------|-----------------|
| GET    | `/api/v1/readers`             | ALL             |
| GET    | `/api/v1/readers/:id`         | ALL             |
| GET    | `/api/v1/readers/:id/stats`   | ALL             |
| POST   | `/api/v1/readers`             | ADMIN           |
| PUT    | `/api/v1/readers/:id`         | ADMIN           |
| DELETE | `/api/v1/readers/:id`         | ADMIN           |
| POST   | `/api/v1/readers/:id/restart` | ADMIN/OPERATOR  |

### Inventario
| Método | Ruta                         | Descripción           |
|--------|------------------------------|-----------------------|
| GET    | `/api/v1/products/overview`  | KPIs de inventario    |
| GET    | `/api/v1/products`           | Lista paginada        |
| POST   | `/api/v1/products`           | Crear producto        |
| GET    | `/api/v1/tags`               | Tags RFID             |
| GET    | `/api/v1/tags/:epc`          | Historial de un tag   |
| POST   | `/api/v1/tags/:epc/associate`| Asociar tag a producto|

### Scans, Alertas, Reportes
| Método | Ruta                         | Descripción         |
|--------|------------------------------|---------------------|
| GET    | `/api/v1/scans`              | Eventos de lectura  |
| GET    | `/api/v1/scans/stats`        | Estadísticas        |
| GET    | `/api/v1/alerts`             | Alertas del sistema |
| PUT    | `/api/v1/alerts/:id/resolve` | Resolver alerta     |
| GET    | `/api/v1/reports/scans`      | CSV/PDF de scans    |
| GET    | `/api/v1/reports/inventory`  | CSV/PDF de inventario|

---

## WebSocket

Conectar con token JWT:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer <accessToken>' }
});

// Recibir lecturas en tiempo real
socket.on('tag:detected', (data) => {
  // { epc, sku, productName, readerId, zone, rssi, tps, timestamp }
});

// Estado de lectoras
socket.on('reader:status', (data) => {
  // { readerId, status: 'ONLINE'|'OFFLINE'|'ERROR', zone }
});

// Alertas
socket.on('alert:new', (data) => {
  // { alertId, type, severity, title, message }
});

// Suscribirse a una zona específica
socket.emit('join:zone', 'Zone A');
```

---

## 🔌 Conectar lectoras físicas 860–960 MHz

El driver LLRP está en `src/services/rfid/llrp.service.ts`.

### Activar lectoras reales

```bash
# En .env
RFID_REAL_READERS=true
```

### Lectoras compatibles (LLRP TCP/IP puerto 5084)
- **Impinj**: R700, R420, R220, xArray
- **Zebra**: FX9600, FX7500, FX9500
- **Alien**: ALR-9900+, ALR-9800
- **ThingMagic**: M6, M6e (via Mercury API → LLRP bridge)

### Proceso de conexión
1. La lectora escucha en TCP puerto 5084 (estándar LLRP)
2. El backend hace TCP connect → envía `ENABLE_EVENTS_AND_REPORTS`
3. Envía `ADD_ROSPEC` con configuración EPC Gen2 (ISO 18000-63)
4. Envía `START_ROSPEC` → lectora empieza a enviar `RO_ACCESS_REPORT`
5. Cada reporte incluye: EPC, TID, RSSI, Phase Angle, Frecuencia (860–960 MHz)
6. El backend parsea los frames LLRP y emite eventos

### Registrar lectora real vía API
```bash
curl -X POST http://localhost:3000/api/v1/readers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":       "Reader-Almacen-1",
    "ipAddress":  "192.168.1.50",
    "port":        5084,
    "zone":       "Zone A",
    "location":   "Entrada principal",
    "model":      "Impinj R700",
    "txPower":    30,
    "rxSensitivity": -70
  }'
```

---

## Credenciales de prueba (seed)

| Rol      | Email                          | Contraseña       |
|----------|--------------------------------|------------------|
| Admin    | admin@arturocalle.com          | Admin@1234       |
| Operator | operador@arturocalle.com       | Operator@1234    |

---

## Variables de entorno clave

```env
RFID_REAL_READERS=false        # true = lectoras reales, false = simulador
RFID_RECONNECT_INTERVAL=5000   # ms entre reconexiones
RFID_HEARTBEAT_TIMEOUT=30000   # ms sin actividad → offline
LOW_STOCK_THRESHOLD=10         # unidades mínimas antes de alerta
```
