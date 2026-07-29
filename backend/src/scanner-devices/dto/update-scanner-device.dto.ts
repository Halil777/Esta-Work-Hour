import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateScannerDeviceDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  workerEntityId?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
