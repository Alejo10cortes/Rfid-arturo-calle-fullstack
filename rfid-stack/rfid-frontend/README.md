# 🎨 Arturo Calle — RFID Frontend

Interfaz web para el sistema de inventario RFID UHF. **React 18 + TypeScript + Vite + Tailwind CSS**.

## Diseño

**Luxury Industrial Dark** — tipografías editoriales sobre fondo casi negro con acentos dorados.

| Tipografía        | Uso                           |
|-------------------|-------------------------------|
| Cormorant Garamond | Títulos, números grandes (display) |
| Syne               | UI, botones, navegación        |
| JetBrains Mono     | Datos técnicos, EPC, timestamps |

Paleta: `#0c0c0e` (ink) · `#c9a84c` (gold) · `#f5f0e8` (cream)

## Páginas

| Ruta         | Página           | Descripción                                      |
|--------------|------------------|--------------------------------------------------|
| `/login`     | Login            | Autenticación JWT con roles                      |
| `/`          | Dashboard        | KPIs, gráfico 24h, heatmap, feed live, lectoras  |
| `/readers`   | Lectoras         | CRUD, estado LLRP, reinicio, estadísticas        |
| `/inventory` | Inventario       | Productos en grid con stock real (tags RFID)     |
| `/scans`     | Escaneos         | Feed live WebSocket + historial filtrable        |
| `/alerts`    | Alertas          | Resolución de alertas por tipo y severidad       |
| `/reports`   | Reportes         | Exportar CSV / PDF de scans e inventario         |
| `/settings`  | Configuración    | Perfil, cambio de contraseña, estado del sistema |

## Stack

- **React 18** + **TypeScript 5**
- **Vite 5** — dev server con proxy al backend
- **Tailwind CSS 3** — design tokens personalizados
- **React Router 6** — rutas con guards de autenticación
- **Zustand** — estado global (auth + realtime + UI)
- **Socket.io-client** — WebSocket para tiempo real
- **Recharts** — gráficos de barras y estadísticas
- **Axios** — cliente HTTP con interceptores y auto-refresh

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno (opcional — por defecto usa proxy Vite)
cp .env.example .env.local

# 3. Levantar backend primero
cd ../rfid-backend && npm run dev

# 4. Dev server
npm run dev
# → http://localhost:5173
```

## Variables de entorno

```env
VITE_API_URL=          # vacío = usa proxy Vite /api → localhost:3000
VITE_WS_URL=           # vacío = mismo origen
```

## Build de producción

```bash
npm run build          # genera dist/
npm run preview        # previsualizar build
```

## Docker (con backend)

```bash
# Desde la raíz del proyecto
docker-compose -f rfid-frontend/docker-compose.fullstack.yml up -d
```

Frontend en `http://localhost` · API en `http://localhost:3000`

## Credenciales de prueba

| Rol      | Email                          | Contraseña    |
|----------|--------------------------------|---------------|
| Admin    | admin@arturocalle.com          | Admin@1234    |
| Operator | operador@arturocalle.com       | Operator@1234 |
