// 测试工具 - 数据库Mock
// 为Drizzle ORM提供简化的测试模拟

import { vi } from 'vitest';

export function createMockDb() {
  return {
    // 查询方法
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn((...args) => args),
    eq: vi.fn((left, right) => ({ left, right, op: 'eq' })),
    or: vi.fn((...args) => ({ args, op: 'or' })),
    inArray: vi.fn((column, values) => ({ column, values, op: 'inArray' })),
    not: vi.fn((arg) => ({ arg, op: 'not' })),
    isNull: vi.fn((column) => ({ column, op: 'isNull' })),
    isNotNull: vi.fn((column) => ({ column, op: 'isNotNull' })),
    gt: vi.fn((column, value) => ({ column, value, op: 'gt' })),
    gte: vi.fn((column, value) => ({ column, value, op: 'gte' })),
    lt: vi.fn((column, value) => ({ column, value, op: 'lt' })),
    lte: vi.fn((column, value) => ({ column, value, op: 'lte' })),
    
    // 连接方法
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    fullJoin: vi.fn().mockReturnThis(),
    
    // 排序和限制
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    
    // 聚合函数
    count: vi.fn().mockReturnValue({ count: '*' }),
    sum: vi.fn((column) => ({ column, op: 'sum' })),
    avg: vi.fn((column) => ({ column, op: 'avg' })),
    max: vi.fn((column) => ({ column, op: 'max' })),
    min: vi.fn((column) => ({ column, op: 'min' })),
    
    // 插入更新删除
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    
    // 执行方法
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    execute: vi.fn(),
    
    // 事务
    transaction: vi.fn((callback) => callback(createMockDb())),
    
    // 原始SQL
    sql: vi.fn((strings, ...values) => ({ strings, values })),
  };
}

// 快速设置mock返回值
export function setupMockGet(db: any, returnValue: any) {
  db.get.mockResolvedValue(returnValue);
}

export function setupMockAll(db: any, returnValue: any) {
  db.all.mockResolvedValue(returnValue);
}

export function setupMockRun(db: any, returnValue: any = { changes: 1 }) {
  db.run.mockResolvedValue(returnValue);
}

// 模拟Drizzle查询链
export function setupMockQuery(db: any, step: string, returnValue: any) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(returnValue),
    all: vi.fn().mockResolvedValue(Array.isArray(returnValue) ? returnValue : [returnValue]),
    run: vi.fn().mockResolvedValue({ changes: 1 }),
  };
  
  // 根据步骤设置不同的返回值
  if (step === 'get') {
    chain.get.mockResolvedValue(returnValue);
  } else if (step === 'all') {
    chain.all.mockResolvedValue(returnValue);
  } else if (step === 'run') {
    chain.run.mockResolvedValue(returnValue);
  }
  
  return chain;
}