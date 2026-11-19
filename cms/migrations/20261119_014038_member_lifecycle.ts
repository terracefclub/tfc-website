import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_status" AS ENUM('active', 'offboarded', 'erased');
  CREATE TYPE "public"."enum_member_profiles_hidden_reason" AS ENUM('moderation', 'offboarded');
  CREATE TYPE "public"."enum_member_stories_hidden_reason" AS ENUM('moderation', 'offboarded');
  CREATE TYPE "public"."enum_member_groups_hidden_reason" AS ENUM('moderation', 'offboarded');
  CREATE TYPE "public"."enum_mentorship_offers_hidden_reason" AS ENUM('moderation', 'offboarded');
  CREATE TYPE "public"."enum_mentorship_requests_hidden_reason" AS ENUM('moderation', 'offboarded');
  CREATE TYPE "public"."enum_member_applications_affiliation" AS ENUM('current-member', 'alumni');
  CREATE TYPE "public"."enum_member_applications_status" AS ENUM('pending', 'approved', 'denied', 'withdrawn');
  CREATE TYPE "public"."enum_member_applications_grant_role" AS ENUM('current-member', 'alumni');
  CREATE TYPE "public"."enum_member_invitations_role" AS ENUM('current-member', 'alumni');
  CREATE TYPE "public"."enum_member_invitations_status" AS ENUM('pending', 'redeemed', 'expired', 'revoked');
  CREATE TYPE "public"."enum_message_outbox_kind" AS ENUM('invitation', 'denial', 'offboarding', 'erasure-confirmation');
  CREATE TYPE "public"."enum_message_outbox_status" AS ENUM('queued', 'delivered-by-operator');
  CREATE TYPE "public"."enum_member_offboardings_state" AS ENUM('offboarded', 'restored', 'erased');
  CREATE TYPE "public"."enum_moderation_reports_target_type" AS ENUM('story', 'group', 'mentorship-request');
  CREATE TYPE "public"."enum_moderation_reports_reason" AS ENUM('privacy', 'harassment', 'other');
  CREATE TYPE "public"."enum_moderation_reports_status" AS ENUM('open', 'hidden', 'resolved', 'dismissed');
  CREATE TYPE "public"."enum_data_requests_kind" AS ENUM('export', 'erasure');
  CREATE TYPE "public"."enum_data_requests_status" AS ENUM('awaiting-confirmation', 'confirmed', 'completed', 'expired');
  CREATE TYPE "public"."enum_data_requests_requested_by" AS ENUM('member', 'administrator');
  CREATE TABLE "member_applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"affiliation" "enum_member_applications_affiliation" NOT NULL,
  	"class_year" numeric,
  	"contact_email" varchar NOT NULL,
  	"note" varchar,
  	"status" "enum_member_applications_status" DEFAULT 'pending' NOT NULL,
  	"grant_role" "enum_member_applications_grant_role",
  	"decision_note" varchar,
  	"reviewer_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"member_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_invitations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"application_id" integer NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"role" "enum_member_invitations_role" NOT NULL,
  	"status" "enum_member_invitations_status" DEFAULT 'pending' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"redeemed_at" timestamp(3) with time zone,
  	"member_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_outbox" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_message_outbox_kind" NOT NULL,
  	"recipient_label" varchar NOT NULL,
  	"recipient_email" varchar,
  	"subject" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"status" "enum_message_outbox_status" DEFAULT 'queued' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_offboardings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"state" "enum_member_offboardings_state" DEFAULT 'offboarded' NOT NULL,
  	"reason" varchar,
  	"notice_email" varchar,
  	"actor_id" integer,
  	"offboarded_at" timestamp(3) with time zone,
  	"grace_ends_at" timestamp(3) with time zone,
  	"restored_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "moderation_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_type" "enum_moderation_reports_target_type" NOT NULL,
  	"target_id" numeric NOT NULL,
  	"reason" "enum_moderation_reports_reason" NOT NULL,
  	"detail" varchar,
  	"status" "enum_moderation_reports_status" DEFAULT 'open' NOT NULL,
  	"resolution_note" varchar,
  	"snapshot_title" varchar NOT NULL,
  	"snapshot_body" varchar NOT NULL,
  	"author_name" varchar NOT NULL,
  	"reporter_id" integer,
  	"target_author_id" integer,
  	"resolver_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"report_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "data_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"kind" "enum_data_requests_kind" NOT NULL,
  	"status" "enum_data_requests_status" DEFAULT 'awaiting-confirmation' NOT NULL,
  	"requested_by" "enum_data_requests_requested_by" DEFAULT 'member' NOT NULL,
  	"confirm_hash" varchar,
  	"confirm_expires_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"actor_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "members" ADD COLUMN "status" "enum_members_status" DEFAULT 'active' NOT NULL;
  ALTER TABLE "members" ADD COLUMN "status_changed_at" timestamp(3) with time zone;
  ALTER TABLE "member_profiles" ADD COLUMN "hidden_reason" "enum_member_profiles_hidden_reason";
  ALTER TABLE "member_profiles" ADD COLUMN "hidden_at" timestamp(3) with time zone;
  ALTER TABLE "member_stories" ADD COLUMN "hidden_reason" "enum_member_stories_hidden_reason";
  ALTER TABLE "member_stories" ADD COLUMN "hidden_at" timestamp(3) with time zone;
  ALTER TABLE "member_groups" ADD COLUMN "hidden_reason" "enum_member_groups_hidden_reason";
  ALTER TABLE "member_groups" ADD COLUMN "hidden_at" timestamp(3) with time zone;
  ALTER TABLE "mentorship_offers" ADD COLUMN "hidden_reason" "enum_mentorship_offers_hidden_reason";
  ALTER TABLE "mentorship_offers" ADD COLUMN "hidden_at" timestamp(3) with time zone;
  ALTER TABLE "mentorship_requests" ADD COLUMN "hidden_reason" "enum_mentorship_requests_hidden_reason";
  ALTER TABLE "mentorship_requests" ADD COLUMN "hidden_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_applications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_invitations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "message_outbox_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_offboardings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "moderation_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "data_requests_id" integer;
  ALTER TABLE "member_applications" ADD CONSTRAINT "member_applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_applications" ADD CONSTRAINT "member_applications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_application_id_member_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."member_applications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_offboardings" ADD CONSTRAINT "member_offboardings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_offboardings" ADD CONSTRAINT "member_offboardings_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_members_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_target_author_id_members_id_fk" FOREIGN KEY ("target_author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_resolver_id_users_id_fk" FOREIGN KEY ("resolver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "member_applications_reviewer_idx" ON "member_applications" USING btree ("reviewer_id");
  CREATE INDEX "member_applications_member_idx" ON "member_applications" USING btree ("member_id");
  CREATE INDEX "member_applications_updated_at_idx" ON "member_applications" USING btree ("updated_at");
  CREATE INDEX "member_applications_created_at_idx" ON "member_applications" USING btree ("created_at");
  CREATE INDEX "member_invitations_application_idx" ON "member_invitations" USING btree ("application_id");
  CREATE UNIQUE INDEX "member_invitations_token_hash_idx" ON "member_invitations" USING btree ("token_hash");
  CREATE INDEX "member_invitations_member_idx" ON "member_invitations" USING btree ("member_id");
  CREATE INDEX "member_invitations_updated_at_idx" ON "member_invitations" USING btree ("updated_at");
  CREATE INDEX "member_invitations_created_at_idx" ON "member_invitations" USING btree ("created_at");
  CREATE INDEX "message_outbox_updated_at_idx" ON "message_outbox" USING btree ("updated_at");
  CREATE INDEX "message_outbox_created_at_idx" ON "message_outbox" USING btree ("created_at");
  CREATE INDEX "member_offboardings_member_idx" ON "member_offboardings" USING btree ("member_id");
  CREATE INDEX "member_offboardings_actor_idx" ON "member_offboardings" USING btree ("actor_id");
  CREATE INDEX "member_offboardings_updated_at_idx" ON "member_offboardings" USING btree ("updated_at");
  CREATE INDEX "member_offboardings_created_at_idx" ON "member_offboardings" USING btree ("created_at");
  CREATE INDEX "moderation_reports_reporter_idx" ON "moderation_reports" USING btree ("reporter_id");
  CREATE INDEX "moderation_reports_target_author_idx" ON "moderation_reports" USING btree ("target_author_id");
  CREATE INDEX "moderation_reports_resolver_idx" ON "moderation_reports" USING btree ("resolver_id");
  CREATE UNIQUE INDEX "moderation_reports_report_key_idx" ON "moderation_reports" USING btree ("report_key");
  CREATE INDEX "moderation_reports_updated_at_idx" ON "moderation_reports" USING btree ("updated_at");
  CREATE INDEX "moderation_reports_created_at_idx" ON "moderation_reports" USING btree ("created_at");
  CREATE INDEX "data_requests_member_idx" ON "data_requests" USING btree ("member_id");
  CREATE INDEX "data_requests_actor_idx" ON "data_requests" USING btree ("actor_id");
  CREATE INDEX "data_requests_updated_at_idx" ON "data_requests" USING btree ("updated_at");
  CREATE INDEX "data_requests_created_at_idx" ON "data_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_applications_fk" FOREIGN KEY ("member_applications_id") REFERENCES "public"."member_applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_invitations_fk" FOREIGN KEY ("member_invitations_id") REFERENCES "public"."member_invitations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_outbox_fk" FOREIGN KEY ("message_outbox_id") REFERENCES "public"."message_outbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_offboardings_fk" FOREIGN KEY ("member_offboardings_id") REFERENCES "public"."member_offboardings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_moderation_reports_fk" FOREIGN KEY ("moderation_reports_id") REFERENCES "public"."moderation_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_data_requests_fk" FOREIGN KEY ("data_requests_id") REFERENCES "public"."data_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_member_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("member_applications_id");
  CREATE INDEX "payload_locked_documents_rels_member_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("member_invitations_id");
  CREATE INDEX "payload_locked_documents_rels_message_outbox_id_idx" ON "payload_locked_documents_rels" USING btree ("message_outbox_id");
  CREATE INDEX "payload_locked_documents_rels_member_offboardings_id_idx" ON "payload_locked_documents_rels" USING btree ("member_offboardings_id");
  CREATE INDEX "payload_locked_documents_rels_moderation_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("moderation_reports_id");
  CREATE INDEX "payload_locked_documents_rels_data_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("data_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "member_applications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_invitations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "message_outbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_offboardings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "data_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "member_applications" CASCADE;
  DROP TABLE "member_invitations" CASCADE;
  DROP TABLE "message_outbox" CASCADE;
  DROP TABLE "member_offboardings" CASCADE;
  DROP TABLE "moderation_reports" CASCADE;
  DROP TABLE "data_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_applications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_invitations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_message_outbox_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_offboardings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_moderation_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_data_requests_fk";
  
  DROP INDEX "payload_locked_documents_rels_member_applications_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_invitations_id_idx";
  DROP INDEX "payload_locked_documents_rels_message_outbox_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_offboardings_id_idx";
  DROP INDEX "payload_locked_documents_rels_moderation_reports_id_idx";
  DROP INDEX "payload_locked_documents_rels_data_requests_id_idx";
  ALTER TABLE "members" DROP COLUMN "status";
  ALTER TABLE "members" DROP COLUMN "status_changed_at";
  ALTER TABLE "member_profiles" DROP COLUMN "hidden_reason";
  ALTER TABLE "member_profiles" DROP COLUMN "hidden_at";
  ALTER TABLE "member_stories" DROP COLUMN "hidden_reason";
  ALTER TABLE "member_stories" DROP COLUMN "hidden_at";
  ALTER TABLE "member_groups" DROP COLUMN "hidden_reason";
  ALTER TABLE "member_groups" DROP COLUMN "hidden_at";
  ALTER TABLE "mentorship_offers" DROP COLUMN "hidden_reason";
  ALTER TABLE "mentorship_offers" DROP COLUMN "hidden_at";
  ALTER TABLE "mentorship_requests" DROP COLUMN "hidden_reason";
  ALTER TABLE "mentorship_requests" DROP COLUMN "hidden_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_applications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_invitations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "message_outbox_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_offboardings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "moderation_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "data_requests_id";
  DROP TYPE "public"."enum_members_status";
  DROP TYPE "public"."enum_member_profiles_hidden_reason";
  DROP TYPE "public"."enum_member_stories_hidden_reason";
  DROP TYPE "public"."enum_member_groups_hidden_reason";
  DROP TYPE "public"."enum_mentorship_offers_hidden_reason";
  DROP TYPE "public"."enum_mentorship_requests_hidden_reason";
  DROP TYPE "public"."enum_member_applications_affiliation";
  DROP TYPE "public"."enum_member_applications_status";
  DROP TYPE "public"."enum_member_applications_grant_role";
  DROP TYPE "public"."enum_member_invitations_role";
  DROP TYPE "public"."enum_member_invitations_status";
  DROP TYPE "public"."enum_message_outbox_kind";
  DROP TYPE "public"."enum_message_outbox_status";
  DROP TYPE "public"."enum_member_offboardings_state";
  DROP TYPE "public"."enum_moderation_reports_target_type";
  DROP TYPE "public"."enum_moderation_reports_reason";
  DROP TYPE "public"."enum_moderation_reports_status";
  DROP TYPE "public"."enum_data_requests_kind";
  DROP TYPE "public"."enum_data_requests_status";
  DROP TYPE "public"."enum_data_requests_requested_by";`)
}
