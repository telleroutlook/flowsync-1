const { getDb } = require('./worker/db');
const { observabilityLogs } = require('./worker/db/schema');
const { desc, eq } = require('drizzle-orm');

async function checkAILogs() {
  const db = getDb();

  console.log('Fetching recent AI request/response logs...\n');

  const logs = await db
    .select()
    .from(observabilityLogs)
    .where(eq(observabilityLogs.kind, 'ai_request'))
    .orderBy(desc(observabilityLogs.createdAt))
    .limit(5);

  const responseLogs = await db
    .select()
    .from(observabilityLogs)
    .where(eq(observabilityLogs.kind, 'ai_response'))
    .orderBy(desc(observabilityLogs.createdAt))
    .limit(5);

  console.log('=== AI REQUEST LOGS ===');
  for (const log of logs) {
    console.log(`Timestamp: ${new Date(log.createdAt).toISOString()}`);
    console.log(`Message: ${log.payload.message?.substring(0, 100)}...`);
    console.log(`History Length: ${log.payload.history?.length || 0}`);
    console.log('---');
  }

  console.log('\n=== AI RESPONSE LOGS ===');
  for (const log of responseLogs) {
    console.log(`Timestamp: ${new Date(log.createdAt).toISOString()}`);
    console.log(`Text: ${log.payload.text?.substring(0, 200)}...`);
    console.log(`Tool Calls: ${JSON.stringify(log.payload.toolCalls, null, 2)}`);
    console.log('---');
  }

  process.exit(0);
}

checkAILogs().catch(console.error);
