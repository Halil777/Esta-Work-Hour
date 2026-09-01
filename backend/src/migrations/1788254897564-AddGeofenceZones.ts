import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeofenceZones1788254897564 implements MigrationInterface {
  name = 'AddGeofenceZones1788254897564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "geofence_zones" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "scannerDeviceId" uuid DEFAULT NULL,
        "label" character varying NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "radiusMeters" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_geofence_zones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_geofence_zones_tenant_device" ON "geofence_zones" ("tenantId", "scannerDeviceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_events" ADD COLUMN IF NOT EXISTS "outOfGeofence" boolean DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_events" DROP COLUMN IF EXISTS "outOfGeofence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geofence_zones_tenant_device"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geofence_zones"`);
  }
}
