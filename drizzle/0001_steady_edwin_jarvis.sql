CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('proposal','estimate') NOT NULL,
	`title` varchar(500) NOT NULL DEFAULT '',
	`memo` text,
	`clientName` varchar(500) NOT NULL DEFAULT '',
	`projectName` varchar(500) NOT NULL DEFAULT '',
	`platform` varchar(200) NOT NULL DEFAULT '',
	`date` varchar(20) NOT NULL DEFAULT '',
	`items` json NOT NULL,
	`notes` json NOT NULL,
	`totalMin` int NOT NULL DEFAULT 0,
	`totalMax` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
