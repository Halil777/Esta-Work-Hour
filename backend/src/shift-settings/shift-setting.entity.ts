import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('shift_settings')
@Index(['tenantId', 'shiftType'], { unique: true, where: '"tenantId" IS NOT NULL' })
export class ShiftSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  shiftType: 'day' | 'night';

  @Column({ type: 'varchar', default: '07:00' })
  startTime: string; // HH:mm

  @Column({ type: 'varchar', default: '19:00' })
  endTime: string; // HH:mm

  @Column({ type: 'int', default: 60 })
  graceMinutes: number;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
