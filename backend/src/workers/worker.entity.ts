import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MobileRole {
  Worker = 'worker',
  Foreman = 'foreman',
  SiteChief = 'site_chief',
  SectionChief = 'section_chief',
}

export enum WorkerStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Suspended = 'Suspended',
  Transferred = 'Transferred',
  Terminated = 'Terminated',
}

export enum QrStatus {
  Active = 'Active',
  Lost = 'Lost',
  Blocked = 'Blocked',
  Replaced = 'Replaced',
}

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  workerId: string;

  @Column()
  name: string;

  @Column({ default: '' })
  profession: string;

  @Column({ default: '' })
  brigadeId: string;

  @Column({ default: '' })
  brigadeName: string;

  @Column({ default: '' })
  zoneId: string;

  @Column({ default: '' })
  zoneName: string;

  @Column({ type: 'enum', enum: WorkerStatus, default: WorkerStatus.Active })
  status: WorkerStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  hireDate: string;

  @Column({ type: 'enum', enum: QrStatus, default: QrStatus.Active })
  qrStatus: QrStatus;

  @Column({ type: 'varchar', nullable: true })
  brigadirId: string | null;

  @Column({ type: 'varchar', nullable: true })
  foremanId: string | null;

  @Column({ type: 'varchar', default: 'Saatlik' })
  mesaiSistemi: string;

  @Column({ type: 'enum', enum: MobileRole, default: MobileRole.Worker })
  mobileRole: MobileRole;

  @Column({ type: 'decimal', precision: 6, scale: 1, default: 0 })
  extraSaat: number;

  @Column({ type: 'varchar', nullable: true, default: null })
  shift: 'day' | 'night' | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  nfcCardUid: string | null;

  @Column({ type: 'boolean', default: false })
  isStaff: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  photoUrl: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  pushToken: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  terminatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
