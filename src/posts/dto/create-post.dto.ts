import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  accountIds: string[];

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  title?: string;
  
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;

  @IsOptional()
  @IsString({ each: true })
  fileIds?: string[];
}
