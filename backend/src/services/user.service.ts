// src/services/user.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { User, NewUser } from '../db/types';

export class UserService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 创建新用户
   * @param user 用户数据
   * @returns 创建的用户
   */
  async createUser(user: NewUser): Promise<User> {
    try {
      console.log('尝试创建用户:', user);
      const result = await this.db.insert(users).values(user).returning();
      console.log('用户创建结果:', result);
      return result[0];
    } catch (error) {
      console.error('创建用户时发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取所有用户
   * @returns 用户列表
   */
  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  /**
   * 根据ID获取用户
   * @param id 用户ID
   * @returns 用户信息
   */
  async getUserById(id: number): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 根据邮箱获取用户
   * @param email 用户邮箱
   * @returns 用户信息
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 更新用户
   * @param id 用户ID
   * @param user 更新的用户数据
   * @returns 更新后的用户
   */
  async updateUser(id: number, user: Partial<User>): Promise<User | null> {
    const result = await this.db.update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 删除用户
   * @param id 用户ID
   * @returns 删除是否成功
   */
  async deleteUser(id: number): Promise<boolean> {
    try {
      console.log('尝试删除用户，ID:', id);
      // 先检查用户是否存在
      const existingUser = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      if (existingUser.length === 0) {
        console.log('用户不存在，ID:', id);
        return false;
      }
      
      // 执行删除操作
      const result = await this.db.delete(users).where(eq(users.id, id));
      console.log('删除操作结果:', result);
      
      // 检查是否成功删除
      const afterDelete = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      const deleted = afterDelete.length === 0;
      console.log('删除后检查，用户是否还存在:', !deleted);
      return deleted;
    } catch (error) {
      console.error('删除用户时发生错误:', error);
      throw error;
    }
  }
}