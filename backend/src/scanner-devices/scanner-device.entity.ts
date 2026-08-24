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

  // Device health heartbeat — sent periodically by the Android app alongside
  // its sync loop, distinct from lastSeenAt (which DeviceGuard bumps on
  // *any* authenticated request). Lets admins spot a kiosk that's running
  // low on battery, stuck on an old APK build, or silently piling up
  // unsynced scans, without walking over to the physical device.
  @Column({ type: 'int', nullable: true, default: null })
  batteryLevel: number | null; // 0-100

  @Column({ type: 'varchar', nullable: true, default: null })
  appVersion: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  pendingEventCount: number | null; // unsynced attendance events sitting on-device

  @Column({ type: 'timestamp', nullable: true, default: null })
  lastHeartbeatAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
