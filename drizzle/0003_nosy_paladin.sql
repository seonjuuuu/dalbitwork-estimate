ALTER TABLE `documents` ADD `notesMode` enum('list','freeform') DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `freeformNotes` text;--> statement-breakpoint
ALTER TABLE `note_templates` ADD `mode` enum('list','freeform') DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE `note_templates` ADD `freeformNotes` text;