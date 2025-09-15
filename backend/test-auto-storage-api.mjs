#!/usr/bin/env node

// 测试用户自动存储配置API
const testAutoStorageAPI = async () => {
  try {
    console.log('测试用户自动存储配置API...');
    
    // 测试获取配置
    const configResponse = await fetch('http://localhost:44467/api/user/auto-storage/config', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1Nzg3MjE5OSwiZXhwIjoxNzU3OTU4NTk5fQ',
        'Content-Type': 'application/json'
      }
    });

    console.log('配置响应状态:', configResponse.status);
    
    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log('用户配置:', JSON.stringify(configData, null, 2));
    } else {
      console.log('配置响应错误:', await configResponse.text());
    }

    // 测试获取统计信息
    const statsResponse = await fetch('http://localhost:44467/api/user/auto-storage/stats', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1Nzg3MjE5OSwiZXhwIjoxNzU3OTU4NTk5fQ',
        'Content-Type': 'application/json'
      }
    });

    console.log('统计响应状态:', statsResponse.status);
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('存储统计:', JSON.stringify(statsData, null, 2));
    } else {
      console.log('统计响应错误:', await statsResponse.text());
    }

    // 测试获取存储日志
    const logsResponse = await fetch('http://localhost:44467/api/user/auto-storage/logs', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1Nzg3MjE5OSwiZXhwIjoxNzU3OTU4NTk5fQ',
        'Content-Type': 'application/json'
      }
    });

    console.log('日志响应状态:', logsResponse.status);
    
    if (logsResponse.ok) {
      const logsData = await logsResponse.json();
      console.log('存储日志:', JSON.stringify(logsData, null, 2));
    } else {
      console.log('日志响应错误:', await logsResponse.text());
    }

  } catch (error) {
    console.error('测试失败:', error.message);
  }
};

// 等待服务器启动
setTimeout(testAutoStorageAPI, 3000);