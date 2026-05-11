# Historial de Hotfixes SQL Manuales en Producción

Este documento registra las alteraciones ejecutadas directamente mediante `prisma db execute` debido a una desviación en la base de datos sombra que impedía la migración automatizada segura.

---

## Ejecución: 2026-05-11 11:18 AM (Fase Super Admin Init)

**Motivo:** Agregar soporte para el nuevo Rol administrativo y campos de seguridad global sin comprometer la data productiva ni generar reset de tablas.

**SQL Aplicado:**
```sql
-- 1. Añade el nuevo rol a la enumeración existente sin reescribir la tabla
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- 2. Añade la columna de seguridad a Organizaciones por defecto FALSE
ALTER TABLE "Organization" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- 3. Añade la columna de bloqueo a Usuarios por defecto FALSE
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
```

**Estado:** Aplicado Satisfactoriamente ✅
**Integridad Confirmada:** Validado mediante script `test_integrity.ts`.
