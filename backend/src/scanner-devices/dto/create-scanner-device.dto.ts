import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateScannerDeviceDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  workerEntityId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
