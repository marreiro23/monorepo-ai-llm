#!/usr/bin/env node

/**
 * Smoke test para Container Manager
 * Valida orquestração de containers sob demanda e inatividade
 */

import axios from 'axios';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testManagerEndpoint(endpoint, description) {
  try {
    const response = await axios.get(`${MANAGER_URL}${endpoint}`, {
      timeout: 5000,
    });
    console.log(`✓ ${description}`);
    return response.data;
  } catch (error) {
    console.error(`✗ ${description}:`, error.message);
    throw error;
  }
}

async function testActivateDomain(domain) {
  try {
    const response = await axios.post(`${MANAGER_URL}/activate/${domain}`, null, {
      timeout: 30000,
    });
    console.log(`✓ Activated ${domain} on port ${response.data.port}`);
    return response.data;
  } catch (error) {
    console.error(`✗ Failed to activate ${domain}:`, error.message);
    throw error;
  }
}

async function testDomainHealthcheck(url, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, { timeout: 2000 });
      if (response.status === 200) {
        console.log(`✓ Domain healthcheck passed (${i * 1000}ms)`);
        return true;
      }
    } catch {
      if (i < maxRetries - 1) {
        await sleep(1000);
      }
    }
  }
  throw new Error('Domain did not become healthy');
}

async function runTests() {
  console.log('\n🚀 Container Manager Smoke Tests\n');

  try {
    // 1. Test manager status endpoint
    console.log('[1] Testing manager /status endpoint');
    const status = await testManagerEndpoint('/status', 'Manager status endpoint accessible');
    console.log(`  Found ${status.length} managed domains`);
    console.log(`  Domains: ${status.map(s => s.domain).join(', ')}`);

    // 2. Activate users domain
    console.log('\n[2] Testing domain activation (users)');
    const usersActivation = await testActivateDomain('users');
    console.log(`  Port: ${usersActivation.port}`);

    // 3. Wait for domain to be healthy
    console.log('\n[3] Waiting for domain healthcheck');
    const domainUrl = `http://localhost:${usersActivation.port}/health`;
    await testDomainHealthcheck(domainUrl);

    // 4. Verify status shows running
    console.log('\n[4] Verifying container marked as running');
    const status2 = await testManagerEndpoint('/status', 'Manager status endpoint');
    const usersStatus = status2.find((s) => s.domain === 'users');
    if (!usersStatus?.running) {
      throw new Error('Users container not marked as running');
    }
    console.log(`  ✓ Users container running (inactivity: ${usersStatus.inactivityMs}ms)`);

    // 5. Activate another domain
    console.log('\n[5] Testing multi-domain activation (llm-ops)');
    const llmActivation = await testActivateDomain('llm-ops');
    await testDomainHealthcheck(`http://localhost:${llmActivation.port}/health`, 5);

    // 6. Check final status
    console.log('\n[6] Final status check');
    const finalStatus = await testManagerEndpoint('/status', 'Final status');
    finalStatus.forEach((s) => {
      console.log(
        `  ${s.domain.padEnd(12)} | running: ${String(s.running).padEnd(5)} | port: ${s.port} | inactivity: ${s.inactivityMs}ms`
      );
    });

    console.log('\n✅ All smoke tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error.message);
    console.error('Ensure container manager is running: docker logs -f shp-container-manager');
    process.exit(1);
  }
}

runTests();
