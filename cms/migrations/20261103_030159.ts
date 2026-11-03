import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_story_reports_reason" AS ENUM('privacy', 'harassment', 'other');
  CREATE TYPE "public"."enum_story_reports_status" AS ENUM('open', 'reviewed');
  CREATE TABLE "story_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"story_id" numeric NOT NULL,
  	"reason" "enum_story_reports_reason" NOT NULL,
  	"status" "enum_story_reports_status" DEFAULT 'open' NOT NULL,
  	"story_title" varchar NOT NULL,
  	"story_body" varchar NOT NULL,
  	"author_name" varchar NOT NULL,
  	"report_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "story_reports_id" integer;
  CREATE UNIQUE INDEX "story_reports_report_key_idx" ON "story_reports" USING btree ("report_key");
  CREATE INDEX "story_reports_updated_at_idx" ON "story_reports" USING btree ("updated_at");
  CREATE INDEX "story_reports_created_at_idx" ON "story_reports" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_story_reports_fk" FOREIGN KEY ("story_reports_id") REFERENCES "public"."story_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_story_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("story_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_story_reports_fk";
  
  DROP INDEX "payload_locked_documents_rels_story_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "story_reports_id";
  DROP TABLE "story_reports";
  DROP TYPE "public"."enum_story_reports_reason";
  DROP TYPE "public"."enum_story_reports_status";`)
}
