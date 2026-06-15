import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';

export enum ExtraRequestStatus {
  Pending = 'pending',
  Seen = 'seen',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Entity('extra_hours_requests')
export class ExtraHoursRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  foremanWorkerEntityId: string; // Worker.id of foreman

  @Column({ type: 'varchar' })
  foremanName: string;

  @Column({ type: 'varchar' })
  siteChiefWorkerEntityId: string; // Worker.id of site chief

  @Column({ type: 'varchar' })
  siteChiefName: string;

  @Column({ type: 'date' })
  workDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: ExtraRequestStatus,
    default: ExtraRequestStatus.Pending,
  })
  status: ExtraRequestStatus;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  seenAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actionAt: Date | null;

  @OneToMany(() => ExtraHoursRequestItem, item => item.request, {
    cascade: true,
    eager: true,
  })
  items: ExtraHoursRequestItem[];
}
