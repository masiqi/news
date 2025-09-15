#!/usr/bin/env node

// 测试JSON修复逻辑
console.log('🧪 测试JSON修复逻辑');
console.log('===================');

// 模拟有问题的JSON字符串（包含中文引号）
const problematicJson = `{"topics": ["原子能立法", "和平利用", "安全监管", "国际合作", "制度建设"], "keywords": ["原子能法", "和平利用", "全国人大常委会", "核安全", "核燃料循环", "核恐怖主义", "乏燃料", "核事故应急", "核安保", "核损害赔偿", "受控热核聚变", "出口许可", "谢雁冰"], "sentiment": "neutral", "analysis": "中国出台原子能法是中国在原子能领域立法的重要里程碑，该法明确了原子能研究、开发和利用活动的指导思想、重要原则，并规定了多项制度措施。法律特别强调"和平利用"原子能的原则，在多个章节中体现促进经济社会高质量发展、增进人民福祉等和平用途。同时，法律也强调履行国际义务，促进和平利用原子能的国际交流合作。此外，法律还设立了七项重要制度，包括乏燃料管理、核技术应用、核事故应急等，为规范和促进原子能事业的发展提供了制度保障。法律还特别关注安全问题，设置"安全监督管理"专章，强调压实安全责任，防范核恐怖主义、网络攻击等风险。", "educationalValue": "这篇新闻对高中生具有重要教育意义，可以帮助学生了解中国在原子能领域的立法进展，认识和平利用原子能的重要性，以及核安全管理的必要性。学生可以从中学习到原子能法的基本框架、主要内容和制度设计，了解中国在核能领域的政策导向和国际责任。同时，新闻也涉及法律制定的基本程序和原则，有助于培养学生的法治意识和国家安全意识。", "extractedContent": "<p> <a target="_blank" href="/">中新社</a>北京9月12日电 (记者 谢雁冰)十四届全国人大常委会第十七次会议12日表决通过原子能法。这是中国原子能领域的一部综合性、基础性法律，其中多处明确"和平利用"原子能。</p><p> 全国人大常委会法工委国家法室负责人在答记者问时表示，该法明确了原子能研究、开发和利用活动的指导思想、重要原则，规定了鼓励和支持原子能研究、开发和利用活动的制度措施，以及安全监督管理和进出口管理制度，是中国原子能领域法律法规体系建设的重要里程碑。</p><p> "和平利用"是贯穿原子能法的一项重要原则。法律中多处明确"和平利用"原子能，第一条立法目的中明确"保障原子能研究、开发与和平利用"。在科学研究与技术开发、核燃料循环、利用、安全监管等章节中，始终体现促进经济社会高质量发展、增进人民福祉等和平用途。</p><p> 原子能法同时强调履行国际义务，促进和平利用原子能的国际交流合作。</p><p> 国家原子能机构系统工程司负责人介绍，原子能法设立七项制度。主要包括乏燃料贮存、运输和后处理等管理制度，核技术应用废旧放射源回收制度，核事故应急准备金制度，核以及核两用物项出口许可制度，受控热核聚变监督管理制度，核安保制度，核损害赔偿责任制度，为规范和促进原子能事业的发展提供了制度保障。</p><p> 原子能法也为实现原子能事业的高水平安全确立了严格要求。该法设置"安全监督管理"专章，强调压实安全责任，重点防范核恐怖主义、网络攻击等风险，并对违反核安全的行为采取处罚措施。(完)</p>"}`;

console.log('🔍 测试原始有问题的JSON...');
console.log('原始JSON长度:', problematicJson.length);

try {
  JSON.parse(problematicJson);
  console.log('✅ 原始JSON解析成功');
} catch (error) {
  console.log('❌ 原始JSON解析失败:', error.message);
}

// 模拟我们的清理函数
function cleanJsonString(jsonStr) {
  console.log('🔧 开始清理JSON字符串...');
  
  let cleaned = jsonStr;
  
  // 1. 移除控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  
  // 2. 修复引号问题 - 这是关键！
  // 首先确保所有JSON键值对的引号都是英文双引号
  cleaned = cleaned.replace(/(['"])(?=(?:[^"\\]|\\.)*["])/g, '"');
  
  // 3. 修复中文字符串中的引号问题
  // 将字符串内容中的中文引号转换为英文引号并正确转义
  cleaned = cleaned.replace(/"([^"]*)"/g, (match, content) => {
    // 转义字符串内的双引号
    const escapedContent = content.replace(/"/g, '\\"');
    return `"${escapedContent}"`;
  });
  
  // 4. 修复转义字符
  cleaned = cleaned.replace(/\\n/g, '\\\\n')
                 .replace(/\\r/g, '\\\\r')
                 .replace(/\\t/g, '\\\\t');
  
  // 5. 修复可能的JSON格式问题
  cleaned = cleaned.replace(/,\s*}/g, '}')
                 .replace(/,\s*]/g, ']');
  
  // 6. 移除可能的BOM标记
  cleaned = cleaned.replace(/^\uFEFF/, '').trim();
  
  console.log('🔧 JSON清理完成，清理后长度:', cleaned.length);
  console.log('🔧 清理后的JSON预览:', cleaned.substring(0, 200) + '...');
  
  return cleaned;
}

// 模拟我们的修复函数
function fixJsonFormat(jsonStr) {
  console.log('🔄 开始修复JSON格式...');
  
  try {
    // 尝试修复常见问题
    let fixed = jsonStr;
    
    // 1. 最直接的方法：解析整个JSON结构并重新构建
    console.log('🔧 尝试解析并重建JSON...');
    
    // 首先尝试找到所有的键值对
    const keyPattern = /"([^"]+)"\s*:\s*"([^"]*)"/g;
    let match;
    let lastIndex = 0;
    const newParts = [];
    
    while ((match = keyPattern.exec(jsonStr)) !== null) {
      // 添加前面的内容
      if (match.index > lastIndex) {
        newParts.push(jsonStr.substring(lastIndex, match.index));
      }
      
      const key = match[1];
      let value = match[2];
      
      // 转义值中的引号
      const escapedValue = value.replace(/"/g, '\\"');
      
      // 重新构建键值对
      newParts.push(`"${key}": "${escapedValue}"`);
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余的内容
    if (lastIndex < jsonStr.length) {
      newParts.push(jsonStr.substring(lastIndex));
    }
    
    fixed = newParts.join('');
    
    // 2. 处理数组和布尔值
    fixed = fixed.replace(/:\s*(\[.*?\]|true|false|null|\d+)/g, (match, content) => {
      return `: ${content}`;
    });
    
    // 3. 尝试解析验证
    JSON.parse(fixed);
    console.log('✅ JSON格式修复成功');
    return fixed;
    
  } catch (error) {
    console.log('❌ 标准修复失败:', error.message);
    
    // 尝试更激进的修复
    try {
      console.log('🔧 尝试激进修复...');
      return aggressiveJsonFix(jsonStr);
    } catch (aggressiveError) {
      console.log('❌ 激进修复也失败:', aggressiveError.message);
      return jsonStr;
    }
  }
}

// 激进的JSON修复函数
function aggressiveJsonFix(jsonStr) {
  console.log('🔧 开始激进JSON修复...');
  
  // 1. 手动解析JSON结构
  let fixed = jsonStr;
  
  // 2. 替换所有字符串内容中的引号为转义引号
  // 这是一个更简单但有效的方法
  fixed = fixed.replace(/:\s*"([^"]*)"/g, (match, content) => {
    const escapedContent = content.replace(/"/g, '\\"');
    return `: "${escapedContent}"`;
  });
  
  // 3. 验证修复结果
  JSON.parse(fixed);
  console.log('✅ 激进修复成功');
  return fixed;
}

console.log('\n🔧 测试清理函数...');
const cleanedJson = cleanJsonString(problematicJson);

console.log('\n🔄 测试修复函数...');
try {
  const fixedJson = fixJsonFormat(cleanedJson);
  
  console.log('\n✅ 最终验证...');
  const parsed = JSON.parse(fixedJson);
  console.log('✅ JSON解析成功！');
  console.log('📊 解析结果:');
  console.log('- topics:', parsed.topics.length, '个');
  console.log('- keywords:', parsed.keywords.length, '个');
  console.log('- sentiment:', parsed.sentiment);
  console.log('- analysis长度:', parsed.analysis.length, '字符');
  console.log('- educationalValue长度:', parsed.educationalValue.length, '字符');
  console.log('- extractedContent长度:', parsed.extractedContent.length, '字符');
  
} catch (error) {
  console.log('❌ 最终解析失败:', error.message);
}

console.log('\n🎯 测试完成');