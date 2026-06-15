import { IsString, IsOptional } from 'class-validator';

export class CreateBrigadirDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  foremanId?: string | null;
}
