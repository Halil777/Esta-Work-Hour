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
// Covers the Scanner Devices page's per-operator scan-stats aggregation
// (GROUP BY "deviceId").
@Index(['deviceId'])
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

  // Which scanner device recorded this scan — null for events synced before
  // this column existed. Lets the Scanner Devices admin page show, per
  // operator/device, how many workers they've scanned in total and today
  // (see AttendanceEventsService.getDeviceScanStats).
  @Column({ type: 'uuid', nullable: true, default: null })
  deviceId: string | null;

  // GPS location captured by the scanner app at the moment of the scan —
  // null for scans made before location capture was added, or when the
  // operator declined/lost location permission. Used to plot operator scan
  // locations on the tenant-admin map.
  @Column({ type: 'double precision', nullable: true, default: null })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true, default: null })
  longitude: number | null;

  // Whether this scan fell inside at least one of the effective geofence
  // zones for its device at sync time. null = no zones were configured for
  // that device/tenant at the time (unrestricted, not evaluated) or the
  // scan carries no location; true/false = an actual in/out-of-bounds
  // result, kept so the admin can review flagged scans later, not just get
  // a live warning on the scanning device.
  @Column({ type: 'boolean', nullable: true, default: null })
  outOfGeofence: boolean | null;

  @CreateDateColumn()
  createdAt: Date;
}
