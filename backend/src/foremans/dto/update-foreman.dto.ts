import { IsString, IsOptional } from 'class-validator';

export class UpdateForemanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  phone?: string | null;

  @IsOptional()
  workerId?: string | null;
}
