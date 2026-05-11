import { Controller, Post, Body, Headers, UseGuards, Req, Get } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('metrics')
  getMetrics() {
    return this.billingService.getMetrics();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('subscriptions')
  getSubscriptions() {
    return this.billingService.getSubscriptions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  getNotifications(@GetUser() user: any) {
    return this.billingService.getNotifications(user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout')
  createCheckout(
    @GetUser() user: any,
    @Body('plan') plan: string,
  ) {
    // 🔒 BLINDAJE SEGURIDAD: Forzamos que el pago SIEMPRE se asocie a la organización real del token.
    // Ignoramos cualquier parameter de organizationId que pudiera venir en el Body para prevenir spoofing.
    const organizationId = user.organizationId; 
    
    return this.billingService.createCheckout(organizationId, plan);
  }

  // Webhook es público, Wompi lo consume
  @Post('webhook')
  handleWebhook(
    @Body() body: any,
    @Headers('x-event-checksum') signature: string, // Si Wompi usa otro header para eventos (puede variar)
  ) {
    return this.billingService.handleWebhook(body, signature);
  }
}
