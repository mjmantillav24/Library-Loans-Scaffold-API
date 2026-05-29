# Library Loans API

REST API para gestión de préstamos de biblioteca. Construida con **NestJS 10**, **TypeORM**, **PostgreSQL 16** y autenticación **JWT**.

---

## Arranque completo

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Levantar base de datos (limpio)
docker compose down -v && docker compose up -d

# 3. Instalar dependencias
npm install

# 4. Aplicar migraciones
npm run migration:run

# 5. Arrancar en modo desarrollo
npm run start:dev
```

La app queda disponible en `http://localhost:3000`.  
Swagger UI: `http://localhost:3000/api/docs`

---

## Credenciales de prueba

No hay script de seed. Crea un usuario mediante la API:

```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@library.com",
    "password": "Admin1234",
    "firstName": "Admin",
    "lastName": "Library"
  }'
```

La respuesta incluye `accessToken` y `refreshToken`:
```json
{
  "accessToken": "<jwt-de-15m>",
  "refreshToken": "<jwt-de-7d>",
  "user": { "id": "...", "email": "admin@library.com", "role": "member", ... }
}
```

Usa `Authorization: Bearer <accessToken>` para los endpoints protegidos.

```bash
# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@library.com", "password": "Admin1234" }'

# 3. Renovar access token (cuando expire a los 15m)
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<tu-refresh-token>" }'

# 4. Cerrar sesión (revoca el refresh token)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-access-token>" \
  -d '{ "refreshToken": "<tu-refresh-token>" }'
```

> Para cambiar el rol de un usuario a `admin` o `librarian`, actualízalo directamente en la BD:
> ```sql
> UPDATE users SET role = 'admin' WHERE email = 'admin@library.com';
> ```

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Arranca con hot reload |
| `npm run start:prod` | Arranca el build de producción (requiere `npm run build`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm test` | Tests unitarios |
| `npm run test:cov` | Tests con reporte de cobertura |
| `npm run migration:run` | Aplica migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |
| `npm run migration:generate src/database/migrations/Nombre` | Genera migración desde diff de entidades |
| `npm run lint` | ESLint con autofix |
| `npm run format` | Prettier |

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable | Descripción | Default |
|---|---|---|
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5434` |
| `DB_USER` | Usuario de BD | `loans` |
| `DB_PASSWORD` | Contraseña de BD | `loans` |
| `DB_NAME` | Nombre de la BD | `loans` |
| `JWT_ACCESS_SECRET` | Secreto JWT (≥ 32 chars) | — |
| `JWT_ACCESS_EXPIRES_IN` | Expiración del access token | `15m` |
| `BCRYPT_SALT_ROUNDS` | Rondas de bcrypt | `10` |
| `MAX_ACTIVE_LOANS` | Máx. préstamos activos por usuario | `3` |
| `DAILY_FINE_RATE` | Multa diaria por mora (USD) | `0.50` |
| `MAX_LOAN_DAYS` | Máx. días de duración de un préstamo | `30` |

---

## Endpoints

### Auth
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Registrar usuario | Público |
| POST | `/api/auth/login` | Login | Público |
| POST | `/api/auth/refresh` | Renovar access token con refresh token | Público |
| POST | `/api/auth/logout` | Revocar refresh token | JWT |
| GET | `/api/auth/me` | Perfil del usuario autenticado | JWT |

### Items
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/items` | Crear ítem | JWT |
| GET | `/api/items?type=` | Listar ítems (filtro opcional por tipo) | JWT |
| GET | `/api/items/:id` | Obtener ítem por ID | JWT |
| PATCH | `/api/items/:id` | Actualizar título o tipo | JWT |
| DELETE | `/api/items/:id` | Soft delete (204) | JWT |

### Loans
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/loans` | Crear préstamo | JWT |
| GET | `/api/loans?userId=&itemId=&status=` | Listar préstamos con filtros | JWT |
| GET | `/api/loans/:id` | Obtener préstamo por ID | JWT |
| PATCH | `/api/loans/:id/return` | Registrar devolución y calcular multa | JWT |
| PATCH | `/api/loans/:id/mark-lost` | Marcar préstamo como perdido | JWT |

---

## Reglas de negocio

| Regla | Descripción |
|---|---|
| R1 | `dueAt` debe ser mayor que `loanedAt` y la ventana máxima es `MAX_LOAN_DAYS` días → 400 si no cumple |
| R2 | Un ítem con préstamo `active` u `overdue` no puede prestarse → 409 con el `loanId` bloqueante |
| R3 | Un usuario con ≥ `MAX_ACTIVE_LOANS` préstamos `active`/`overdue` no puede tomar más → 409 |
| R4 | Al devolver: `fineAmount = daysOverdue × DAILY_FINE_RATE`, donde `daysOverdue = max(0, ceil((returnedAt − dueAt) / 1 día))` |
| R5 | `returned` y `lost` son estados terminales. Intentar devolver o perder desde esos estados → 400 |

### Máquina de estados de préstamos (FSM)

```
active ──→ returned (terminal)
active ──→ lost     (terminal)
active ──→ overdue
overdue ──→ returned (terminal)
overdue ──→ lost     (terminal)
```

---

## Decisión: transición automática a `overdue`

**No se implementó transición automática.**

Los préstamos que superan su `dueAt` **no cambian de estado automáticamente** a `overdue`. El estado `overdue` existe en la FSM y puede asignarse manualmente, pero no hay un cron job ni scheduler que lo haga en background.

**Razón:** Implementar un job recurrente requeriría un módulo adicional (p. ej. `@nestjs/schedule`) fuera del alcance del examen parcial, y añadiría complejidad en los tests. La decisión de diseño es que el sistema detecta mora al momento de la devolución (R4 calcula la multa independientemente del estado) y que un operador con rol `librarian` o `admin` puede marcar manualmente los préstamos vencidos.

---

## Bonos implementados

| Bono | Descripción |
|---|---|
| **B2 — Refresh tokens stateful (+5%)** | Entidad `RefreshToken` persistida en BD. Login/register devuelven `{ accessToken, refreshToken }`. `POST /auth/refresh` valida firma + lookup en BD (existencia, no revocado, no expirado). `POST /auth/logout` marca `revokedAt = now()`. Secretos independientes `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. |
| **B3 — Pipeline GitHub Actions (+4% +1%)** | `.github/workflows/ci.yml` ejecuta en push y PR a main: checkout, Node 20, `npm ci`, lint, tests unitarios con Postgres efímero. Incluye `docker build` para el +1% adicional. |

---

## Estructura del proyecto

```
src/
├── main.ts                        # Bootstrap: ValidationPipe global + Swagger + prefijo /api
├── app.module.ts                  # ConfigModule + TypeOrmModule + módulos + guards globales
├── config/
│   ├── configuration.ts           # Factory de configuración tipada
│   └── validation.schema.ts       # Validación Joi de variables de entorno al arranque
├── database/
│   ├── data-source.ts             # DataSource para CLI de TypeORM
│   └── migrations/
│       └── 1715000000000-initial-schema.ts
├── common/
│   ├── decorators/
│   │   └── public.decorator.ts    # @Public() — omite JwtAuthGuard
│   └── guards/
│       └── jwt-auth.guard.ts      # Guard global con soporte a @Public()
└── modules/
    ├── auth/                      # Entidad User, register, login, JWT strategy
    ├── items/                     # CRUD de ítems con soft delete
    └── loans/                     # Préstamos con reglas R1–R5 y FSM
```
