import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { SocialProvider, SocialAccountStatus } from '@prisma/client';

export class CreateSocialAccountDto {
  @IsEnum(SocialProvider)
  provider: SocialProvider;

  @IsString()
  providerAccountId: string; // requerido por Prisma

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsString()
  accessToken: string; // requerido por Prisma

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  accessTokenExpires?: Date;

  @IsOptional()
  @IsEnum(SocialAccountStatus)
  status?: SocialAccountStatus; // default: ACTIVE
}
