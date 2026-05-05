import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // El TenantGuard debe usarse SIEMPRE después del JwtAuthGuard.
    // Si no hay usuario, es un error de configuración del desarrollador.
    if (!user) {
      return true; // Dejamos pasar para no romper rutas públicas, pero no inyectamos nada.
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Acceso denegado: El usuario no tiene una organización vinculada.');
    }

    // Inyectamos el organizationId en el request para que los controladores lo usen.
    request.organizationId = user.organizationId;

    return true;
  }
}
