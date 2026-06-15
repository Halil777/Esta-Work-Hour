import { IsString, IsOptional, IsEnum } from 'class-validator';
import { WorkerStatus, QrStatus } from '../worker.entity';

export class CreateWorkerDto {
  @IsOptional()
  @IsString()
  workerId?: string;

  @IsString()
  name: string;

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
}
