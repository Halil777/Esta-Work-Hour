import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AdjustmentType {
  ADD      = 'ADD',       // credited += minutes
  SUBTRACT = 'SUBTRACT',  // credited -= minutes
  SET      = 'SET',       // credited  = minutes (overrides, then others stack)
  MINIMUM  = 'MINIMUM',   // credited  = max(credited, minutes)
  BONUS    = 'BONUS',     // same as ADD, semantically "rest-day bonus"
}

export enum AdjustmentStatus {
  ACTIVE    = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('work_adjustments')
@Index(['tenantId', 'workerEntityId', 'workDate'])
@Index(['tenantId', 'workDate'])
export class WorkAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  workerEntityId: string;

  /** Shift date (YYYY-MM-DD) — not necessarily the calendar date of the scan */
  @Column({ type: 'date' })
  workDate: string;

  @Column({ type: 'enum', enum: AdjustmentType })
  adjustmentType: AdjustmentType;

  /** Always positive; meaning depends on adjustmentType */
  @Column({ type: 'int' })
  minutes: number;

  @Column({ type: 'uuid', nullable: true })
  reasonId: string | null;

  /** Snapshot of reason name at time of creation */
  @Column({ nullable: true })
  reasonLabel: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** 'MANUAL' | 'BULK' */
  @Column({ default: 'MANUAL' })
  sourceType: string;

  /** Groups all adjustments created in one bulk operation */
  @Column({ type: 'uuid', nullable: true })
  bulkId: string | null;

  @Column({ type: 'enum', enum: AdjustmentStatus, default: AdjustmentStatus.ACTIVE })
  status: AdjustmentStatus;

  @Column()
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
