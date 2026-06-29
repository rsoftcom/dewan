# SPEC-25: Electronic Invoicing (Facturación Electrónica DIAN)

**Descripción:** Integración opcional, configurable por tenant, con un Proveedor Tecnológico (PTH) habilitado por la DIAN para la generación, transmisión y validación de facturas electrónicas de venta. Dewan **no genera XML, no firma digitalmente y no se habilita directamente ante la DIAN** — toda esa responsabilidad la asume el PTH vía su API. Dewan únicamente envía datos estructurados, recibe el resultado (CUFE, PDF, XML) y lo persiste.

**Actores:** `owner`, `admin` (configuración fiscal del tenant), `cashier`, `waiter` (disparan la generación de factura al completar un pedido, de forma transparente)

**Entidades:** `tenant_fiscal_config` (nueva), `invoice` (nueva), `customer` (modificada), `product` (modificada), `order` (modificada), `order_item` (modificada)

**Depende de:** SPEC-03-tenants, SPEC-05-products, SPEC-07-orders, SPEC-09-payments, SPEC-12-customers

**Decisión de diseño (D-XX):** La facturación electrónica es **opt-in por tenant**. Si `tenant_fiscal_config` no existe o `enabled = false`, el flujo de pedidos/pagos funciona exactamente igual que hoy, sin ningún paso ni validación adicional. Ningún tenant que no factura ve cambios en su experiencia ni en sus datos.

-----

## 1. Cambios de esquema

### 1.1 Nueva entidad: `tenant_fiscal_config`

Relación 1:1 opcional con `tenant`. Si no existe el registro, el tenant no factura electrónicamente.

| Columna | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | No | PK |
| `tenant_id` | UUID | No | FK → `tenant.id`, UNIQUE |
| `enabled` | boolean | No | Default `false`. Switch maestro |
| `nit` | VARCHAR(15) | Sí | Solo el número, **sin** DV (ej: `800012345`) |
| `dv` | VARCHAR(1) | Sí | Dígito de verificación, calculado por backend vía algoritmo módulo 11 |
| `legal_name` | VARCHAR(150) | Sí | Razón social legal (puede diferir de `tenant.name`) |
| `tax_regime` | ENUM | Sí | `responsable_iva`, `no_responsable_iva`, `gran_contribuyente` — confirmar valores exactos contra el PTH elegido |
| `fiscal_address` | VARCHAR(255) | Sí | |
| `fiscal_city` | VARCHAR(100) | Sí | |
| `fiscal_department` | VARCHAR(100) | Sí | |
| `pth_provider` | ENUM | Sí | `factus`, `siigo`, `alegra` (ajustar a proveedor elegido) |
| `pth_credentials` | TEXT | Sí | API key/token del PTH, **encriptado en reposo** (no en texto plano) |
| `dian_status` | ENUM | No | `not_configured`, `testing`, `enabled`. Default `not_configured` |
| `default_consumer_final` | boolean | No | Default `true`. Permite facturar a "consumidor final" en ventas de mostrador sin pedir documento |
| `created_at` / `updated_at` | TIMESTAMPTZ | No | |

**Reglas:**
- `enabled = true` solo puede activarse si `nit`, `dv`, `legal_name`, `tax_regime` y `pth_credentials` están completos. Validar en el servicio antes de permitir el toggle.
- El cálculo de `dv` se hace en backend a partir de `nit` (algoritmo módulo 11 DIAN), nunca se recibe del cliente como input editable.

### 1.2 Nueva entidad: `invoice`

Documento fiscal resultante, distinto del `order` operativo. Una orden puede tener una factura (o varias si hay notas crédito/débito asociadas — fuera de alcance de este spec, ver sección 5).

| Columna | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | No | PK |
| `tenant_id` | UUID | No | FK → `tenant.id` |
| `order_id` | UUID | No | FK → `order.id` |
| `cufe` | VARCHAR(100) | Sí | Asignado por la DIAN vía el PTH al validar |
| `invoice_number` | VARCHAR(50) | Sí | Consecutivo asignado por el PTH |
| `pdf_url` | TEXT | Sí | URL o referencia al PDF entregado por el PTH |
| `xml_url` | TEXT | Sí | URL o referencia al XML firmado |
| `dian_status` | ENUM | No | `pending`, `validated`, `rejected`. Default `pending` |
| `rejection_reason` | TEXT | Sí | Motivo si `dian_status = rejected` |
| `pth_response_raw` | JSONB | Sí | Respuesta completa del PTH, para auditoría/debug |
| `issued_at` | TIMESTAMPTZ | Sí | Fecha de emisión confirmada por el PTH |
| `created_at` / `updated_at` | TIMESTAMPTZ | No | |

**Índices:** `(tenant_id)`, `(order_id)`, `(dian_status, tenant_id)` para reintentos/monitoreo.

### 1.3 Modificaciones a `customer`

| Columna nueva | Tipo | Nullable | Notas |
|---|---|---|---|
| `document_type` | ENUM | Sí | `cc`, `nit`, `ce`, `passport` — confirmar set exacto contra el PTH |
| `document_number` | VARCHAR(20) | Sí | |

**Regla:** Estos campos son opcionales a nivel de esquema (el customer existe igual aunque el tenant no facture), pero **obligatorios a nivel de servicio** si se va a generar una factura para ese pedido y `default_consumer_final = false`.

### 1.4 Modificaciones a `product`

| Columna nueva | Tipo | Nullable | Notas |
|---|---|---|---|
| `tax_type` | ENUM | Sí | `iva`, `inc`, `excluded`. Default `excluded` para no afectar productos existentes |
| `tax_rate` | DECIMAL(5,2) | Sí | Default `0`. Ej: `19.00`, `5.00` |

### 1.5 Modificaciones a `order_item`

| Columna nueva | Tipo | Nullable | Notas |
|---|---|---|---|
| `tax_rate_applied` | DECIMAL(5,2) | Sí | Snapshot al momento de la venta, igual criterio que `unit_price` |
| `tax_amount` | DECIMAL(12,2) | Sí | Default `0` |

### 1.6 Modificaciones a `order`

| Columna nueva | Tipo | Nullable | Notas |
|---|---|---|---|
| `subtotal` | DECIMAL(12,2) | No | Default `0`. Suma de `order_item.subtotal` antes de impuestos |
| `tax_total` | DECIMAL(12,2) | No | Default `0`. Suma de `order_item.tax_amount` |

**Regla:** Para tenants con `enabled = false`, `tax_total` siempre es `0` y `subtotal = total`. No hay cambio de comportamiento visible.

-----

## 2. Casos de uso

## UC-25-01: Configurar datos fiscales del tenant

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor navega a Configuración → Facturación Electrónica.
1. Completa `nit`, `legal_name`, `tax_regime`, `fiscal_address`, `fiscal_city`, `fiscal_department`, `pth_provider`, `pth_credentials`.
1. Backend calcula `dv` automáticamente a partir de `nit` (algoritmo módulo 11).
1. Sistema valida las credenciales del PTH (llamada de prueba a su API, ej. endpoint de "health check" o "company info").
1. Si la validación es exitosa, guarda el registro con `dian_status = testing`.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | `nit` inválido (no numérico o longitud incorrecta) | `400` — "NIT inválido." |
| E02 | Credenciales del PTH rechazadas en la validación | `422` — "No se pudo validar la conexión con el proveedor. Verifica las credenciales." |
| E03 | Intento de `enabled = true` sin campos obligatorios completos | `400` — "Completa todos los datos fiscales antes de activar la facturación." |

**Contrato API:**

`POST /api/v1/tenant-fiscal-config`

Request:
```json
{
  "nit": "800012345",
  "legal_name": "Restaurante El Buen Sabor SAS",
  "tax_regime": "responsable_iva",
  "fiscal_address": "Calle 10 # 20-30",
  "fiscal_city": "Medellín",
  "fiscal_department": "Antioquia",
  "pth_provider": "factus",
  "pth_credentials": "..."
}
```

Response 201:
```json
{
  "id": "uuid",
  "nit": "800012345",
  "dv": "1",
  "dian_status": "testing",
  "enabled": false
}
```

-----

## UC-25-02: Activar/desactivar facturación electrónica

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /tenant-fiscal-config/toggle` con `{ "enabled": true }`.
1. Sistema valida que todos los campos obligatorios estén completos (ver E03 arriba).
1. Actualiza `enabled`. Registra `update` en `audit_log` con metadata del cambio.

**Contrato API:**

`PATCH /api/v1/tenant-fiscal-config/toggle`

Request: `{ "enabled": true }`

Response 200: Config actualizada.

-----

## UC-25-03: Asignar impuesto a un producto

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor edita un producto (extiende UC-05-XX existente, no es endpoint nuevo).
1. Envía `tax_type` y `tax_rate` junto con los demás campos del producto.
1. Sistema guarda. Si el tenant no tiene facturación habilitada, estos campos se guardan igual pero no afectan ningún cálculo visible al usuario.

**Nota de implementación:** Este UC modifica `PATCH /products/:id` y `POST /products` existentes — no crea endpoints nuevos. Solo agrega los dos campos al DTO.

-----

## UC-25-04: Generar factura electrónica al completar un pedido

**Actor:** Sistema (disparado automáticamente)
**Roles permitidos:** N/A — proceso interno

**Flujo principal:**

1. Un `order` transiciona a `status = completed` (o `paid`, según se defina) y el `tenant_fiscal_config.enabled = true`.
1. Sistema verifica si el `order` tiene `customer_id`. Si no lo tiene (pedido local sin cliente) y `default_consumer_final = true`, usa los datos de "consumidor final" genéricos.
1. Sistema construye el payload con: datos del emisor (`tenant_fiscal_config`), datos del adquiriente (`customer` o consumidor final), items (`order_item` con impuestos), totales (`subtotal`, `tax_total`, `order.total`).
1. Llama a la API del PTH para generar y transmitir la factura.
1. Crea el registro `invoice` con el resultado (`cufe`, `invoice_number`, `pdf_url`, `xml_url`, `dian_status`).
1. Si el PTH responde con error de validación DIAN, marca `invoice.dian_status = rejected` y `rejection_reason`, y notifica al `owner`/`admin` (extiende SPEC-18-notifications).

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Cliente sin `document_number` y `default_consumer_final = false` | No se completa el pedido hasta capturar el documento, o se bloquea la generación de factura y se notifica al usuario para completarla manualmente después |
| E02 | PTH no disponible (timeout, 5xx) | `invoice.dian_status = pending`. Sistema reintenta (job en background, no bloquea el flujo del pedido) |
| E03 | DIAN rechaza la factura | `invoice.dian_status = rejected`. El pedido **no se revierte** — la venta ya ocurrió; se notifica para corrección manual o reintento con nuevo consecutivo |

**Nota de implementación crítica:** Este proceso **no debe bloquear el flujo de cierre del pedido**. La generación de la factura debe ser asíncrona (cola/job) respecto al cierre del `order`, porque la DIAN exige transmisión el mismo día pero no en el mismo milisegundo que el cobro — un fallo del PTH no puede impedir que el cajero cobre y cierre la mesa.

**Contrato API (interno, no expuesto directamente):**

Payload conceptual enviado al PTH (la forma exacta depende del proveedor elegido):
```json
{
  "issuer": { "nit": "800012345", "dv": "1", "legal_name": "..." },
  "customer": { "document_type": "cc", "document_number": "123456", "name": "..." },
  "items": [
    { "name": "Hamburguesa", "quantity": 2, "unit_price": 15000, "tax_rate": 19, "tax_amount": 5700 }
  ],
  "subtotal": 30000,
  "tax_total": 5700,
  "total": 35700
}
```

-----

## UC-25-05: Consultar estado/descargar factura de un pedido

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Flujo principal:**

1. Actor envía `GET /orders/:id/invoice`.
1. Sistema retorna el registro `invoice` asociado, incluyendo `pdf_url` para descarga/envío al cliente.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | El pedido no tiene factura generada (tenant no facturaba al momento, o aún pendiente) | `404` — "No hay factura electrónica para este pedido." |

**Contrato API:**

`GET /api/v1/orders/:id/invoice`

Response 200:
```json
{
  "cufe": "...",
  "invoice_number": "FE-1023",
  "pdf_url": "https://...",
  "dian_status": "validated",
  "issued_at": "2026-06-28T10:00:00Z"
}
```

-----

## 3. Criterios de aceptación globales

```gherkin
Scenario: Tenant sin facturación habilitada no se ve afectado
  Given un tenant sin registro en tenant_fiscal_config
  When se crea y completa un pedido normalmente
  Then el pedido se completa exactamente igual que antes de este spec
  And no se crea ningún registro en invoice

Scenario: Tenant con facturación habilitada genera factura automáticamente
  Given un tenant con tenant_fiscal_config.enabled = true y configuración completa
  When un pedido transiciona a completed
  Then se dispara la generación de factura vía el PTH configurado
  And se crea un registro invoice con el resultado

Scenario: Rechazo de DIAN no revierte la venta
  Given una factura que el PTH reporta como rechazada por la DIAN
  When se recibe la respuesta de rechazo
  Then el order permanece en estado completed
  And el invoice queda en dian_status = rejected con motivo
  And se notifica al owner/admin del tenant
```

-----

## 4. Fuera de alcance de este spec (fase futura)

| Funcionalidad | Notas |
|---|---|
| Notas crédito/débito | Requiere entidad propia que referencie la `invoice` original |
| Documento soporte en adquisiciones | Para compras a `supplier` no facturador (relacionado con SPEC-15) |
| Selección/cambio de PTH en caliente | Este spec asume un único `pth_provider` por tenant a la vez |
| UNSPSC por producto | Agregar solo si el PTH elegido lo exige — confirmar contra su documentación antes de implementar |
| Reportes fiscales (IVA generado, etc.) | Extiende SPEC-17-reports en fase posterior |

-----

## 5. Notas de UI (pantalla de configuración fiscal)

> Estas notas documentan decisiones de UI ya tomadas para este módulo específico. No reemplazan `dewan-design-system.md` — lo complementan donde hubo una decisión puntual que no se debe reinterpretar distinto al implementar.

- **Campo NIT-DV:** usar `p-inputgroup` con un input para el NIT y un `p-inputgroupaddon` mostrando `-` como separador fijo entre ambos, seguido de un segundo input de máx. 1 carácter para el DV. El usuario nunca escribe el guion.
- **DV autocalculado:** el campo DV es `readonly`. Se recalcula en el frontend (o se solicita al backend) cada vez que el campo NIT cambia, usando el algoritmo módulo 11 de la DIAN. El usuario nunca lo edita manualmente — esto evita que digite un DV que no corresponde al NIT.
- **Switch `enabled` con guarda:** el toggle de "Activar facturación electrónica" debe estar deshabilitado (con tooltip explicando qué falta) mientras `nit`, `dv`, `legal_name`, `tax_regime` y `pth_credentials` no estén completos. No permitir el intento y mostrar el error recién al fallar — la validación es visual y previa.
- **Ubicación en la navegación:** la sección "Facturación Electrónica" vive como un tab o acordeón separado dentro de Configuración del tenant, **no mezclada** con los datos generales del negocio (nombre, logo, dirección comercial). Son dos dominios distintos: identidad comercial vs. identidad fiscal.
- **Indicador de estado:** mostrar `dian_status` (`not_configured` / `testing` / `enabled`) como un Tag de PrimeNG con color semántico (gris / amarillo / verde), visible en la cabecera de la sección, no solo en un campo de formulario.
- **Pantalla de pedido completado:** si `tenant_fiscal_config.enabled = true`, mostrar en el detalle del `order` un bloque con el estado de la factura (`pending` / `validated` / `rejected`) y, si `validated`, un botón para descargar/reenviar el PDF (`invoice.pdf_url`). Si `enabled = false`, este bloque no se renderiza — no hay estado intermedio visible para tenants que no facturan.

-----

## 6. Pendiente de decisión antes de implementar

1. **PTH elegido** (Factus / Siigo / Alegra / otro) — define la forma exacta del payload, autenticación y campos obligatorios reales. Este spec usa una forma genérica que debe ajustarse al elegir proveedor.
2. **Valores exactos de `tax_regime`** según lo que el PTH espera en su API.
3. **Trigger exacto de facturación**: ¿al pasar a `paid`, a `completed`, o un botón manual "Facturar" separado del cierre del pedido?
4. **Manejo de reintentos**: ¿cuántos intentos automáticos antes de requerir intervención manual?