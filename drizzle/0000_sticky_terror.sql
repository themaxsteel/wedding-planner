CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`bank_name` text,
	`account_number` text,
	`holder_name` text,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `account_group`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `account_group_idx` ON `account` (`group_id`);--> statement-breakpoint
CREATE TABLE `account_group` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'bank' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "account_group_type_valid" CHECK("account_group"."type" IN ('bank','cash','ewallet','other'))
);
--> statement-breakpoint
CREATE TABLE `attachment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer,
	`payment_id` integer,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachment_transaction_idx` ON `attachment` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `attachment_payment_idx` ON `attachment` (`payment_id`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`budget_amount` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT 'neutral' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "category_kind_valid" CHECK("category"."kind" IN ('expense','income')),
	CONSTRAINT "category_budget_nonneg" CHECK("category"."budget_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `category_parent_idx` ON `category` (`parent_id`);--> statement-breakpoint
CREATE INDEX `category_kind_idx` ON `category` (`kind`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT 'Wedding' NOT NULL,
	`bride_name` text,
	`groom_name` text,
	`event_date` text,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`total_budget_target` integer DEFAULT 0 NOT NULL,
	`setup_completed_at` integer,
	`setup_step` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` integer NOT NULL,
	`method` text DEFAULT 'transfer' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_amount_positive" CHECK("payment"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `payment_transaction_idx` ON `payment` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `payment_account_idx` ON `payment` (`account_id`);--> statement-breakpoint
CREATE INDEX `payment_date_idx` ON `payment` (`date`);--> statement-breakpoint
CREATE TABLE `supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category_id` integer,
	`contact_person` text,
	`phone` text,
	`email` text,
	`bank_name` text,
	`bank_account` text,
	`note` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `supplier_category_idx` ON `supplier` (`category_id`);--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` integer NOT NULL,
	`to_account_id` integer,
	`category_id` integer,
	`supplier_id` integer,
	`payment_status` text DEFAULT 'paid' NOT NULL,
	`due_date` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transaction_type_valid" CHECK("transaction"."type" IN ('expense','income','transfer')),
	CONSTRAINT "transaction_amount_positive" CHECK("transaction"."amount" > 0),
	CONSTRAINT "transaction_status_valid" CHECK("transaction"."payment_status" IN ('paid','partial','unpaid')),
	CONSTRAINT "transaction_transfer_shape" CHECK(("transaction"."type" <> 'transfer') OR ("transaction"."to_account_id" IS NOT NULL AND "transaction"."to_account_id" <> "transaction"."account_id" AND "transaction"."category_id" IS NULL)),
	CONSTRAINT "transaction_nontransfer_shape" CHECK(("transaction"."type" = 'transfer') OR ("transaction"."category_id" IS NOT NULL AND "transaction"."to_account_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `transaction` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_type_idx` ON `transaction` (`type`);--> statement-breakpoint
CREATE INDEX `transaction_category_idx` ON `transaction` (`category_id`);--> statement-breakpoint
CREATE INDEX `transaction_account_idx` ON `transaction` (`account_id`);--> statement-breakpoint
CREATE INDEX `transaction_supplier_idx` ON `transaction` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `transaction_status_idx` ON `transaction` (`payment_status`);