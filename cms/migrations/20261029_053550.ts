import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_member_stories_audience" AS ENUM('community', 'group');
  CREATE TYPE "public"."enum_mentorship_requests_status" AS ENUM('pending', 'accepted', 'declined');
  CREATE TABLE "member_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"display_name" varchar NOT NULL,
  	"class_year" numeric,
  	"bio" varchar,
  	"interests" varchar,
  	"directory_visible" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_stories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"author_name" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"audience" "enum_member_stories_audience" DEFAULT 'community' NOT NULL,
  	"group_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"owner_name" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "group_memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"group_id" integer NOT NULL,
  	"membership_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mentorship_offers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"opt_in" boolean DEFAULT false NOT NULL,
  	"display_name" varchar NOT NULL,
  	"topics" varchar,
  	"about" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mentorship_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"requester_id" integer NOT NULL,
  	"mentor_id" integer NOT NULL,
  	"requester_name" varchar NOT NULL,
  	"mentor_name" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"reply" varchar,
  	"status" "enum_mentorship_requests_status" DEFAULT 'pending' NOT NULL,
  	"request_key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_profiles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_stories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_groups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "group_memberships_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mentorship_offers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mentorship_requests_id" integer;
  ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_stories" ADD CONSTRAINT "member_stories_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_stories" ADD CONSTRAINT "member_stories_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_owner_id_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mentorship_offers" ADD CONSTRAINT "mentorship_offers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_requester_id_members_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentor_id_members_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "member_profiles_member_idx" ON "member_profiles" USING btree ("member_id");
  CREATE INDEX "member_profiles_updated_at_idx" ON "member_profiles" USING btree ("updated_at");
  CREATE INDEX "member_profiles_created_at_idx" ON "member_profiles" USING btree ("created_at");
  CREATE INDEX "member_stories_author_idx" ON "member_stories" USING btree ("author_id");
  CREATE INDEX "member_stories_group_idx" ON "member_stories" USING btree ("group_id");
  CREATE INDEX "member_stories_updated_at_idx" ON "member_stories" USING btree ("updated_at");
  CREATE INDEX "member_stories_created_at_idx" ON "member_stories" USING btree ("created_at");
  CREATE INDEX "member_groups_owner_idx" ON "member_groups" USING btree ("owner_id");
  CREATE INDEX "member_groups_updated_at_idx" ON "member_groups" USING btree ("updated_at");
  CREATE INDEX "member_groups_created_at_idx" ON "member_groups" USING btree ("created_at");
  CREATE INDEX "group_memberships_member_idx" ON "group_memberships" USING btree ("member_id");
  CREATE INDEX "group_memberships_group_idx" ON "group_memberships" USING btree ("group_id");
  CREATE UNIQUE INDEX "group_memberships_membership_key_idx" ON "group_memberships" USING btree ("membership_key");
  CREATE INDEX "group_memberships_updated_at_idx" ON "group_memberships" USING btree ("updated_at");
  CREATE INDEX "group_memberships_created_at_idx" ON "group_memberships" USING btree ("created_at");
  CREATE UNIQUE INDEX "mentorship_offers_member_idx" ON "mentorship_offers" USING btree ("member_id");
  CREATE INDEX "mentorship_offers_updated_at_idx" ON "mentorship_offers" USING btree ("updated_at");
  CREATE INDEX "mentorship_offers_created_at_idx" ON "mentorship_offers" USING btree ("created_at");
  CREATE INDEX "mentorship_requests_requester_idx" ON "mentorship_requests" USING btree ("requester_id");
  CREATE INDEX "mentorship_requests_mentor_idx" ON "mentorship_requests" USING btree ("mentor_id");
  CREATE UNIQUE INDEX "mentorship_requests_request_key_idx" ON "mentorship_requests" USING btree ("request_key");
  CREATE INDEX "mentorship_requests_updated_at_idx" ON "mentorship_requests" USING btree ("updated_at");
  CREATE INDEX "mentorship_requests_created_at_idx" ON "mentorship_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_profiles_fk" FOREIGN KEY ("member_profiles_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_stories_fk" FOREIGN KEY ("member_stories_id") REFERENCES "public"."member_stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_groups_fk" FOREIGN KEY ("member_groups_id") REFERENCES "public"."member_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_group_memberships_fk" FOREIGN KEY ("group_memberships_id") REFERENCES "public"."group_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mentorship_offers_fk" FOREIGN KEY ("mentorship_offers_id") REFERENCES "public"."mentorship_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mentorship_requests_fk" FOREIGN KEY ("mentorship_requests_id") REFERENCES "public"."mentorship_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_member_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("member_profiles_id");
  CREATE INDEX "payload_locked_documents_rels_member_stories_id_idx" ON "payload_locked_documents_rels" USING btree ("member_stories_id");
  CREATE INDEX "payload_locked_documents_rels_member_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("member_groups_id");
  CREATE INDEX "payload_locked_documents_rels_group_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("group_memberships_id");
  CREATE INDEX "payload_locked_documents_rels_mentorship_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("mentorship_offers_id");
  CREATE INDEX "payload_locked_documents_rels_mentorship_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("mentorship_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "member_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "group_memberships" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mentorship_offers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mentorship_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "member_profiles" CASCADE;
  DROP TABLE "member_stories" CASCADE;
  DROP TABLE "member_groups" CASCADE;
  DROP TABLE "group_memberships" CASCADE;
  DROP TABLE "mentorship_offers" CASCADE;
  DROP TABLE "mentorship_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_profiles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_stories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_groups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_group_memberships_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_mentorship_offers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_mentorship_requests_fk";
  
  DROP INDEX "payload_locked_documents_rels_member_profiles_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_stories_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_groups_id_idx";
  DROP INDEX "payload_locked_documents_rels_group_memberships_id_idx";
  DROP INDEX "payload_locked_documents_rels_mentorship_offers_id_idx";
  DROP INDEX "payload_locked_documents_rels_mentorship_requests_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_profiles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_stories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_groups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "group_memberships_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mentorship_offers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mentorship_requests_id";
  DROP TYPE "public"."enum_member_stories_audience";
  DROP TYPE "public"."enum_mentorship_requests_status";`)
}
