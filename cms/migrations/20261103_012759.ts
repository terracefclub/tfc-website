import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "identity_key" varchar;
  CREATE UNIQUE INDEX "users_identity_key_idx" ON "users" USING btree ("identity_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_identity_key_idx";
  ALTER TABLE "users" DROP COLUMN "identity_key";`)
}
