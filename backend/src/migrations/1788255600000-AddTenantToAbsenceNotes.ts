import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantToAbsenceNotes1788255600000 implements MigrationInterface {
  name = 'AddTenantToAbsenceNotes1788255600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "absence_notes" ADD COLUMN IF NOT EXISTS "tenantId" uuid DEFAULT NULL`,
    );
    // Backfill existing rows (created before this column was scoped) from
    // the worker they're about — absence-notes.service.ts previously never
    // stamped a tenant at all, so every admin/foreman was seeing every
    // other tenant's absence notes for a given date.
    await queryRunner.query(`
      UPDATE "absence_notes" an
      SET "tenantId" = w."tenantId"
      FROM "workers" w
      WHERE an."workerEntityId"::uuid = w.id AND an."tenantId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "absence_notes" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
