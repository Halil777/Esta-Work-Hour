import { IsOptional, IsString } from 'class-validator';

export class TerminateWorkerDto {
  @IsOptional()
  @IsString()
  terminationDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
