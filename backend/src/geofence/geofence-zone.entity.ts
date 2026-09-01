import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One allowed scan location + radius. scannerDeviceId = null means the zone
// applies to every device/operator on the tenant that has no zones of its
// own (device-specific zones always fully replace the global set for that
// device, never merge with it — see GeofenceService.getEffectiveZones). A
// tenant can define any number of zones per device (or globally): an
// operator working several sites just gets one zone per site, each with
// its own radius.
@Index(['tenantId', 'scannerDeviceId'])
@Entity('geofence_zones')
export class GeofenceZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true, default: null })
  scannerDeviceId: string | null;

  @Column()
  label: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'int' })
  radiusMeters: number;

  @CreateDateColumn()
  createdAt: Date;
}
