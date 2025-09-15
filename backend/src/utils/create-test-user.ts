import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from './src/db/schema';

export default async function createTestUser(env: CloudflareBindings) {
  const db = drizzle(env.DB);
  
  try {
    // 检查是否已存在测试用户
    const existingUser = await db.select().from(users).where(eq(users.email, 'test@example.com')).get();
    
    if (existingUser) {
      console.log('测试用户已存在:', existingUser);
      return existingUser;
    }
    
    // 创建新用户
    const newUser = await db.insert(users).values({
      email: 'test@example.com',
      password: '$2b$10$rOZXp7mGXmHWK7vJtxB7uO5D3Q7J8Y.k9W2mQ7J8Y.k9W2mQ7J8Y.k9W2', // 密码: password123
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning().get();
    
    console.log('测试用户创建成功:', newUser);
    return newUser;
  } catch (error) {
    console.error('创建测试用户失败:', error);
    throw error;
  }
}