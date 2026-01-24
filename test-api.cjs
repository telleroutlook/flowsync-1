// 测试智谱AI API连接
// 使用方法: node test-api.js YOUR_API_KEY

const crypto = require('crypto');

const API_KEY = process.argv[2] || process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('请提供 API Key:');
  console.error('  node test-api.js YOUR_API_KEY');
  console.error('  或设置环境变量 OPENAI_API_KEY');
  process.exit(1);
}

const BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';
const ENDPOINT = `${BASE_URL}/chat/completions`;
const MODEL = 'GLM-4.7';

console.log('='.repeat(60));
console.log('测试智谱AI API (带 JWT 认证)');
console.log('='.repeat(60));
console.log('Base URL:', BASE_URL);
console.log('Endpoint:', ENDPOINT);
console.log('Model:', MODEL);
console.log('API Key:', API_KEY.substring(0, 20) + '...');
console.log('='.repeat(60));

// 生成 JWT token for 智谱AI
function generateBigModelToken(apiKey, expSeconds = 3600) {
  const parts = apiKey.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid API key format. Expected: id.secret');
  }

  const [id, secret] = parts;
  const now = Date.now();
  const exp = now + expSeconds * 1000;

  const header = {
    alg: 'HS256',
    sign_type: 'SIGN',
  };

  const payload = {
    api_key: id,
    exp,
    timestamp: now,
  };

  const base64UrlEncode = (str) => {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${dataToSign}.${signature}`;
}

const jwtToken = generateBigModelToken(API_KEY);
console.log('\n生成的 JWT Token:', jwtToken.substring(0, 50) + '...');

const testPayload = {
  model: MODEL,
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: '你好' }
  ],
  temperature: 0.5,
};

console.log('\n发送请求...');
console.log('Method: POST');
console.log('Headers:');
console.log('  Content-Type: application/json');
console.log('  Authorization: Bearer ' + jwtToken.substring(0, 30) + '...');
console.log('Body:', JSON.stringify(testPayload, null, 2));

fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload),
})
  .then(async (response) => {
    console.log('\n' + '='.repeat(60));
    console.log('收到响应');
    console.log('='.repeat(60));
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('OK:', response.ok);

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('\nHeaders:', JSON.stringify(headers, null, 2));

    const text = await response.text();
    console.log('\nResponse Body:');
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));

      if (json.error) {
        console.log('\n❌ 请求失败');
        console.log('错误代码:', json.error.code);
        console.log('错误信息:', json.error.message);
      } else if (json.choices && json.choices[0]?.message?.content) {
        console.log('\n✅ 请求成功');
        console.log('\nAI 回复:', json.choices[0].message.content);
      } else {
        console.log('\n✅ 请求成功 (无内容)');
      }
    } catch (e) {
      console.log(text);
    }
  })
  .catch((error) => {
    console.error('\n❌ 请求异常:', error.message);
  });
