import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum EventType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

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

  @CreateDateColumn()
  createdAt: Date;
}
