import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('attendance_overrides')
export class AttendanceOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  workerEntityId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'bigint', nullable: true })
  checkInMs: number | null;

  @Column({ type: 'bigint', nullable: true })
  checkOutMs: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', default: '' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
