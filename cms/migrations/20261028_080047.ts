import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'admin');
  CREATE TYPE "public"."enum_events_category" AS ENUM('music', 'food', 'community');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_category" AS ENUM('music', 'food', 'community');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_newsletters_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__newsletters_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_initiatives_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__initiatives_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_redirects_status_code" AS ENUM('301', '302');
  CREATE TABLE "users_sessions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone,
	"expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" varchar NOT NULL,
	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"email" varchar NOT NULL,
	"reset_password_token" varchar,
	"reset_password_expiration" timestamp(3) with time zone,
	"salt" varchar,
	"hash" varchar,
	"reset_password_requested_at" timestamp(3) with time zone,
	"login_attempts" numeric DEFAULT 0,
	"lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"alt" varchar NOT NULL,
	"caption" varchar,
	"public" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"url" varchar,
	"thumbnail_u_r_l" varchar,
	"filename" varchar,
	"mime_type" varchar,
	"filesize" numeric,
	"width" numeric,
	"height" numeric,
	"focal_x" numeric,
	"focal_y" numeric
  );

  CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar,
	"title" varchar,
	"summary" varchar,
	"starts_at" timestamp(3) with time zone,
	"ends_at" timestamp(3) with time zone,
	"category" "enum_events_category",
	"location_name" varchar,
	"body" varchar,
	"cover_image_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "enum_events_status" DEFAULT 'draft'
  );

  CREATE TABLE "_events_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"version_slug" varchar,
	"version_title" varchar,
	"version_summary" varchar,
	"version_starts_at" timestamp(3) with time zone,
	"version_ends_at" timestamp(3) with time zone,
	"version_category" "enum__events_v_version_category",
	"version_location_name" varchar,
	"version_body" varchar,
	"version_cover_image_id" integer,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean
  );

  CREATE TABLE "newsletters" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar,
	"title" varchar,
	"issue_date" timestamp(3) with time zone,
	"summary" varchar,
	"issue_pdf_id" integer,
	"cover_image_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "enum_newsletters_status" DEFAULT 'draft'
  );

  CREATE TABLE "_newsletters_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"version_slug" varchar,
	"version_title" varchar,
	"version_issue_date" timestamp(3) with time zone,
	"version_summary" varchar,
	"version_issue_pdf_id" integer,
	"version_cover_image_id" integer,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "enum__newsletters_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean
  );

  CREATE TABLE "initiatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar,
	"title" varchar,
	"summary" varchar,
	"body" varchar,
	"cta_label" varchar,
	"cta_url" varchar,
	"cover_image_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "enum_initiatives_status" DEFAULT 'draft'
  );

  CREATE TABLE "_initiatives_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"version_slug" varchar,
	"version_title" varchar,
	"version_summary" varchar,
	"version_body" varchar,
	"version_cta_label" varchar,
	"version_cta_url" varchar,
	"version_cover_image_id" integer,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "enum__initiatives_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean
  );

  CREATE TABLE "redirects" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_path" varchar NOT NULL,
	"destination_url" varchar NOT NULL,
	"status_code" "enum_redirects_status_code" DEFAULT '302' NOT NULL,
	"active" boolean DEFAULT false,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_kv" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"global_slug" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"users_id" integer,
	"media_id" integer,
	"events_id" integer,
	"newsletters_id" integer,
	"initiatives_id" integer,
	"redirects_id" integer
  );

  CREATE TABLE "payload_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar,
	"value" jsonb,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"users_id" integer
  );

  CREATE TABLE "payload_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar,
	"batch" numeric,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_issue_pdf_id_media_id_fk" FOREIGN KEY ("issue_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_parent_id_newsletters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_version_issue_pdf_id_media_id_fk" FOREIGN KEY ("version_issue_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_initiatives_v" ADD CONSTRAINT "_initiatives_v_parent_id_initiatives_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."initiatives"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_initiatives_v" ADD CONSTRAINT "_initiatives_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletters_fk" FOREIGN KEY ("newsletters_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_initiatives_fk" FOREIGN KEY ("initiatives_id") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_cover_image_idx" ON "events" USING btree ("cover_image_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_cover_image_idx" ON "_events_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE UNIQUE INDEX "newsletters_slug_idx" ON "newsletters" USING btree ("slug");
  CREATE INDEX "newsletters_issue_pdf_idx" ON "newsletters" USING btree ("issue_pdf_id");
  CREATE INDEX "newsletters_cover_image_idx" ON "newsletters" USING btree ("cover_image_id");
  CREATE INDEX "newsletters_updated_at_idx" ON "newsletters" USING btree ("updated_at");
  CREATE INDEX "newsletters_created_at_idx" ON "newsletters" USING btree ("created_at");
  CREATE INDEX "newsletters__status_idx" ON "newsletters" USING btree ("_status");
  CREATE INDEX "_newsletters_v_parent_idx" ON "_newsletters_v" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_version_version_slug_idx" ON "_newsletters_v" USING btree ("version_slug");
  CREATE INDEX "_newsletters_v_version_version_issue_pdf_idx" ON "_newsletters_v" USING btree ("version_issue_pdf_id");
  CREATE INDEX "_newsletters_v_version_version_cover_image_idx" ON "_newsletters_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_newsletters_v_version_version_updated_at_idx" ON "_newsletters_v" USING btree ("version_updated_at");
  CREATE INDEX "_newsletters_v_version_version_created_at_idx" ON "_newsletters_v" USING btree ("version_created_at");
  CREATE INDEX "_newsletters_v_version_version__status_idx" ON "_newsletters_v" USING btree ("version__status");
  CREATE INDEX "_newsletters_v_created_at_idx" ON "_newsletters_v" USING btree ("created_at");
  CREATE INDEX "_newsletters_v_updated_at_idx" ON "_newsletters_v" USING btree ("updated_at");
  CREATE INDEX "_newsletters_v_latest_idx" ON "_newsletters_v" USING btree ("latest");
  CREATE UNIQUE INDEX "initiatives_slug_idx" ON "initiatives" USING btree ("slug");
  CREATE INDEX "initiatives_cover_image_idx" ON "initiatives" USING btree ("cover_image_id");
  CREATE INDEX "initiatives_updated_at_idx" ON "initiatives" USING btree ("updated_at");
  CREATE INDEX "initiatives_created_at_idx" ON "initiatives" USING btree ("created_at");
  CREATE INDEX "initiatives__status_idx" ON "initiatives" USING btree ("_status");
  CREATE INDEX "_initiatives_v_parent_idx" ON "_initiatives_v" USING btree ("parent_id");
  CREATE INDEX "_initiatives_v_version_version_slug_idx" ON "_initiatives_v" USING btree ("version_slug");
  CREATE INDEX "_initiatives_v_version_version_cover_image_idx" ON "_initiatives_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_initiatives_v_version_version_updated_at_idx" ON "_initiatives_v" USING btree ("version_updated_at");
  CREATE INDEX "_initiatives_v_version_version_created_at_idx" ON "_initiatives_v" USING btree ("version_created_at");
  CREATE INDEX "_initiatives_v_version_version__status_idx" ON "_initiatives_v" USING btree ("version__status");
  CREATE INDEX "_initiatives_v_created_at_idx" ON "_initiatives_v" USING btree ("created_at");
  CREATE INDEX "_initiatives_v_updated_at_idx" ON "_initiatives_v" USING btree ("updated_at");
  CREATE INDEX "_initiatives_v_latest_idx" ON "_initiatives_v" USING btree ("latest");
  CREATE UNIQUE INDEX "redirects_source_path_idx" ON "redirects" USING btree ("source_path");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_newsletters_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletters_id");
  CREATE INDEX "payload_locked_documents_rels_initiatives_id_idx" ON "payload_locked_documents_rels" USING btree ("initiatives_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "newsletters" CASCADE;
  DROP TABLE "_newsletters_v" CASCADE;
  DROP TABLE "initiatives" CASCADE;
  DROP TABLE "_initiatives_v" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_events_category";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_category";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum_newsletters_status";
  DROP TYPE "public"."enum__newsletters_v_version_status";
  DROP TYPE "public"."enum_initiatives_status";
  DROP TYPE "public"."enum__initiatives_v_version_status";
  DROP TYPE "public"."enum_redirects_status_code";`)
}
