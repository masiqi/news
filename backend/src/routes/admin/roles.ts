// src/routes/admin/roles.ts
import { Hono } from 'hono';
import { adminAuthMiddleware, adminAuditMiddleware } from '../../middleware/admin-auth.middleware';
import { RolePermissionService } from '../../services/admin/role-permission.service';
import { AuditLogService } from '../../services/admin/audit-log.service';
import { getCurrentUser } from '../../middleware/admin-auth.middleware';

const roleRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用管理员认证和审计中间件
roleRoutes.use('*', adminAuthMiddleware, adminAuditMiddleware);

// 角色权限管理服务实例化
roleRoutes.use('*', async (c, next) => {
  const roleService = new RolePermissionService(c.env.DB);
  const auditService = new AuditLogService(c.env.DB);
  
  c.set('roleService', roleService);
  c.set('auditService', auditService);
  
  await next();
});

/**
 * 获取角色列表
 * GET /api/admin/roles
 */
roleRoutes.get('/', async (c) => {
  try {
    const roleService = c.get('roleService');
    const query = c.req.query();
    
    const params = {
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 20,
      search: query.search as string,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      isSystemRole: query.isSystemRole === 'true' ? true : query.isSystemRole === 'false' ? false : undefined,
      sortBy: query.sortBy as string,
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'asc'
    };

    const result = await roleService.getRoles(params);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取角色列表失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 创建新角色
 * POST /api/admin/roles
 */
roleRoutes.post('/', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const body = await c.req.json();
    
    if (!body.name || !body.permissions) {
      return c.json({ 
        success: false, 
        error: '角色名称和权限不能为空' 
      }, 400);
    }

    if (!Array.isArray(body.permissions)) {
      return c.json({ 
        success: false, 
        error: '权限必须是数组格式' 
      }, 400);
    }

    const role = await roleService.createRole({
      name: body.name,
      description: body.description,
      permissions: body.permissions,
      isSystemRole: body.isSystemRole || false,
      isActive: body.isActive !== undefined ? body.isActive : true,
      sortOrder: body.sortOrder || 0
    });

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'create',
      {
        resource: 'roles',
        roleId: role.id,
        roleName: role.name,
        permissions: body.permissions
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: role,
      message: '角色创建成功'
    });
  } catch (error) {
    console.error('创建角色失败:', error);
    return c.json({ 
      success: false, 
      error: '创建角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 更新角色
 * PUT /api/admin/roles/:id
 */
roleRoutes.put('/:id', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const roleId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(roleId)) {
      return c.json({ 
        success: false, 
        error: '无效的角色ID' 
      }, 400);
    }

    // 检查是否为系统角色
    const existingRole = await roleService.getRoles({ page: 1, limit: 1 });
    const role = existingRole.roles.find(r => r.id === roleId);
    
    if (role && role.isSystemRole) {
      return c.json({ 
        success: false, 
        error: '不能修改系统角色' 
      }, 403);
    }

    const updatedRole = await roleService.updateRole(roleId, body);

    if (!updatedRole) {
      return c.json({ 
        success: false, 
        error: '角色不存在' 
      }, 404);
    }

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'update',
      {
        resource: 'roles',
        roleId: roleId,
        changes: body
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: updatedRole,
      message: '角色更新成功'
    });
  } catch (error) {
    console.error('更新角色失败:', error);
    return c.json({ 
      success: false, 
      error: '更新角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 删除角色
 * DELETE /api/admin/roles/:id
 */
roleRoutes.delete('/:id', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const roleId = parseInt(c.req.param('id'));
    
    if (isNaN(roleId)) {
      return c.json({ 
        success: false, 
        error: '无效的角色ID' 
      }, 400);
    }

    await roleService.deleteRole(roleId);

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'delete',
      {
        resource: 'roles',
        roleId: roleId
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      message: '角色删除成功'
    });
  } catch (error) {
    console.error('删除角色失败:', error);
    return c.json({ 
      success: false, 
      error: '删除角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取权限列表
 * GET /api/admin/permissions
 */
roleRoutes.get('/permissions', async (c) => {
  try {
    const roleService = c.get('roleService');
    const query = c.req.query();
    
    const params = {
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 20,
      search: query.search as string,
      resource: query.resource as string,
      action: query.action as string,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      sortBy: query.sortBy as string,
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'asc'
    };

    const result = await roleService.getPermissions(params);
    
    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取权限列表失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 创建新权限
 * POST /api/admin/permissions
 */
roleRoutes.post('/permissions', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const body = await c.req.json();
    
    if (!body.name || !body.resource || !body.action) {
      return c.json({ 
        success: false, 
        error: '权限名称、资源和操作不能为空' 
      }, 400);
    }

    const permission = await roleService.createPermission({
      name: body.name,
      description: body.description,
      resource: body.resource,
      action: body.action,
      conditions: body.conditions,
      isSystemPermission: body.isSystemPermission || false,
      isActive: body.isActive !== undefined ? body.isActive : true
    });

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'create',
      {
        resource: 'permissions',
        permissionId: permission.id,
        permissionName: permission.name,
        targetResource: body.resource,
        action: body.action
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: permission,
      message: '权限创建成功'
    });
  } catch (error) {
    console.error('创建权限失败:', error);
    return c.json({ 
      success: false, 
      error: '创建权限失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 更新权限
 * PUT /api/admin/permissions/:id
 */
roleRoutes.put('/permissions/:id', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const permissionId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(permissionId)) {
      return c.json({ 
        success: false, 
        error: '无效的权限ID' 
      }, 400);
    }

    const updatedPermission = await roleService.updatePermission(permissionId, body);

    if (!updatedPermission) {
      return c.json({ 
        success: false, 
        error: '权限不存在' 
      }, 404);
    }

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'update',
      {
        resource: 'permissions',
        permissionId: permissionId,
        changes: body
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: updatedPermission,
      message: '权限更新成功'
    });
  } catch (error) {
    console.error('更新权限失败:', error);
    return c.json({ 
      success: false, 
      error: '更新权限失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 删除权限
 * DELETE /api/admin/permissions/:id
 */
roleRoutes.delete('/permissions/:id', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const permissionId = parseInt(c.req.param('id'));
    
    if (isNaN(permissionId)) {
      return c.json({ 
        success: false, 
        error: '无效的权限ID' 
      }, 400);
    }

    await roleService.deletePermission(permissionId);

    // 记录操作日志
    await auditService.logOperation(
      0, // 系统操作
      currentUser.id,
      'delete',
      {
        resource: 'permissions',
        permissionId: permissionId
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      message: '权限删除成功'
    });
  } catch (error) {
    console.error('删除权限失败:', error);
    return c.json({ 
      success: false, 
      error: '删除权限失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 为用户分配角色
 * POST /api/admin/roles/assign
 */
roleRoutes.post('/assign', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const body = await c.req.json();
    
    if (!body.userId || !body.roleId) {
      return c.json({ 
        success: false, 
        error: '用户ID和角色ID不能为空' 
      }, 400);
    }

    const userId = parseInt(body.userId);
    const roleId = parseInt(body.roleId);
    
    if (isNaN(userId) || isNaN(roleId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID或角色ID' 
      }, 400);
    }

    const relation = await roleService.assignRoleToUser(
      userId,
      roleId,
      currentUser.id,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    );

    // 记录操作日志
    await auditService.logOperation(
      userId,
      currentUser.id,
      'role_change',
      {
        roleId: roleId,
        assignedBy: currentUser.id,
        expiresAt: body.expiresAt
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      data: relation,
      message: '角色分配成功'
    });
  } catch (error) {
    console.error('分配角色失败:', error);
    return c.json({ 
      success: false, 
      error: '分配角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 移除用户角色
 * DELETE /api/admin/roles/:roleId/users/:userId
 */
roleRoutes.delete('/:roleId/users/:userId', async (c) => {
  try {
    const roleService = c.get('roleService');
    const auditService = c.get('auditService');
    const currentUser = getCurrentUser(c);
    
    const roleId = parseInt(c.req.param('roleId'));
    const userId = parseInt(c.req.param('userId'));
    
    if (isNaN(roleId) || isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的角色ID或用户ID' 
      }, 400);
    }

    await roleService.removeRoleFromUser(userId, roleId);

    // 记录操作日志
    await auditService.logOperation(
      userId,
      currentUser.id,
      'role_change',
      {
        roleId: roleId,
        removed: true
      },
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      c.req.header('User-Agent') || ''
    );

    return c.json({
      success: true,
      message: '角色移除成功'
    });
  } catch (error) {
    console.error('移除角色失败:', error);
    return c.json({ 
      success: false, 
      error: '移除角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取用户角色
 * GET /api/admin/users/:userId/roles
 */
roleRoutes.get('/users/:userId/roles', async (c) => {
  try {
    const roleService = c.get('roleService');
    const userId = parseInt(c.req.param('userId'));
    
    if (isNaN(userId)) {
      return c.json({ 
        success: false, 
        error: '无效的用户ID' 
      }, 400);
    }

    const roles = await roleService.getUserRoles(userId);
    
    return c.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户角色失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取权限资源类型
 * GET /api/admin/permissions/resources
 */
roleRoutes.get('/permissions/resources', async (c) => {
  try {
    const roleService = c.get('roleService');
    const resources = await roleService.getPermissionResources();
    
    return c.json({
      success: true,
      data: resources
    });
  } catch (error) {
    console.error('获取权限资源类型失败:', error);
    return c.json({ 
      success: false, 
      error: '获取权限资源类型失败',
      message: error.message 
    }, 500);
  }
});

/**
 * 获取特定资源的操作类型
 * GET /api/admin/permissions/:resource/actions
 */
roleRoutes.get('/permissions/:resource/actions', async (c) => {
  try {
    const roleService = c.get('roleService');
    const resource = c.req.param('resource');
    
    if (!resource) {
      return c.json({ 
        success: false, 
        error: '资源类型不能为空' 
      }, 400);
    }

    const actions = await roleService.getPermissionActions(resource);
    
    return c.json({
      success: true,
      data: actions
    });
  } catch (error) {
    console.error('获取权限操作类型失败:', error);
    return c.json({ 
      success: false, 
      error: '获取权限操作类型失败',
      message: error.message 
    }, 500);
  }
});

export default roleRoutes;