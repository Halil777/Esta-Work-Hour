import { IsString, IsNotEmpty, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  adminUsername: string;

  @IsString()
  @MinLength(6)
  adminPassword: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
