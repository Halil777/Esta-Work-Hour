import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum EventType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

// Covers "this worker's events in a date/time range" lookups (Workers page
// scan filters, timesheets, reports). Without it those queries fell back to
// a full table scan of attendance_events, which only gets slower as scan
// history grows.
@Index(['employeeNumber', 'eventTime'])
// Covers time-range-only lookups that don't filter by worker first (e.g.
// late-arrivals' "who checked in today" scan).
@Index(['eventTime'])
@Entity('attendance_events')
export class AttendanceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  workerServerId: string;

  @Column({ default: '' })
  employeeNumber: string;

  @Column()
  cardUid: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'bigint' })
  eventTime: number;

  @Column({ default: 'NFC' })
  source: string;

  @Column({ nullable: true })
  mobileLocalId: number;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
