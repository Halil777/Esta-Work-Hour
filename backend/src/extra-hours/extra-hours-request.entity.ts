import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';
import { ExtraHoursRequestRecipient } from './extra-hours-request-recipient.entity';

// 'seen' is kept for backward compatibility with any already-stored rows —
// the overall status no longer transitions through it going forward (each
// recipient's own seen/action is tracked on ExtraHoursRequestRecipient
// instead); only 'pending' | 'approved' | 'rejected' are set now.
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

  @Column({ type: 'date' })
  workDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Overall/aggregate status across every recipient — see
  // ExtraHoursService.takeAction for the roll-up rule.
  @Column({
    type: 'enum',
    enum: ExtraRequestStatus,
    default: ExtraRequestStatus.Pending,
  })
  status: ExtraRequestStatus;

  @CreateDateColumn()
  sentAt: Date;

  // Earliest seenAt across all recipients.
  @Column({ type: 'timestamp', nullable: true })
  seenAt: Date | null;

  // When the aggregate status was finalized (first approval, or the last
  // rejection that made every recipient's action 'rejected').
  @Column({ type: 'timestamp', nullable: true })
  actionAt: Date | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null;

  @OneToMany(() => ExtraHoursRequestItem, item => item.request, {
    cascade: true,
    eager: true,
  })
  items: ExtraHoursRequestItem[];

  @OneToMany(() => ExtraHoursRequestRecipient, r => r.request, {
    cascade: true,
  })
  recipients: ExtraHoursRequestRecipient[];
}
