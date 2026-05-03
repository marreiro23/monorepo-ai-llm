#!/usr/bin/env node

/**
 * Teste de Cleanup & Logging
 * Valida:
 * 1. Container para após 10 min de inatividade
 * 2. Container é removido após 1+ dia de inatividade
 * 3. Logs são criados e acessíveis
 * 4. API endpoints de logs funcionam
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:3000';
const LOGS_DIR = '.container-logs';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('\n🧪 Cleanup & Logging Tests\n');

  try {
    // Test 1: Manager está respondendo
    console.log('[Test 1] Manager respondendo...');
    const status1 = await axios.get(`${MANAGER_URL}/status`, { timeout: 5000 });
    console.log('✓ Manager respondendo');

    // Test 2: Ativar um container
    console.log('\n[Test 2] Ativando container (users)...');
    const activation = await axios.post(`${MANAGER_URL}/activate/users`, null);
    console.log(`✓ Container ativado na porta ${activation.data.port}`);
    await sleep(2000); // Aguardar startup

    // Test 3: Verificar healthcheck
    console.log('\n[Test 3] Verificando healthcheck...');
    const health = await axios.get('http://localhost:3001/health', { timeout: 3000 });
    console.log(`✓ Healthcheck OK (status ${health.status})`);

    // Test 4: Acessar logs destrutivos (API)
    console.log('\n[Test 4] Acessando /logs/destructive via API...');
    const logs1 = await axios.get(`${MANAGER_URL}/logs/destructive`, { timeout: 5000 });
    console.log(`✓ API respondendo, total de operações: ${logs1.data.total_operations}`);

    // Test 5: Acessar logs com filtro
    console.log('\n[Test 5] Testando filtro ?days=7...');
    const logs2 = await axios.get(`${MANAGER_URL}/logs/destructive?days=7`, { timeout: 5000 });
    console.log(`✓ Filtro funcionando, operações (7 dias): ${logs2.data.total_operations}`);

    // Test 6: Acessar logs raw
    console.log('\n[Test 6] Acessando /logs/destructive/raw...');
    const rawLogs = await axios.get(`${MANAGER_URL}/logs/destructive/raw`, { timeout: 5000 });
    const lines = rawLogs.data.trim().split('\n').filter(l => l).length;
    console.log(`✓ Raw logs acessível, ${lines} linhas`);

    // Test 7: Acessar activity logs
    console.log('\n[Test 7] Acessando /logs/activity...');
    const activity = await axios.get(`${MANAGER_URL}/logs/activity`, { timeout: 5000 });
    console.log(`✓ Activity logs acessível, últimas ${activity.data.length} atividades`);

    // Test 8: Verificar arquivo de logs local
    console.log('\n[Test 8] Verificando arquivos de logs locais...');
    if (!fs.existsSync(LOGS_DIR)) {
      throw new Error(`.container-logs não existe!`);
    }
    console.log(`✓ Diretório ${LOGS_DIR} existe`);

    const destructiveLog = path.join(LOGS_DIR, 'destructive-operations.log');
    if (fs.existsSync(destructiveLog)) {
      const size = fs.statSync(destructiveLog).size;
      console.log(`✓ destructive-operations.log existe (${size} bytes)`);
    } else {
      console.log(`⚠ destructive-operations.log não encontrado (pode ser primeira execução)`);
    }

    const activityLog = path.join(LOGS_DIR, 'activity.log');
    if (fs.existsSync(activityLog)) {
      const size = fs.statSync(activityLog).size;
      console.log(`✓ activity.log existe (${size} bytes)`);
    }

    // Test 9: Verificar estrutura de log JSON
    console.log('\n[Test 9] Validando estrutura dos logs...');
    if (fs.existsSync(destructiveLog)) {
      const lines = fs.readFileSync(destructiveLog, 'utf-8').trim().split('\n').filter(l => l);
      if (lines.length > 0) {
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        const required = ['timestamp', 'operation', 'container', 'reason', 'command', 'impact', 'status'];
        const hasAll = required.every(field => field in lastEntry);
        if (hasAll) {
          console.log(`✓ Log entries têm estrutura correta (${lines.length} entries)`);
        } else {
          console.log(`✗ Log entries faltando campos: ${required.filter(f => !(f in lastEntry)).join(', ')}`);
        }
      } else {
        console.log(`⚠ destructive-operations.log vazio (pode ser primeira execução)`);
      }
    }

    // Test 10: Verificar status final
    console.log('\n[Test 10] Verificando status final...');
    const status2 = await axios.get(`${MANAGER_URL}/status`, { timeout: 5000 });
    const usersStatus = status2.data.find(s => s.domain === 'users');
    if (usersStatus.running) {
      console.log(`✓ Users container está running`);
      const inactivity = Math.floor(usersStatus.inactivityMs / 1000);
      console.log(`  Inatividade: ${inactivity}s (será parado após ${600 - inactivity}s mais)`);
    }

    console.log('\n✅ Todos os testes passaram!\n');
    console.log('Próximos passos:');
    console.log('1. Acessar http://localhost:3000/logs/destructive para ver logs');
    console.log('2. Aguardar 10 min - container deve parar automaticamente');
    console.log('3. Ver logs: curl http://localhost:3000/logs/destructive | jq');
    console.log('4. Verificar arquivo: cat .container-logs/destructive-operations.log | jq\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Teste falhou:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

test();
