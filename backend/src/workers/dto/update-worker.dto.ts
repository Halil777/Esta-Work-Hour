import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { WorkerStatus, QrStatus, MobileRole } from '../worker.entity';

export class UpdateWorkerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  brigadeId?: string;

  @IsOptional()
  @IsString()
  brigadeName?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  zoneName?: string;

  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsEnum(QrStatus)
  qrStatus?: QrStatus;

  @IsOptional()
  @IsString()
  mesaiSistemi?: string;

  @IsOptional()
  @IsString()
  foremanId?: string | null;

  @IsOptional()
  @IsString()
  brigadirId?: string | null;

  @IsOptional()
  @IsEnum(MobileRole)
  mobileRole?: MobileRole;

  @IsOptional()
  @IsNumber()
  extraSaat?: number;

  @IsOptional()
  @IsString()
  nfcCardUid?: string | null;

  @IsOptional()
  @IsString()
  shift?: 'day' | 'night' | null;
}
