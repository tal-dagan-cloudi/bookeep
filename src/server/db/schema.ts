import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// Enums
export const orgMemberRole = pgEnum("org_member_role", [
  "owner",
  "admin",
  "member",
  "viewer",
  "accountant",
])

export const emailProvider = pgEnum("email_provider", [
  "gmail",
  "outlook",
  "imap",
])

export const syncStatus = pgEnum("sync_status", [
  "idle",
  "syncing",
  "error",
])

export const documentSource = pgEnum("document_source", [
  "email",
  "whatsapp",
  "upload",
  "chrome_extension",
  "ecommerce",
  "forwarding",
])

export const documentStatus = pgEnum("document_status", [
  "pending",
  "processing",
  "ready",
  "reviewed",
  "exported",
  "trash",
])

export const documentType = pgEnum("document_type", [
  "receipt",
  "invoice",
  "bill",
  "purchase_order",
  "credit_note",
  "other",
])

export const automationTriggerType = pgEnum("automation_trigger_type", [
  "vendor_match",
  "amount_range",
  "source_match",
])

export const automationActionType = pgEnum("automation_action_type", [
  "assign_category",
  "assign_entity",
  "auto_delete",
  "mark_reviewed",
])

export const exportType = pgEnum("export_type", [
  "email",
  "gdrive",
  "dropbox",
  "csv",
  "excel",
  "pdf",
])

export const exportStatus = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
])

// Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  locale: varchar("locale", { length: 10 }).default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  plan: varchar("plan", { length: 50 }).default("free").notNull(),
  billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"),
  bluesnapCustomerId: varchar("bluesnap_customer_id", { length: 255 }),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }).unique(),
  forwardingEmail: varchar("forwarding_email", { length: 255 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const orgMembers = pgTable("org_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: orgMemberRole("role").default("member").notNull(),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
})

export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  provider: emailProvider("provider").notNull(),
  emailAddress: varchar("email_address", { length: 255 }).notNull(),
  oauthTokenEncrypted: text("oauth_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  imapHost: varchar("imap_host", { length: 255 }),
  imapPort: integer("imap_port"),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: syncStatus("sync_status").default("idle").notNull(),
  historicalScanMonths: integer("historical_scan_months").default(12),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  source: documentSource("source").notNull(),
  sourceEmailAccountId: uuid("source_email_account_id").references(
    () => emailAccounts.id
  ),
  sourceRef: varchar("source_ref", { length: 500 }).unique(),
  sourceMetadata: jsonb("source_metadata"),
  status: documentStatus("status").default("pending").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const extractedData = pgTable("extracted_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" })
    .unique(),
  vendorName: varchar("vendor_name", { length: 500 }),
  vendorAddress: text("vendor_address"),
  documentDate: timestamp("document_date"),
  receivedDate: timestamp("received_date"),
  documentType: documentType("document_type"),
  documentNumber: varchar("document_number", { length: 255 }),
  totalAmount: real("total_amount"),
  totalTax: real("total_tax"),
  currency: varchar("currency", { length: 10 }).default("USD"),
  lineItems: jsonb("line_items").$type<
    Array<{
      description: string
      quantity: number
      unitPrice: number
      total: number
      tax: number
    }>
  >(),
  rawOcrText: text("raw_ocr_text"),
  confidenceScore: real("confidence_score"),
  extractionModel: varchar("extraction_model", { length: 100 }),
  isUserEdited: boolean("is_user_edited").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }),
  icon: varchar("icon", { length: 50 }),
  isDefault: boolean("is_default").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const businessEntities = pgTable("business_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const documentCategorization = pgTable("document_categorization", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" })
    .unique(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  businessEntityId: uuid("business_entity_id").references(
    () => businessEntities.id,
    { onDelete: "set null" }
  ),
  assignedBy: varchar("assigned_by", { length: 50 }).default("user"),
})

export const automationRules = pgTable("automation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  triggerType: automationTriggerType("trigger_type").notNull(),
  triggerValue: varchar("trigger_value", { length: 500 }).notNull(),
  actionType: automationActionType("action_type").notNull(),
  actionValue: varchar("action_value", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const exports = pgTable("exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  exportType: exportType("export_type").notNull(),
  documentIds: jsonb("document_ids").$type<string[]>().notNull(),
  status: exportStatus("status").default("pending").notNull(),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookEndpointId: uuid("webhook_endpoint_id")
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  attempts: integer("attempts").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
