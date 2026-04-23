import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(@Request() req) {
    const workspaceId = req.user.workspaceId;
    return this.analyticsService.getSummary(workspaceId);
  }

  @Get('ai-report')
  async getAiReport(@Request() req) {
    const workspaceId = req.user.workspaceId;
    return this.analyticsService.getAiReport(workspaceId);
  }
}
