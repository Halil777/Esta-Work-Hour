import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncEventItemDto {
  @IsNumber()
  localId: number;

  @IsOptional()
  @IsString()
  workerServerId?: string;

  @IsString()
  employeeNumber: string;

  @IsString()
  cardUid: string;

  @IsString()
  eventType: string;

  @IsNumber()
  eventTime: number;

  @IsString()
  source: string;
}

export class SyncEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEventItemDto)
  events: SyncEventItemDto[];
}
