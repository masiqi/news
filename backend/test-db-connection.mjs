import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userAutoStorageConfigs, userStorageLogs, userStorageStats } from '../src/db/schema';

export default {
  async fetch(request, env, ctx) {
    try {
      const db = drizzle(env.DB);
      
      // 测试获取用户配置
      const config = await db
        .select()
        .from(userAutoStorageConfigs)
        .where(eq(userAutoStorageConfigs.userId, 1))
        .get();

      return new Response(JSON.stringify({
        success: true,
        config: config,
        message: '数据库连接测试成功'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};