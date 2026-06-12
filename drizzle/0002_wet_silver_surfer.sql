CREATE TABLE `free_scan_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`quizResult` enum('rebuild','restart') NOT NULL,
	`scanData` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `free_scan_submissions_id` PRIMARY KEY(`id`)
);
