import { drizzle } from 'drizzle-orm/d1';
import { users, sources, notes, syncCredentials } from './schema';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type SyncCredential = typeof syncCredentials.$inferSelect;
export type NewSyncCredential = typeof syncCredentials.$inferInsert;