import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partial indexes for the first-sign-in linking pre-check and bind (src/lifecycle/linking.ts): only the few redeemed, unlinked
// invitations and approved applications are indexed, so the per-request check stays cheap however large the tables grow.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX "member_invitations_redeemed_unlinked_idx" ON "member_invitations" USING btree ("application_id") WHERE "status" = 'redeemed' AND "member_id" IS NULL;
   CREATE INDEX "member_applications_approved_email_idx" ON "member_applications" USING btree (lower("contact_email")) WHERE "status" = 'approved';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "member_invitations_redeemed_unlinked_idx";
   DROP INDEX IF EXISTS "member_applications_approved_email_idx";`)
}
