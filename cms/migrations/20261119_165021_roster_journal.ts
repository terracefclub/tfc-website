import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_roster_runs_status" AS ENUM('running', 'completed', 'failed', 'rolled-back');
  CREATE TYPE "public"."enum_roster_run_items_state" AS ENUM('applied', 'rolled-back');
  CREATE TABLE "roster_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"run_id" varchar NOT NULL,
  	"operator_id" integer,
  	"operator_label" varchar,
  	"status" "enum_roster_runs_status" DEFAULT 'running' NOT NULL,
  	"file_sha256" varchar,
  	"plan_sha256" varchar,
  	"run_limit" numeric,
  	"reinvite_lapsed" boolean DEFAULT false,
  	"database_identity" varchar,
  	"counts" jsonb,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"finished_at" timestamp(3) with time zone,
  	"rolled_back_at" timestamp(3) with time zone,
  	"rolled_back_by_id" integer,
  	"rolled_back_by_label" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "roster_run_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"run_id" integer NOT NULL,
  	"row_number" numeric NOT NULL,
  	"application_id" integer,
  	"invitation_id" integer,
  	"state" "enum_roster_run_items_state" DEFAULT 'applied' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roster_runs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roster_run_items_id" integer;
  ALTER TABLE "roster_runs" ADD CONSTRAINT "roster_runs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roster_runs" ADD CONSTRAINT "roster_runs_rolled_back_by_id_users_id_fk" FOREIGN KEY ("rolled_back_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roster_run_items" ADD CONSTRAINT "roster_run_items_run_id_roster_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."roster_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roster_run_items" ADD CONSTRAINT "roster_run_items_application_id_member_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."member_applications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "roster_run_items" ADD CONSTRAINT "roster_run_items_invitation_id_member_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."member_invitations"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "roster_runs_run_id_idx" ON "roster_runs" USING btree ("run_id");
  CREATE INDEX "roster_runs_operator_idx" ON "roster_runs" USING btree ("operator_id");
  CREATE INDEX "roster_runs_rolled_back_by_idx" ON "roster_runs" USING btree ("rolled_back_by_id");
  CREATE INDEX "roster_runs_updated_at_idx" ON "roster_runs" USING btree ("updated_at");
  CREATE INDEX "roster_runs_created_at_idx" ON "roster_runs" USING btree ("created_at");
  CREATE INDEX "roster_run_items_run_idx" ON "roster_run_items" USING btree ("run_id");
  CREATE INDEX "roster_run_items_application_idx" ON "roster_run_items" USING btree ("application_id");
  CREATE INDEX "roster_run_items_invitation_idx" ON "roster_run_items" USING btree ("invitation_id");
  CREATE INDEX "roster_run_items_updated_at_idx" ON "roster_run_items" USING btree ("updated_at");
  CREATE INDEX "roster_run_items_created_at_idx" ON "roster_run_items" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roster_runs_fk" FOREIGN KEY ("roster_runs_id") REFERENCES "public"."roster_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roster_run_items_fk" FOREIGN KEY ("roster_run_items_id") REFERENCES "public"."roster_run_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_roster_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("roster_runs_id");
  CREATE INDEX "payload_locked_documents_rels_roster_run_items_id_idx" ON "payload_locked_documents_rels" USING btree ("roster_run_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roster_runs_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roster_run_items_fk";
  ALTER TABLE IF EXISTS "roster_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "roster_run_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "roster_runs" CASCADE;
  DROP TABLE IF EXISTS "roster_run_items" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roster_runs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roster_run_items_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_roster_runs_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_roster_run_items_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "roster_runs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "roster_run_items_id";
  DROP TYPE IF EXISTS "public"."enum_roster_runs_status";
  DROP TYPE IF EXISTS "public"."enum_roster_run_items_state";`)
}
