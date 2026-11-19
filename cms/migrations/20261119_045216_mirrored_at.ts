import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "message_outbox" ADD COLUMN "mirrored_at" timestamp(3) with time zone;
   -- Data step: the file-copy marker used to borrow the dedupe key as 'mirrored:<id>'. Move it to the new column.
   -- Rows that were not an erasure confirmation had their file written when they were created, so they count as mirrored too.
   UPDATE "message_outbox" SET "mirrored_at" = "updated_at", "dedupe_key" = NULL WHERE "dedupe_key" LIKE 'mirrored:%';
   UPDATE "message_outbox" SET "mirrored_at" = "created_at" WHERE "mirrored_at" IS NULL AND "kind" <> 'erasure-confirmation';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "message_outbox" SET "dedupe_key" = 'mirrored:' || "id" WHERE "mirrored_at" IS NOT NULL AND "dedupe_key" IS NULL AND "kind" = 'erasure-confirmation';
   ALTER TABLE "message_outbox" DROP COLUMN "mirrored_at";`)
}
