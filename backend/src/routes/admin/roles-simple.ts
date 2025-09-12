// 简化版角色管理路由
import { Hono } from 'hono';
import { initDB } from '../../db/index-simple';
import { userRoles, userPermissions } from '../../db/schema-simple';
import { eq, and, or, like, desc, asc, count } from 'drizzle-orm';

const adminRolesRoutes = new Hono();

// 获取角色列表
adminRolesRoutes.get('/', async (c) => {
  try {
    const { search, isActive } = c.req.query();
    
    const db = initDB(c.env.DB);
    
    let whereConditions = [];
    
    if (isActive !== undefined) {
      whereConditions.push(eq(userRoles.isActive, isActive === 'true'));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(userRoles.name, `%${search}%`),
          like(userRoles.description, `%${search}%`)
        )
      );
    }

    let query = db.select().from(userRoles);
    
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    query = query.orderBy(desc(userRoles.createdAt));

    const roles = await query;
    
    return c.json({
      success: true,
      data: { roles }
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return c.json({ success: false, error: '获取角色列表失败' }, 500);
  }
});

// 获取权限列表
adminRolesRoutes.get('/permissions', async (c) => {
  try {
    const { search, resource, isSystem } = c.req.query();
    
    const db = initDB(c.env.DB);
    
    let whereConditions = [];
    
    if (isSystem !== undefined) {
      whereConditions.push(eq(userPermissions.isSystemPermission, isSystem === 'true'));
    }
    
    if (resource) {
      whereConditions.push(eq(userPermissions.resource, resource));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(userPermissions.name, `%${search}%`),
          like(userPermissions.description, `%${search}%`)
        )
      );
    }

    let query = db.select().from(userPermissions);
    
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    query = query.orderBy(asc(userPermissions.resource), asc(userPermissions.action));

    const permissions = await query;
    
    return c.json({
      success: true,
      data: { permissions }
    });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    return c.json({ success: false, error: '获取权限列表失败' }, 500);
  }
});

export default adminRolesRoutes;