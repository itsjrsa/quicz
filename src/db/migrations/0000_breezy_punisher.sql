CREATE TABLE `choices` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`text` text NOT NULL,
	`is_correct` integer DEFAULT 0 NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_question_index` integer DEFAULT 0 NOT NULL,
	`phase` text DEFAULT 'lobby' NOT NULL,
	`answers_visible` integer DEFAULT 0 NOT NULL,
	`correct_revealed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_sessions_code_unique` ON `live_sessions` (`code`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`choice_ids` text NOT NULL,
	`is_correct` integer,
	`points_earned` integer,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_participant_session_question_idx` ON `responses` (`participant_id`,`session_id`,`question_id`);