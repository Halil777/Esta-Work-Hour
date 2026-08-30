import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('shift_settings')
@Index(['tenantId', 'shiftType'], { unique: true, where: '"tenantId" IS NOT NULL' })
export class ShiftSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  shiftType: 'day' | 'night';

  @Column({ type: 'varchar', default: '06:30' })
  startTime: string; // HH:mm

  @Column({ type: 'varchar', default: '19:30' })
  endTime: string; // HH:mm

  @Column({ type: 'int', default: 60 })
  graceMinutes: number;

  /** Standard scheduled shift duration in minutes (e.g. 660 = 11h). Used to
   *  compute grace-adjusted "policy" hours in the Reports range export. */
  @Column({ type: 'int', default: 660 })
  standardMinutes: number;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
