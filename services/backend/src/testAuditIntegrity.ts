import { pool } from './db/client';
import { CryptographicAuditLogger } from './services/auditLogger';

async function runIntegrityTest() {
  const client = await pool.connect();

  console.log('[Audit Test] Connected to database. Beginning integrity benchmark...');

  try {
    await client.query('BEGIN');

    // 1. Write 3 sequential synthetic test events
    const testEntityId = 'cluster-test-' + Date.now();

    console.log('[Audit Test] Recording Event 1...');
    const hash1 = await CryptographicAuditLogger.recordEvent(client, {
      actorId: 'TEST_SUITE_RUNNER',
      actorType: 'SYSTEM_WORKER',
      action: 'CLUSTER_INIT_TEST',
      entityType: 'CLUSTER',
      entityId: testEntityId,
      metadata: { step: 1, sampleData: 'initial state' },
    });

    console.log('[Audit Test] Recording Event 2...');
    const hash2 = await CryptographicAuditLogger.recordEvent(client, {
      actorId: 'TEST_SUITE_RUNNER',
      actorType: 'SYSTEM_WORKER',
      action: 'INCIDENT_LINKED_TEST',
      entityType: 'CLUSTER',
      entityId: testEntityId,
      metadata: { step: 2, sampleData: 'updated state' },
    });

    console.log('[Audit Test] Recording Event 3...');
    const hash3 = await CryptographicAuditLogger.recordEvent(client, {
      actorId: 'TEST_SUITE_RUNNER',
      actorType: 'SYSTEM_WORKER',
      action: 'SCORING_COMPLETED_TEST',
      entityType: 'CLUSTER',
      entityId: testEntityId,
      metadata: { step: 3, sampleData: 'final state' },
    });

    console.log(`[Audit Test] Successfully chained entries:\n  1: ${hash1}\n  2: ${hash2}\n  3: ${hash3}`);

    // 2. Validate clean chain
    console.log('[Audit Test] Validating forward chain integrity...');
    const checkBefore = await CryptographicAuditLogger.verifyChainIntegrity(client);
    if (!checkBefore.isValid) {
      throw new Error(`Chain failed clean validation at sequence: ${checkBefore.brokenAtSeq}`);
    }
    console.log('✓ Chain integrity verified: ALL HASHES ARE VALID.');

    // 3. Rollback transaction so test data does not pollute production records
    await client.query('ROLLBACK');
    console.log('[Audit Test] Test transaction cleanly rolled back. Database remains pristine.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Audit integrity test failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runIntegrityTest();