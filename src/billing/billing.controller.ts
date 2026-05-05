import { Controller, Post, Body, Headers, UseGuards, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout')
  createCheckout(
    @GetUser() user: any,
    @Body('organizationId') organizationId: string,
    @Body('plan') plan: string,
  ) {
    // Validar que el usuario pertenezca a la organización (opcional, para mayor seguridad)
    // Asumimos que el frontend envía su propia org ID
    return this.billingService.createCheckout(organizationId || user.organizationId, plan);
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
