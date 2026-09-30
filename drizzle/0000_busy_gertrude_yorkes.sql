CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`client` text NOT NULL,
	`service_id` text NOT NULL,
	`professional_id` text NOT NULL,
	`date` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `demo_spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_appointments_space_date` ON `appointments` (`space_id`,`date`);--> statement-breakpoint
CREATE TABLE `demo_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `occupied_slots` (
	`space_id` text NOT NULL,
	`professional_id` text NOT NULL,
	`date` text NOT NULL,
	`minute` integer NOT NULL,
	`appointment_id` text NOT NULL,
	PRIMARY KEY(`space_id`, `professional_id`, `date`, `minute`),
	FOREIGN KEY (`space_id`) REFERENCES `demo_spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_slots_appointment` ON `occupied_slots` (`appointment_id`);
