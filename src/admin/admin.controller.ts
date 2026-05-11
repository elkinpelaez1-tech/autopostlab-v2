import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard) // 🛡️ DOBLE BLINDAJE: Autenticado + SuperAdmin Privileges
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getGlobalStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('companies')
  async getCompanies() {
    return this.adminService.getCompanies();
  }

  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }
}
