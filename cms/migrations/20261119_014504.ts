import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_wp_import_runs_status" AS ENUM('running', 'completed', 'failed', 'rolled-back');
  CREATE TYPE "public"."enum_wp_import_journal_action" AS ENUM('created', 'updated');
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"excerpt" varchar,
  	"body_html" varchar,
  	"author_name" varchar,
  	"published_at" timestamp(3) with time zone,
  	"categories" jsonb,
  	"tags" jsonb,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"featured_media_id" integer,
  	"wp_id" numeric,
  	"wp_guid" varchar,
  	"wp_status" varchar,
  	"wp_password_protected" boolean,
  	"wp_review_flags" jsonb,
  	"wp_content_hash" varchar,
  	"wp_applied_hash" varchar,
  	"wp_import_run" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_body_html" varchar,
  	"version_author_name" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_categories" jsonb,
  	"version_tags" jsonb,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_featured_media_id" integer,
  	"version_wp_id" numeric,
  	"version_wp_guid" varchar,
  	"version_wp_status" varchar,
  	"version_wp_password_protected" boolean,
  	"version_wp_review_flags" jsonb,
  	"version_wp_content_hash" varchar,
  	"version_wp_applied_hash" varchar,
  	"version_wp_import_run" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"excerpt" varchar,
  	"body_html" varchar,
  	"author_name" varchar,
  	"published_at" timestamp(3) with time zone,
  	"categories" jsonb,
  	"tags" jsonb,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"featured_media_id" integer,
  	"parent_wp_id" numeric,
  	"menu_order" numeric,
  	"wp_id" numeric,
  	"wp_guid" varchar,
  	"wp_status" varchar,
  	"wp_password_protected" boolean,
  	"wp_review_flags" jsonb,
  	"wp_content_hash" varchar,
  	"wp_applied_hash" varchar,
  	"wp_import_run" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_body_html" varchar,
  	"version_author_name" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_categories" jsonb,
  	"version_tags" jsonb,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_featured_media_id" integer,
  	"version_parent_wp_id" numeric,
  	"version_menu_order" numeric,
  	"version_wp_id" numeric,
  	"version_wp_guid" varchar,
  	"version_wp_status" varchar,
  	"version_wp_password_protected" boolean,
  	"version_wp_review_flags" jsonb,
  	"version_wp_content_hash" varchar,
  	"version_wp_applied_hash" varchar,
  	"version_wp_import_run" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "wp_import_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"run_id" varchar NOT NULL,
  	"status" "enum_wp_import_runs_status" NOT NULL,
  	"publish" boolean DEFAULT false,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"finished_at" timestamp(3) with time zone,
  	"rolled_back_at" timestamp(3) with time zone,
  	"source_sha256" varchar,
  	"plan_sha256" varchar,
  	"counts" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wp_import_journal" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"run_id" varchar NOT NULL,
  	"sequence" numeric NOT NULL,
  	"collection" varchar NOT NULL,
  	"doc_id" varchar NOT NULL,
  	"wp_id" numeric NOT NULL,
  	"action" "enum_wp_import_journal_action" NOT NULL,
  	"pre_image" jsonb,
  	"post_hash" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "source_url" varchar;
  ALTER TABLE "media" ADD COLUMN "source_file" varchar;
  ALTER TABLE "media" ADD COLUMN "wp_id" numeric;
  ALTER TABLE "media" ADD COLUMN "wp_guid" varchar;
  ALTER TABLE "media" ADD COLUMN "wp_status" varchar;
  ALTER TABLE "media" ADD COLUMN "wp_password_protected" boolean;
  ALTER TABLE "media" ADD COLUMN "wp_review_flags" jsonb;
  ALTER TABLE "media" ADD COLUMN "wp_content_hash" varchar;
  ALTER TABLE "media" ADD COLUMN "wp_applied_hash" varchar;
  ALTER TABLE "media" ADD COLUMN "wp_import_run" varchar;
  ALTER TABLE "events" ADD COLUMN "location_address" varchar;
  ALTER TABLE "events" ADD COLUMN "organizer_name" varchar;
  ALTER TABLE "events" ADD COLUMN "timezone" varchar;
  ALTER TABLE "events" ADD COLUMN "all_day" boolean DEFAULT false;
  ALTER TABLE "events" ADD COLUMN "starts_at_local" varchar;
  ALTER TABLE "events" ADD COLUMN "ends_at_local" varchar;
  ALTER TABLE "events" ADD COLUMN "wp_id" numeric;
  ALTER TABLE "events" ADD COLUMN "wp_guid" varchar;
  ALTER TABLE "events" ADD COLUMN "wp_status" varchar;
  ALTER TABLE "events" ADD COLUMN "wp_password_protected" boolean;
  ALTER TABLE "events" ADD COLUMN "wp_review_flags" jsonb;
  ALTER TABLE "events" ADD COLUMN "wp_content_hash" varchar;
  ALTER TABLE "events" ADD COLUMN "wp_applied_hash" varchar;
  ALTER TABLE "events" ADD COLUMN "wp_import_run" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_location_address" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_organizer_name" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_timezone" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_all_day" boolean DEFAULT false;
  ALTER TABLE "_events_v" ADD COLUMN "version_starts_at_local" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_ends_at_local" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_id" numeric;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_guid" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_status" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_password_protected" boolean;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_review_flags" jsonb;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_content_hash" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_applied_hash" varchar;
  ALTER TABLE "_events_v" ADD COLUMN "version_wp_import_run" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "wp_id" numeric;
  ALTER TABLE "newsletters" ADD COLUMN "wp_guid" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "wp_status" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "wp_password_protected" boolean;
  ALTER TABLE "newsletters" ADD COLUMN "wp_review_flags" jsonb;
  ALTER TABLE "newsletters" ADD COLUMN "wp_content_hash" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "wp_applied_hash" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "wp_import_run" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_id" numeric;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_guid" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_status" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_password_protected" boolean;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_review_flags" jsonb;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_content_hash" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_applied_hash" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_wp_import_run" varchar;
  ALTER TABLE "initiatives" ADD COLUMN "wp_id" numeric;
  ALTER TABLE "initiatives" ADD COLUMN "wp_guid" varchar;
  ALTER TABLE "initiatives" ADD COLUMN "wp_status" varchar;
  ALTER TABLE "initiatives" ADD COLUMN "wp_password_protected" boolean;
  ALTER TABLE "initiatives" ADD COLUMN "wp_review_flags" jsonb;
  ALTER TABLE "initiatives" ADD COLUMN "wp_content_hash" varchar;
  ALTER TABLE "initiatives" ADD COLUMN "wp_applied_hash" varchar;
  ALTER TABLE "initiatives" ADD COLUMN "wp_import_run" varchar;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_id" numeric;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_guid" varchar;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_status" varchar;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_password_protected" boolean;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_review_flags" jsonb;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_content_hash" varchar;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_applied_hash" varchar;
  ALTER TABLE "_initiatives_v" ADD COLUMN "version_wp_import_run" varchar;
  ALTER TABLE "redirects" ADD COLUMN "wp_id" numeric;
  ALTER TABLE "redirects" ADD COLUMN "wp_content_hash" varchar;
  ALTER TABLE "redirects" ADD COLUMN "wp_applied_hash" varchar;
  ALTER TABLE "redirects" ADD COLUMN "wp_import_run" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wp_import_runs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wp_import_journal_id" integer;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_featured_media_id_media_id_fk" FOREIGN KEY ("version_featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_featured_media_id_media_id_fk" FOREIGN KEY ("version_featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_featured_media_idx" ON "posts" USING btree ("featured_media_id");
  CREATE UNIQUE INDEX "posts_wp_id_idx" ON "posts" USING btree ("wp_id");
  CREATE INDEX "posts_wp_import_run_idx" ON "posts" USING btree ("wp_import_run");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_featured_media_idx" ON "_posts_v" USING btree ("version_featured_media_id");
  CREATE INDEX "_posts_v_version_version_wp_id_idx" ON "_posts_v" USING btree ("version_wp_id");
  CREATE INDEX "_posts_v_version_version_wp_import_run_idx" ON "_posts_v" USING btree ("version_wp_import_run");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_featured_media_idx" ON "pages" USING btree ("featured_media_id");
  CREATE UNIQUE INDEX "pages_wp_id_idx" ON "pages" USING btree ("wp_id");
  CREATE INDEX "pages_wp_import_run_idx" ON "pages" USING btree ("wp_import_run");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_featured_media_idx" ON "_pages_v" USING btree ("version_featured_media_id");
  CREATE INDEX "_pages_v_version_version_wp_id_idx" ON "_pages_v" USING btree ("version_wp_id");
  CREATE INDEX "_pages_v_version_version_wp_import_run_idx" ON "_pages_v" USING btree ("version_wp_import_run");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "wp_import_runs_run_id_idx" ON "wp_import_runs" USING btree ("run_id");
  CREATE INDEX "wp_import_runs_updated_at_idx" ON "wp_import_runs" USING btree ("updated_at");
  CREATE INDEX "wp_import_runs_created_at_idx" ON "wp_import_runs" USING btree ("created_at");
  CREATE INDEX "wp_import_journal_run_id_idx" ON "wp_import_journal" USING btree ("run_id");
  CREATE INDEX "wp_import_journal_updated_at_idx" ON "wp_import_journal" USING btree ("updated_at");
  CREATE INDEX "wp_import_journal_created_at_idx" ON "wp_import_journal" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wp_import_runs_fk" FOREIGN KEY ("wp_import_runs_id") REFERENCES "public"."wp_import_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wp_import_journal_fk" FOREIGN KEY ("wp_import_journal_id") REFERENCES "public"."wp_import_journal"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "media_wp_id_idx" ON "media" USING btree ("wp_id");
  CREATE INDEX "media_wp_import_run_idx" ON "media" USING btree ("wp_import_run");
  CREATE UNIQUE INDEX "events_wp_id_idx" ON "events" USING btree ("wp_id");
  CREATE INDEX "events_wp_import_run_idx" ON "events" USING btree ("wp_import_run");
  CREATE INDEX "_events_v_version_version_wp_id_idx" ON "_events_v" USING btree ("version_wp_id");
  CREATE INDEX "_events_v_version_version_wp_import_run_idx" ON "_events_v" USING btree ("version_wp_import_run");
  CREATE UNIQUE INDEX "newsletters_wp_id_idx" ON "newsletters" USING btree ("wp_id");
  CREATE INDEX "newsletters_wp_import_run_idx" ON "newsletters" USING btree ("wp_import_run");
  CREATE INDEX "_newsletters_v_version_version_wp_id_idx" ON "_newsletters_v" USING btree ("version_wp_id");
  CREATE INDEX "_newsletters_v_version_version_wp_import_run_idx" ON "_newsletters_v" USING btree ("version_wp_import_run");
  CREATE UNIQUE INDEX "initiatives_wp_id_idx" ON "initiatives" USING btree ("wp_id");
  CREATE INDEX "initiatives_wp_import_run_idx" ON "initiatives" USING btree ("wp_import_run");
  CREATE INDEX "_initiatives_v_version_version_wp_id_idx" ON "_initiatives_v" USING btree ("version_wp_id");
  CREATE INDEX "_initiatives_v_version_version_wp_import_run_idx" ON "_initiatives_v" USING btree ("version_wp_import_run");
  CREATE UNIQUE INDEX "redirects_wp_id_idx" ON "redirects" USING btree ("wp_id");
  CREATE INDEX "redirects_wp_import_run_idx" ON "redirects" USING btree ("wp_import_run");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_wp_import_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("wp_import_runs_id");
  CREATE INDEX "payload_locked_documents_rels_wp_import_journal_id_idx" ON "payload_locked_documents_rels" USING btree ("wp_import_journal_id");`)
}

// Hand-adjusted: DROP TABLE ... CASCADE already removes the foreign keys and indexes of the dropped
// tables, so those later drops must tolerate absence for the rollback to run.
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wp_import_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wp_import_journal" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "wp_import_runs" CASCADE;
  DROP TABLE "wp_import_journal" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_wp_import_runs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_wp_import_journal_fk";
  
  DROP INDEX IF EXISTS "media_wp_id_idx";
  DROP INDEX IF EXISTS "media_wp_import_run_idx";
  DROP INDEX IF EXISTS "events_wp_id_idx";
  DROP INDEX IF EXISTS "events_wp_import_run_idx";
  DROP INDEX IF EXISTS "_events_v_version_version_wp_id_idx";
  DROP INDEX IF EXISTS "_events_v_version_version_wp_import_run_idx";
  DROP INDEX IF EXISTS "newsletters_wp_id_idx";
  DROP INDEX IF EXISTS "newsletters_wp_import_run_idx";
  DROP INDEX IF EXISTS "_newsletters_v_version_version_wp_id_idx";
  DROP INDEX IF EXISTS "_newsletters_v_version_version_wp_import_run_idx";
  DROP INDEX IF EXISTS "initiatives_wp_id_idx";
  DROP INDEX IF EXISTS "initiatives_wp_import_run_idx";
  DROP INDEX IF EXISTS "_initiatives_v_version_version_wp_id_idx";
  DROP INDEX IF EXISTS "_initiatives_v_version_version_wp_import_run_idx";
  DROP INDEX IF EXISTS "redirects_wp_id_idx";
  DROP INDEX IF EXISTS "redirects_wp_import_run_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_posts_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_wp_import_runs_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_wp_import_journal_id_idx";
  ALTER TABLE "media" DROP COLUMN "source_url";
  ALTER TABLE "media" DROP COLUMN "source_file";
  ALTER TABLE "media" DROP COLUMN "wp_id";
  ALTER TABLE "media" DROP COLUMN "wp_guid";
  ALTER TABLE "media" DROP COLUMN "wp_status";
  ALTER TABLE "media" DROP COLUMN "wp_password_protected";
  ALTER TABLE "media" DROP COLUMN "wp_review_flags";
  ALTER TABLE "media" DROP COLUMN "wp_content_hash";
  ALTER TABLE "media" DROP COLUMN "wp_applied_hash";
  ALTER TABLE "media" DROP COLUMN "wp_import_run";
  ALTER TABLE "events" DROP COLUMN "location_address";
  ALTER TABLE "events" DROP COLUMN "organizer_name";
  ALTER TABLE "events" DROP COLUMN "timezone";
  ALTER TABLE "events" DROP COLUMN "all_day";
  ALTER TABLE "events" DROP COLUMN "starts_at_local";
  ALTER TABLE "events" DROP COLUMN "ends_at_local";
  ALTER TABLE "events" DROP COLUMN "wp_id";
  ALTER TABLE "events" DROP COLUMN "wp_guid";
  ALTER TABLE "events" DROP COLUMN "wp_status";
  ALTER TABLE "events" DROP COLUMN "wp_password_protected";
  ALTER TABLE "events" DROP COLUMN "wp_review_flags";
  ALTER TABLE "events" DROP COLUMN "wp_content_hash";
  ALTER TABLE "events" DROP COLUMN "wp_applied_hash";
  ALTER TABLE "events" DROP COLUMN "wp_import_run";
  ALTER TABLE "_events_v" DROP COLUMN "version_location_address";
  ALTER TABLE "_events_v" DROP COLUMN "version_organizer_name";
  ALTER TABLE "_events_v" DROP COLUMN "version_timezone";
  ALTER TABLE "_events_v" DROP COLUMN "version_all_day";
  ALTER TABLE "_events_v" DROP COLUMN "version_starts_at_local";
  ALTER TABLE "_events_v" DROP COLUMN "version_ends_at_local";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_id";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_guid";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_status";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_password_protected";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_review_flags";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_content_hash";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_applied_hash";
  ALTER TABLE "_events_v" DROP COLUMN "version_wp_import_run";
  ALTER TABLE "newsletters" DROP COLUMN "wp_id";
  ALTER TABLE "newsletters" DROP COLUMN "wp_guid";
  ALTER TABLE "newsletters" DROP COLUMN "wp_status";
  ALTER TABLE "newsletters" DROP COLUMN "wp_password_protected";
  ALTER TABLE "newsletters" DROP COLUMN "wp_review_flags";
  ALTER TABLE "newsletters" DROP COLUMN "wp_content_hash";
  ALTER TABLE "newsletters" DROP COLUMN "wp_applied_hash";
  ALTER TABLE "newsletters" DROP COLUMN "wp_import_run";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_id";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_guid";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_status";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_password_protected";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_review_flags";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_content_hash";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_applied_hash";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_wp_import_run";
  ALTER TABLE "initiatives" DROP COLUMN "wp_id";
  ALTER TABLE "initiatives" DROP COLUMN "wp_guid";
  ALTER TABLE "initiatives" DROP COLUMN "wp_status";
  ALTER TABLE "initiatives" DROP COLUMN "wp_password_protected";
  ALTER TABLE "initiatives" DROP COLUMN "wp_review_flags";
  ALTER TABLE "initiatives" DROP COLUMN "wp_content_hash";
  ALTER TABLE "initiatives" DROP COLUMN "wp_applied_hash";
  ALTER TABLE "initiatives" DROP COLUMN "wp_import_run";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_id";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_guid";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_status";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_password_protected";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_review_flags";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_content_hash";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_applied_hash";
  ALTER TABLE "_initiatives_v" DROP COLUMN "version_wp_import_run";
  ALTER TABLE "redirects" DROP COLUMN "wp_id";
  ALTER TABLE "redirects" DROP COLUMN "wp_content_hash";
  ALTER TABLE "redirects" DROP COLUMN "wp_applied_hash";
  ALTER TABLE "redirects" DROP COLUMN "wp_import_run";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wp_import_runs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wp_import_journal_id";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_wp_import_runs_status";
  DROP TYPE "public"."enum_wp_import_journal_action";`)
}
