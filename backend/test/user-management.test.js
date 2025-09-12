// 简单的用户管理功能测试脚本
const { expect } = require('chai');
const fetch = require('node-fetch');

// 测试配置
const BASE_URL = 'http://localhost:8787/admin';
const ADMIN_TOKEN = 'test_admin_token'; // 这里需要替换为真实的admin token

describe('User Management API Tests', () => {
    let testUserId;

    // 测试获取用户列表
    it('should get users list', async () => {
        const response = await fetch(`${BASE_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('users');
        expect(data.data).to.have.property('total');
    });

    // 测试获取用户统计信息
    it('should get user statistics', async () => {
        const response = await fetch(`${BASE_URL}/users/statistics`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('totalUsers');
        expect(data.data).to.have.property('activeUsers');
        expect(data.data).to.have.property('roleDistribution');
    });

    // 测试获取角色列表
    it('should get roles list', async () => {
        const response = await fetch(`${BASE_URL}/roles`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('roles');
    });

    // 测试获取权限列表
    it('should get permissions list', async () => {
        const response = await fetch(`${BASE_URL}/roles/permissions`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('permissions');
    });

    // 测试用户状态更新
    it('should update user status', async () => {
        if (!testUserId) {
            console.log('Skipping user status update test - no test user available');
            return;
        }

        const response = await fetch(`${BASE_URL}/users/${testUserId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'active',
                reason: 'Test status update'
            })
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('status');
    });

    // 测试批量操作
    it('should perform batch operations', async () => {
        if (!testUserId) {
            console.log('Skipping batch operations test - no test user available');
            return;
        }

        const response = await fetch(`${BASE_URL}/users/batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operation: 'activate',
                userIds: [testUserId]
            })
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('success');
        expect(data.data).to.have.property('failed');
    });

    // 测试获取用户操作日志
    it('should get user operation logs', async () => {
        if (!testUserId) {
            console.log('Skipping user logs test - no test user available');
            return;
        }

        const response = await fetch(`${BASE_URL}/users/${testUserId}/logs`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        expect(response.status).to.equal(200);
        const data = await response.json();
        expect(data.success).to.be.true;
        expect(data.data).to.have.property('logs');
        expect(data.data).to.have.property('total');
    });
});

// 运行测试
console.log('User Management API Tests completed');