import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Si no hay usuario, es una ruta pública (no pasó por JwtAuthGuard)
    if (!user) {
      return true;
    }

    // Si hay usuario autenticado, DEBE tener organizationId
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to any organization. Tenant access blocked.');
    }

    // Agregar organizationId al request
    request.organizationId = user.organizationId;

    return true;
  }
}
