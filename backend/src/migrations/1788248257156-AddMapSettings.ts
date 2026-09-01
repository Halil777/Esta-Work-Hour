import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMapSettings1788248257156 implements MigrationInterface {
  name = 'AddMapSettings1788248257156';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "map_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "yandexMapsApiKey" character varying,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_map_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_map_settings_tenantId" UNIQUE ("tenantId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "map_settings"`);
  }
}
