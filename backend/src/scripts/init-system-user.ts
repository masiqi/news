// src/scripts/init-system-user.ts
import { SourceService } from '../services/source.service';

/**
 * 初始化系统用户脚本
 * 该脚本用于创建系统用户（ID=1），用于提供公共RSS源
 */

async function initSystemUser() {
  try {
    // 注意：在实际部署中，您需要传递正确的数据库连接
    // 这里只是一个示例脚本
    console.log('正在创建系统用户...');
    
    // 在实际应用中，您需要从环境变量获取数据库连接
    // const db = ... // 数据库连接
    // const sourceService = new SourceService(db);
    // const systemUser = await sourceService.createSystemUser();
    
    console.log('系统用户创建成功');
  } catch (error) {
    console.error('创建系统用户失败:', error);
  }
}

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initSystemUser();
}

export default initSystemUser;