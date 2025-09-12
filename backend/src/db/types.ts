import { drizzle } from 'drizzle-orm/d1';
import { 
  users, 
  sources, 
  notes, 
  syncCredentials, 
  rssEntries, 
  processedContents, 
  userNotes,
  userRoles,
  userPermissions,
  userRoleRelations,
  userOperationLogs,
  userSessions,
  userSettings
} from './schema';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type RssEntry = typeof rssEntries.$inferSelect;
export type NewRssEntry = typeof rssEntries.$inferInsert;

export type ProcessedContent = typeof processedContents.$inferSelect;
export type NewProcessedContent = typeof processedContents.$inferInsert;

export type UserNote = typeof userNotes.$inferSelect;
export type NewUserNote = typeof userNotes.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type SyncCredential = typeof syncCredentials.$inferSelect;
export type NewSyncCredential = typeof syncCredentials.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;

export type UserRoleRelation = typeof userRoleRelations.$inferSelect;
export type NewUserRoleRelation = typeof userRoleRelations.$inferInsert;

export type UserOperationLog = typeof userOperationLogs.$inferSelect;
export type NewUserOperationLog = typeof userOperationLogs.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;