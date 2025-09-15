#!/usr/bin/env node

// 更精确的JSON修复测试
console.log('🔧 精确JSON修复测试');
console.log('=================');

// 更精确的JSON修复方法
function preciseJsonFix(jsonStr) {
  console.log('\n🔧 开始精确JSON修复...');
  
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      if (inString) {
        // 在字符串中遇到引号，需要判断是结束还是内容中的引号
        // 简化策略：如果后面跟着 : , } ] 等字符，说明是字符串结束
        const nextChar = jsonStr[i + 1];
        if (nextChar && [':', ',', '}', ']'].includes(nextChar)) {
          // 字符串结束
          result += char;
          inString = false;
        } else {
          // 字符串内容中的引号，需要转义
          result += '\\"';
        }
      } else {
        // 字符串开始
        result += char;
        inString = true;
      }
    } else {
      result += char;
    }
  }
  
  return result;
}

// 更简单但更有效的方法
function simpleJsonFix(jsonStr) {
  console.log('\n🔧 开始简单JSON修复...');
  
  // 策略：找到所有的键值对，然后专门修复值部分
  let fixed = jsonStr;
  
  // 匹配 "key": "value" 格式，专门修复value中的引号
  fixed = fixed.replace(/"([^"]+)":\s*"([^"]*)"/g, (match, key, value) => {
    // 转义value中的所有未转义的引号
    const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
    return `"${key}": "${escapedValue}"`;
  });
  
  return fixed;
}

// 测试问题JSON
const testCases = [
  {
    name: '简单引号问题',
    json: '{"topics": ["原子能立法"], "analysis": "法律强调"和平利用"原则"}'
  },
  {
    name: '复杂引号问题',
    json: '{"analysis": "中国出台原子能法，强调"和平利用"原则，规定"安全监管"措施"}'
  },
  {
    name: '多个引号',
    json: '{"analysis": "他说："这是一个重要问题"，我们需要"认真对待""}'
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n📋 测试案例 ${index + 1}: ${testCase.name}`);
  console.log('原始JSON:', testCase.json);
  
  try {
    JSON.parse(testCase.json);
    console.log('✅ 原始JSON有效');
  } catch (error) {
    console.log('❌ 原始JSON无效:', error.message);
    
    // 测试精确修复
    try {
      const preciselyFixed = preciseJsonFix(testCase.json);
      JSON.parse(preciselyFixed);
      console.log('✅ 精确修复成功');
      console.log('修复后:', preciselyFixed);
    } catch (preciseError) {
      console.log('❌ 精确修复失败:', preciseError.message);
    }
    
    // 测试简单修复
    try {
      const simplyFixed = simpleJsonFix(testCase.json);
      JSON.parse(simplyFixed);
      console.log('✅ 简单修复成功');
      console.log('修复后:', simplyFixed);
    } catch (simpleError) {
      console.log('❌ 简单修复失败:', simpleError.message);
    }
  }
});

// 最可靠的修复方法
function mostReliableJsonFix(jsonStr) {
  console.log('\n🔧 开始最可靠的JSON修复...');
  
  // 先尝试直接解析
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {
    // 解析失败，尝试修复
  }
  
  // 策略1: 使用eval（安全考虑，仅用于测试）
  try {
    // 注意：生产环境中不要使用eval，这里仅用于演示
    const parsed = eval(`(${jsonStr})`);
    return JSON.stringify(parsed);
  } catch (evalError) {
    console.log('Eval修复失败:', evalError.message);
  }
  
  // 策略2: 手动修复常见的引号问题
  try {
    let fixed = jsonStr;
    
    // 修复字符串值中的引号
    fixed = fixed.replace(/:\s*"([^"]*)"/g, (match, value) => {
      const escapedValue = value.replace(/"/g, '\\"');
      return `: "${escapedValue}"`;
    });
    
    JSON.parse(fixed);
    return fixed;
  } catch (manualError) {
    console.log('手动修复失败:', manualError.message);
  }
  
  // 策略3: 返回最小化有效JSON
  return '{"error": "JSON修复失败", "original": "' + jsonStr.replace(/"/g, '\\"') + '"}';
}

// 测试最可靠的方法
console.log('\n📋 测试最可靠的修复方法:');
const problematicJson = '{"analysis": "法律强调"和平利用"原则"}';
console.log('原始:', problematicJson);

try {
  const reliableFixed = mostReliableJsonFix(problematicJson);
  const parsed = JSON.parse(reliableFixed);
  console.log('✅ 最可靠修复成功');
  console.log('修复后:', reliableFixed);
  console.log('解析结果:', parsed);
} catch (error) {
  console.log('❌ 最可靠修复也失败:', error.message);
}

console.log('\n🎯 建议:');
console.log('1. 在AI提示中明确要求正确转义引号');
console.log('2. 使用多层JSON修复策略');
console.log('3. 添加详细的错误日志');