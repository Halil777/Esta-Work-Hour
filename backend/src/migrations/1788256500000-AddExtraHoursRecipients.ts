import { MigrationInterface, QueryRunner } from 'typeorm';

// Extra-hours requests can now go to several (or all) site chiefs at once
// instead of exactly one -- each recipient gets their own row tracking
// seen/approved/rejected independently. This migration creates that table,
// backfills one recipient row per existing request from the old singular
// siteChiefWorkerEntityId/siteChiefName columns (mapping the old aggregate
// status onto that one recipient's action), then drops those old columns.
//
// IMPORTANT (ops note): this backend runs with TypeORM `synchronize: true`
// in this deployment (NODE_ENV is never set to 'production' in
// docker-compose.yml), so the next time the backend container boots it will
// auto-drop the old siteChiefWorkerEntityId/siteChiefName columns to match
// the updated entity -- taking any not-yet-backfilled data with it. Run
// `npm run migration:run` in backend/ against the production database
// BEFORE redeploying (before `docker compose up --build`), so this backfill
// runs first and the old data is preserved in the new recipients table.
export class AddExtraHoursRecipients1788256500000 implements MigrationInterface {
  name = 'AddExtraHoursRecipients1788256500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "extra_hours_request_recipients_action_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "extra_hours_request_recipients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "requestId" character varying NOT NULL,
        "siteChiefWorkerEntityId" character varying NOT NULL,
        "siteChiefName" character varying NOT NULL,
        "seenAt" TIMESTAMP DEFAULT NULL,
        "action" "extra_hours_request_recipients_action_enum" NOT NULL DEFAULT 'pending',
        "actionAt" TIMESTAMP DEFAULT NULL,
        CONSTRAINT "PK_extra_hours_request_recipients" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_extra_hours_recipients_requestId" ON "extra_hours_request_recipients" ("requestId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_extra_hours_recipients_siteChief" ON "extra_hours_request_recipients" ("siteChiefWorkerEntityId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "extra_hours_request_recipients"
      ADD CONSTRAINT "FK_extra_hours_recipients_request"
      FOREIGN KEY ("requestId") REFERENCES "extra_hours_requests"("id") ON DELETE CASCADE
    `).catch(() => {
      // constraint already exists (re-run safety) -- ignore
    });

    // Backfill: one recipient row per existing request, carrying over the
    // old singular site-chief + the aggregate status as that recipient's
    // own action. Only runs while the old columns still exist.
    const hasOldColumns = await queryRunner.hasColumn('extra_hours_requests', 'siteChiefWorkerEntityId');
    if (hasOldColumns) {
      await queryRunner.query(`
        INSERT INTO "extra_hours_request_recipients"
          ("id", "requestId", "siteChiefWorkerEntityId", "siteChiefName", "seenAt", "action", "actionAt")
        SELECT
          gen_random_uuid(),
          r."id",
          r."siteChiefWorkerEntityId",
          r."siteChiefName",
          r."seenAt",
          CASE r."status"
            WHEN 'approved' THEN 'approved'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'pending'
          END::"extra_hours_request_recipients_action_enum",
          r."actionAt"
        FROM "extra_hours_requests" r
        WHERE r."siteChiefWorkerEntityId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "extra_hours_request_recipients" er WHERE er."requestId" = r."id"
          )
      `);

      await queryRunner.query(`ALTER TABLE "extra_hours_requests" DROP COLUMN IF EXISTS "siteChiefWorkerEntityId"`);
      await queryRunner.query(`ALTER TABLE "extra_hours_requests" DROP COLUMN IF EXISTS "siteChiefName"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "extra_hours_requests" ADD COLUMN IF NOT EXISTS "siteChiefWorkerEntityId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "extra_hours_requests" ADD COLUMN IF NOT EXISTS "siteChiefName" character varying`,
    );
    // Best-effort: restore from the first recipient of each request.
    await queryRunner.query(`
      UPDATE "extra_hours_requests" r
      SET "siteChiefWorkerEntityId" = er."siteChiefWorkerEntityId", "siteChiefName" = er."siteChiefName"
      FROM (
        SELECT DISTINCT ON ("requestId") "requestId", "siteChiefWorkerEntityId", "siteChiefName"
        FROM "extra_hours_request_recipients"
        ORDER BY "requestId"
      ) er
      WHERE er."requestId" = r."id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "extra_hours_request_recipients"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "extra_hours_request_recipients_action_enum"`);
  }
}
