# Credenciales

Cuentas demo del backend y variables sensibles que hay que configurar para
levantar el proyecto. Las cuentas demo son de desarrollo: no tienen datos
reales.

---

## Cuentas demo

Las seedea `wh-backend` con `SEED_DEMO=true` contra una base de datos vacía
(detalle en `wh-backend/docs/demo-credentials.md`).

Contraseña compartida de todas las cuentas demo: **`Demo1234!`**

| Email | Rol | Nombre |
| --- | --- | --- |
| `admin@smartwarehouse.local` | SUPERADMIN | System Admin |
| `system@smartwarehouse.local` | ADMIN_SYSTEM | Sofía Martínez |
| `warehouse@smartwarehouse.local` | ADMIN_WAREHOUSE | Diego Fernández |
| `sales@smartwarehouse.local` | ADMIN_SALES | Valentina Rodríguez |
| `provider1@smartwarehouse.local` | PROVIDER | Distribuidora del Sur S.A. |
| `provider2@smartwarehouse.local` | PROVIDER | Importadora Andina Ltda. |
| `dispatcher1@smartwarehouse.local` | DISPATCHER | Lucas Pérez |
| `dispatcher2@smartwarehouse.local` | DISPATCHER | Martín Gómez |
| `operator1@smartwarehouse.local` | OPERATOR | Camila Suárez |
| `operator2@smartwarehouse.local` | OPERATOR | Bruno Castro |
| `operator3@smartwarehouse.local` | OPERATOR | Lucía Méndez |
| `operator4@smartwarehouse.local` | OPERATOR | Joaquín Silva |
| `operator5@smartwarehouse.local` | OPERATOR | Florencia Díaz |

Para que el SUPERADMIN coincida con la tabla, levantar el backend con:

```bash
ADMIN_EMAIL=admin@smartwarehouse.local ADMIN_PASSWORD=Demo1234! SEED_DEMO=true make up-dev
```

`SEED_DEMO` solo corre sobre una base vacía. Para volver a sembrar hay que
borrar la base (`make down` y borrar `data/`) y levantar de nuevo.

---

## Variables sensibles del backend

Los valores reales no van en el repo. Se cargan en `wh-backend/.env`, que se
copia de `.env.example`.

| Variable | Para qué |
| --- | --- |
| `JWT_SECRET` | Firma de tokens (mínimo 32 caracteres). El servicio de sugerencias usa el mismo valor. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usuario SUPERADMIN creado en el primer arranque. |
| `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD` | Solo producción. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Almacenamiento de imágenes. En dev vienen con `minioadmin` por defecto. |
| `INFRA_API_KEY` | Secreto compartido entre el backend (`/infra/**`) y el bridge. Se genera con `make infra-key`. |
| `INFRA_AMQP_URL` | Conexión AMQP de RabbitMQ (puerto 5672). |

---

## Frontend

No usa credenciales. Solo necesita que el backend responda en
`http://localhost:8080`; el proxy de Vite lo reenvía desde `/auth`,
`/products`, etc.
