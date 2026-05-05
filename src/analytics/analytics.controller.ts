import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(@Request() req) {
    const workspaceId = req.user.workspaceId;
    const organizationId = req.organizationId;
    return this.analyticsService.getSummary(workspaceId, organizationId);
  }

  @Get('ai-report')
  async getAiReport(@Request() req) {
    const workspaceId = req.user.workspaceId;
    const organizationId = req.organizationId;
    return this.analyticsService.getAiReport(workspaceId, organizationId);
  }
}
