import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('shift_settings')
export class ShiftSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  shiftType: 'day' | 'night';

  @Column({ type: 'varchar', default: '07:00' })
  startTime: string; // HH:mm

  @Column({ type: 'int', default: 60 })
  graceMinutes: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
