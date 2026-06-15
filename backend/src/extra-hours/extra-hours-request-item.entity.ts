import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ExtraHoursRequest } from './extra-hours-request.entity';

@Entity('extra_hours_request_items')
export class ExtraHoursRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExtraHoursRequest, req => req.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ExtraHoursRequest;

  @Column({ type: 'varchar' })
  requestId: string;

  @Column({ type: 'varchar' })
  workerEntityId: string; // Worker.id

  @Column({ type: 'varchar' })
  workerName: string;

  @Column({ type: 'varchar' })
  workerId: string; // Worker.workerId (sicil no)

  @Column({ type: 'decimal', precision: 4, scale: 1 })
  extraHours: number;
}
