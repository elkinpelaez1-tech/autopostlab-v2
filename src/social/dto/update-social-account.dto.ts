import { PartialType } from '@nestjs/mapped-types';
import { CreateSocialAccountDto } from './create-social-account.dto';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { SocialProvider, SocialAccountStatus } from '@prisma/client';

export class UpdateSocialAccountDto extends PartialType(CreateSocialAccountDto) {
  @IsOptional()
  @IsEnum(SocialProvider)
  provider?: SocialProvider;

  @IsOptional()
  @IsString()
  providerAccountId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  accessTokenExpires?: Date;

  @IsOptional()
  @IsEnum(SocialAccountStatus)
  status?: SocialAccountStatus;
}
