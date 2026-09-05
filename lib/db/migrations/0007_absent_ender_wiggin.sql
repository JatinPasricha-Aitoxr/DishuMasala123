ALTER TABLE "users" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_uniq" ON "users" USING btree ("auth_user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";