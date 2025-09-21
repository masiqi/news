import crypto from 'crypto';

// 生成一个测试JWT token
function generateTestToken() {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    isAdmin: true,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时后过期
  };
  
  const secret = 'development_jwt_secret_key_for_local_development';
  
  // Base64 encode header
  const encodedHeader = Buffer.from(JSON.stringify(header))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Base64 encode payload
  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const token = generateTestToken();
console.log('Test JWT Token:', token);
console.log('');
console.log('Use this token to test the API endpoints:');
console.log(`curl -X POST http://localhost:8787/api/tags/initialize -H "Authorization: Bearer ${token}"`);
console.log(`curl -X GET http://localhost:8787/api/tags/topics -H "Authorization: Bearer ${token}"`);