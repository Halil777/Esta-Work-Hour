import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('scanner_devices')
@Index(['tenantId'])
export class ScannerDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column()
  label: string; // "1-nji Giriş Derwezesi"

  @Column({ unique: true })
  token: string; // plaintext UUID — API-key style, secret

  @Column({ type: 'varchar', nullable: true, default: null })
  workerEntityId: string | null; // operator worker (who physically uses this device)

  @Column({ type: 'varchar', nullable: true, default: null })
  location: string | null; // optional: "Demirgazyk giriş", "Günorta derweze"

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true, default: null })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
