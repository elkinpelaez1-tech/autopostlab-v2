import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Sesión no autenticada.');
    }

    // Verificación quirúrgica estricta del rol superior
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acceso denegado: Privilegios de Super Admin requeridos.');
    }

    return true;
  }
}
