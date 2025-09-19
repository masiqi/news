// 测试Cloudflare AI的基本功能
async function testCloudflareAI() {
  try {
    console.log('开始测试Cloudflare AI...');
    
    // 简单的测试prompt
    const testPrompt = '请用JSON格式返回一个简单的测试结果：{"test": "success", "model": "gpt-oss-20b"}';
    
    console.log('发送测试请求...');
    const response = await env.AI.run('@cf/openai/gpt-oss-20b', {
      messages: [
        {
          role: 'system',
          content: '你是一个测试助手，请严格按照JSON格式返回结果。'
        },
        {
          role: 'user',
          content: testPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    console.log('AI响应:', JSON.stringify(response, null, 2));
    
    // 尝试提取结果
    const resultText = response.response || (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) || JSON.stringify(response);
    console.log('提取的文本:', resultText);
    
    // 尝试解析JSON
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('解析结果:', parsed);
        return { success: true, data: parsed };
      } else {
        console.log('未找到JSON格式');
        return { success: false, error: '未找到JSON格式' };
      }
    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      return { success: false, error: parseError.message };
    }
    
  } catch (error) {
    console.error('测试失败:', error);
    return { success: false, error: error.message };
  }
}

// 导出测试函数
export { testCloudflareAI };