import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AdjLogAction {
  CREATED   = 'CREATED',
  UPDATED   = 'UPDATED',
  CANCELLED = 'CANCELLED',
}

@Entity('work_adjustment_logs')
@Index(['tenantId', 'workerEntityId'])
@Index(['tenantId', 'adjustmentId'])
export class WorkAdjustmentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adjustmentId: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  workerEntityId: string;

  @Column({ type: 'date' })
  workDate: string;

  @Column({ type: 'enum', enum: AdjLogAction })
  action: AdjLogAction;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: any;

  @Column({ type: 'jsonb', nullable: true })
  newValue: any;

  @Column()
  changedBy: string;

  @Column({ type: 'text', nullable: true })
  changeReason: string | null;

  @CreateDateColumn()
  changedAt: Date;
}
