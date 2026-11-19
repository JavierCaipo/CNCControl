CREATE TABLE `shared_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_id` text NOT NULL,
	`updated_by_name` text NOT NULL
);
