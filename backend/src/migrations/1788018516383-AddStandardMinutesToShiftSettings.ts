import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStandardMinutesToShiftSettings1788018516383 implements MigrationInterface {
  name = 'AddStandardMinutesToShiftSettings1788018516383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shift_settings" ADD COLUMN IF NOT EXISTS "standardMinutes" integer NOT NULL DEFAULT 660`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift_settings" DROP COLUMN IF EXISTS "standardMinutes"`);
  }
}
