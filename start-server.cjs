// 加载 .env 文件并启动服务器
const { config } = require('dotenv');
const { resolve } = require('path');

// 加载 .env 文件
const result = config({ path: resolve(__dirname, '.env') });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

console.log('Environment variables loaded:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');
console.log('  OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL);
console.log('  OPENAI_MODEL:', process.env.OPENAI_MODEL);
console.log('');

// 启动服务器
require('child_process').spawn('npm', ['run', 'dev:server'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});
