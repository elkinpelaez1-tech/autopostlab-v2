import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Debes proporcionar un correo electrónico válido' })
  email: string;
}
