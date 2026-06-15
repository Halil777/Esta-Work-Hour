import { IsString, IsOptional } from 'class-validator';

export class UpdateBrigadirDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  phone?: string | null;

  @IsOptional()
  workerId?: string | null;

  @IsOptional()
  foremanId?: string | null;
}
