import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const globalAdminEmail = process.env.GLOBAL_ADMIN_EMAIL;

    if (!user || !user.email) {
      throw new ForbiddenException('Usuario no identificado');
    }

    if (!globalAdminEmail || user.email.toLowerCase() !== globalAdminEmail.toLowerCase()) {
      throw new ForbiddenException('Acceso denegado. Se requiere nivel de administrador global.');
    }

    return true;
  }
}
