import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum WorkerLifecycleAction {
  Created = 'created',
  Terminated = 'terminated',
  Restored = 'restored',
}

export enum WorkerLifecycleSource {
  Manual = 'manual',
  ExcelImport = 'excel_import',
  System = 'system',
}

@Entity('worker_lifecycle_events')
export class WorkerLifecycleEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: WorkerLifecycleAction })
  action: WorkerLifecycleAction;

  @Column({ type: 'enum', enum: WorkerLifecycleSource, default: WorkerLifecycleSource.Manual })
  source: WorkerLifecycleSource;

  @Column({ type: 'varchar' })
  workerEntityId: string;

  @Column({ type: 'varchar' })
  workerId: string;

  @Column({ type: 'varchar' })
  workerName: string;

  @Column({ type: 'varchar', default: '' })
  profession: string;

  @Column({ type: 'varchar', default: '' })
  brigadeName: string;

  @Column({ type: 'varchar', nullable: true })
  mobileRole: string | null;

  @Column({ type: 'varchar', nullable: true })
  mesaiSistemi: string | null;

  @Column({ type: 'varchar', nullable: true })
  changedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamp' })
  eligibleAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reportedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reportBatchId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
