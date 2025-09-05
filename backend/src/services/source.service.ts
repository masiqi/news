// src/services/source.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { sources, users } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { Source, NewSource } from '../db/types';
import type { User, NewUser } from '../db/types';

export class SourceService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 创建新的RSS源
   * @param source RSS源数据
   * @returns 创建的RSS源
   */
  async createSource(source: NewSource): Promise<Source> {
    const result = await this.db.insert(sources).values(source).returning();
    return result[0];
  }

  /**
   * 获取用户的所有RSS源
   * @param userId 用户ID
   * @returns 用户的RSS源列表
   */
  async getUserSources(userId: number): Promise<Source[]> {
    return await this.db.select().from(sources).where(eq(sources.userId, userId));
  }

  /**
   * 获取所有公共RSS源
   * @returns 公共RSS源列表
   */
  async getPublicSources(): Promise<Source[]> {
    return await this.db.select().from(sources).where(eq(sources.isPublic, true));
  }

  /**
   * 根据ID获取RSS源
   * @param id RSS源ID
   * @param userId 用户ID（用于权限检查）
   * @returns RSS源信息
   */
  async getSourceById(id: number, userId?: number): Promise<Source | null> {
    const conditions = [eq(sources.id, id)];
    
    // 如果提供了用户ID，只返回用户自己的源或公共源
    if (userId) {
      conditions.push(or(eq(sources.userId, userId), eq(sources.isPublic, true)));
    }
    
    const result = await this.db.select().from(sources).where(and(...conditions)).limit(1);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 更新RSS源
   * @param id RSS源ID
   * @param source 更新的RSS源数据
   * @param userId 用户ID（用于权限检查）
   * @returns 更新后的RSS源
   */
  async updateSource(id: number, source: Partial<Source>, userId: number): Promise<Source | null> {
    // 检查用户是否有权限更新此源
    const existingSource = await this.getSourceById(id, userId);
    if (!existingSource || existingSource.userId !== userId) {
      return null;
    }

    const result = await this.db.update(sources)
      .set(source)
      .where(and(eq(sources.id, id), eq(sources.userId, userId)))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 删除RSS源
   * @param id RSS源ID
   * @param userId 用户ID（用于权限检查）
   * @returns 删除是否成功
   */
  async deleteSource(id: number, userId: number): Promise<boolean> {
    // 检查用户是否有权限删除此源
    const existingSource = await this.getSourceById(id, userId);
    if (!existingSource || existingSource.userId !== userId) {
      return false;
    }

    const result = await this.db.delete(sources)
      .where(and(eq(sources.id, id), eq(sources.userId, userId)));
    
    return result.rowsAffected > 0;
  }

  /**
   * 复制公共RSS源到用户账户
   * @param sourceId 要复制的源ID
   * @param userId 目标用户ID
   * @returns 复制后的RSS源
   */
  async copySource(sourceId: number, userId: number): Promise<Source | null> {
    // 获取要复制的源
    const sourceToCopy = await this.getSourceById(sourceId);
    if (!sourceToCopy || !sourceToCopy.isPublic) {
      return null;
    }

    // 创建新的源，保留原始信息但关联到新用户
    const newSource: NewSource = {
      userId,
      url: sourceToCopy.url,
      name: `${sourceToCopy.name} (副本)`,
      description: sourceToCopy.description, // 复制描述字段
      isPublic: false, // 复制的源默认为私有
      originalSourceId: sourceToCopy.id, // 记录原始源ID
      createdAt: new Date(),
    };

    return await this.createSource(newSource);
  }

  /**
   * 创建系统用户（ID=1）用于提供公共源
   * @returns 系统用户
   */
  async createSystemUser(): Promise<User> {
    // 检查系统用户是否已存在
    const existingUser = await this.db.select().from(users).where(eq(users.id, 1)).limit(1);
    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // 创建系统用户
    const systemUser: NewUser = {
      id: 1,
      email: 'system@rss-platform.com',
      passwordHash: '', // 系统用户不需要密码
      createdAt: new Date(),
    };

    const result = await this.db.insert(users).values(systemUser).returning();
    return result[0];
  }
}