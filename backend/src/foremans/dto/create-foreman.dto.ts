import { IsString, IsOptional } from 'class-validator';

export class CreateForemanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workerId?: string;
}
