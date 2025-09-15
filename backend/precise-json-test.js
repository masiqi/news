#!/usr/bin/env node

// 精确修复JSON中的引号问题
console.log('🎯 精确修复JSON测试');
console.log('=================');

// 问题JSON
const problematicJson = `{"topics": ["原子能立法", "和平利用", "安全监管", "国际合作", "制度建设"], "keywords": ["原子能法", "和平利用", "全国人大常委会", "核安全", "核燃料循环", "核恐怖主义", "乏燃料", "核事故应急", "核安保", "核损害赔偿", "受控热核聚变", "出口许可", "谢雁冰"], "sentiment": "neutral", "analysis": "中国出台原子能法是中国在原子能领域立法的重要里程碑，该法明确了原子能研究、开发和利用活动的指导思想、重要原则，并规定了多项制度措施。法律特别强调"和平利用"原子能的原则，在多个章节中体现促进经济社会高质量发展、增进人民福祉等和平用途。同时，法律也强调履行国际义务，促进和平利用原子能的国际交流合作。此外，法律还设立了七项重要制度，包括乏燃料管理、核技术应用、核事故应急等，为规范和促进原子能事业的发展提供了制度保障。法律还特别关注安全问题，设置"安全监督管理"专章，强调压实安全责任，防范核恐怖主义、网络攻击等风险。", "educationalValue": "这篇新闻对高中生具有重要教育意义，可以帮助学生了解中国在原子能领域的立法进展，认识和平利用原子能的重要性，以及核安全管理的必要性。学生可以从中学习到原子能法的基本框架、主要内容和制度设计，了解中国在核能领域的政策导向和国际责任。同时，新闻也涉及法律制定的基本程序和原则，有助于培养学生的法治意识和国家安全意识。", "extractedContent": "<p> <a target="_blank" href="/">中新社</a>北京9月12日电 (记者 谢雁冰)十四届全国人大常委会第十七次会议12日表决通过原子能法。这是中国原子能领域的一部综合性、基础性法律，其中多处明确"和平利用"原子能。</p><p> 全国人大常委会法工委国家法室负责人在答记者问时表示，该法明确了原子能研究、开发和利用活动的指导思想、重要原则，规定了鼓励和支持原子能研究、开发和利用活动的制度措施，以及安全监督管理和进出口管理制度，是中国原子能领域法律法规体系建设的重要里程碑。</p><p> "和平利用"是贯穿原子能法的一项重要原则。法律中多处明确"和平利用"原子能，第一条立法目的中明确"保障原子能研究、开发与和平利用"。在科学研究与技术开发、核燃料循环、利用、安全监管等章节中，始终体现促进经济社会高质量发展、增进人民福祉等和平用途。</p><p> 原子能法同时强调履行国际义务，促进和平利用原子能的国际交流合作。</p><p> 国家原子能机构系统工程司负责人介绍，原子能法设立七项制度。主要包括乏燃料贮存、运输和后处理等管理制度，核技术应用废旧放射源回收制度，核事故应急准备金制度，核以及核两用物项出口许可制度，受控热核聚变监督管理制度，核安保制度，核损害赔偿责任制度，为规范和促进原子能事业的发展提供了制度保障。</p><p> 原子能法也为实现原子能事业的高水平安全确立了严格要求。该法设置"安全监督管理"专章，强调压实安全责任，重点防范核恐怖主义、网络攻击等风险，并对违反核安全的行为采取处罚措施。(完)</p>"}`;

console.log('🔍 分析问题...');
try {
  JSON.parse(problematicJson);
  console.log('✅ 原始JSON有效');
} catch (error) {
  console.log('❌ 原始JSON无效:', error.message);
  
  // 找到错误位置
  const position = parseInt(error.message.match(/position (\d+)/)[1]);
  console.log('📍 错误位置:', position);
  console.log('📍 错误附近的字符:', JSON.stringify(problematicJson.substring(position - 20, position + 20)));
}

// 精确修复方法
function preciseJsonFix(jsonStr) {
  console.log('\n🔧 开始精确修复...');
  
  // 关键问题：字符串值中的引号没有被转义
  // 解决方案：逐个字符分析，正确转义字符串值中的引号
  
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
        // 检查这个引号是否是字符串的结束
        // 如果是字符串的结束，就正常处理
        // 如果是字符串内容中的引号，就需要转义
        
        // 简单判断：如果后面跟着 : , } ] 等字符，说明是字符串结束
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
function effectiveJsonFix(jsonStr) {
  console.log('\n🔧 开始有效修复...');
  
  // 更直接的方法：替换所有在字符串内部的引号为转义引号
  // 使用更聪明的正则表达式
  
  // 1. 先处理字符串值中的引号
  let fixed = jsonStr;
  
  // 匹配: "key": "value" 格式，转义value中的引号
  fixed = fixed.replace(/"([^"]+)"\s*:\s*"([^"]*)"/g, (match, key, value) => {
    // 转义value中的所有引号，但不要转义已经转义的引号
    const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
    return `"${key}": "${escapedValue}"`;
  });
  
  // 2. 处理数组中的字符串
  fixed = fixed.replace(/\[\s*([^\]]+)\]/g, (match, arrayContent) => {
    // 处理数组中的每个字符串项
    const processedItems = arrayContent.split(/\s*,\s*/).map(item => {
      item = item.trim();
      if (item.startsWith('"') && item.endsWith('"')) {
        const content = item.slice(1, -1);
        const escapedContent = content.replace(/(?<!\\)"/g, '\\"');
        return `"${escapedContent}"`;
      }
      return item;
    });
    return `[${processedItems.join(', ')}]`;
  });
  
  return fixed;
}

console.log('\n🧪 测试精确修复...');
const preciselyFixed = preciseJsonFix(problematicJson);

try {
  JSON.parse(preciselyFixed);
  console.log('✅ 精确修复成功！');
} catch (error) {
  console.log('❌ 精确修复失败:', error.message);
}

console.log('\n🧪 测试有效修复...');
const effectivelyFixed = effectiveJsonFix(problematicJson);

try {
  const parsed = JSON.parse(effectivelyFixed);
  console.log('✅ 有效修复成功！');
  console.log('\n📊 解析结果:');
  console.log('- topics:', parsed.topics);
  console.log('- keywords count:', parsed.keywords.length);
  console.log('- sentiment:', parsed.sentiment);
  console.log('- analysis length:', parsed.analysis.length);
  console.log('- analysis contains quotes:', parsed.analysis.includes('"'));
  console.log('- analysis preview:', parsed.analysis.substring(0, 80) + '...');
  
} catch (error) {
  console.log('❌ 有效修复失败:', error.message);
  console.log('修复后的JSON预览:', effectivelyFixed.substring(0, 300) + '...');
}

console.log('\n🎯 测试完成');