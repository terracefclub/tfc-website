import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "message_outbox" ADD COLUMN "invitation_id" integer;
  ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_invitation_id_member_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."member_invitations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "message_outbox_invitation_idx" ON "message_outbox" USING btree ("invitation_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "message_outbox" DROP CONSTRAINT "message_outbox_invitation_id_member_invitations_id_fk";
  
  DROP INDEX "message_outbox_invitation_idx";
  ALTER TABLE "message_outbox" DROP COLUMN "invitation_id";`)
}
