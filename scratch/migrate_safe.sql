-- 1. Añade el nuevo rol a la enumeración existente sin reescribir la tabla
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- 2. Añade la columna de seguridad a Organizaciones por defecto FALSE
ALTER TABLE "Organization" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- 3. Añade la columna de bloqueo a Usuarios por defecto FALSE
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
