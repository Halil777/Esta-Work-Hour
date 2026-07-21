import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WorkerLifecycleAction } from './worker-lifecycle-event.entity';

export enum WorkerLifecycleReportStatus {
  Sent = 'sent',
  Failed = 'failed',
}

@Entity('worker_lifecycle_reports')
export class WorkerLifecycleReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  batchId: string;

  @Column({ type: 'enum', enum: WorkerLifecycleReportStatus })
  status: WorkerLifecycleReportStatus;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'jsonb' })
  recipients: string[];

  @Column({ type: 'int' })
  eventCount: number;

  @Column({ type: 'jsonb' })
  counts: Record<WorkerLifecycleAction, number>;

  @Column({ type: 'jsonb' })
  eventIds: string[];

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  resendCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
