import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationToAttendanceEvent1788248257155 implements MigrationInterface {
  name = 'AddLocationToAttendanceEvent1788248257155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_events" ADD COLUMN IF NOT EXISTS "latitude" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_events" ADD COLUMN IF NOT EXISTS "longitude" double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_events" DROP COLUMN IF EXISTS "longitude"`);
    await queryRunner.query(`ALTER TABLE "attendance_events" DROP COLUMN IF EXISTS "latitude"`);
  }
}
