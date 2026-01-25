// Test script to verify AI tool calling
// Run this after starting the server: node test-ai-tools.cjs

async function testAITools() {
  const response = await fetch('http://localhost:8788/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history: [],
                message: 'Create a task named "Security Audit"',      systemContext: 'Active Project: Test Project (test-id). Active Project ID: test-id.'
    }),
  });

  const payload = await response.json();
  console.log('=== AI Response ===');
  console.log('Status:', response.status);
  console.log('Success:', payload.success);
  console.log('Data:', JSON.stringify(payload.data, null, 2));
  if (payload.error) {
    console.log('Error:', payload.error);
  }

  process.exit(0);
}

testAITools().catch(console.error);
