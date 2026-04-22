import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // -------------------------------------------------------
  // 🔐 LOGIN
  // -------------------------------------------------------
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // -------------------------------------------------------
  // 🌟 GOOGLE LOGIN (PASO 4)
  // -------------------------------------------------------
  @Post('google')
  loginWithGoogle(@Body() body: { token: string }) {
    return this.authService.loginWithGoogle(body.token);
  }

  // -------------------------------------------------------
  // 🔄 REFRESH TOKEN
  // -------------------------------------------------------
  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  // -------------------------------------------------------
  // 🔴 LOGOUT (SE NECESITA ESTAR LOGUEADO)
  // -------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }
}
