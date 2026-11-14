/**
 * config-replacer.js
 * Substitui configurações no arquivo bot.js
 * Uso: node config-replacer.js [caminho-do-bot.js]
 * Padrão: ./bot.js
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÕES — edite aqui
// ============================================
const CONFIG = {
  BOT_TOKEN: '9211492295:AAGO0qojjt7df4eOEBvHIhhi0UK6A3D11zI',
  ADMIN_BOT_TOKEN: '9234817877:AAFPople6YqlkZURKRkffPV9bA4iERPu6mo',
  DONO_ID: '9080327910',
  PROXY_FILE: 'proxy.txt',
  QUEDA_CHANNEL_ID: '-1003931417933',
  API_URL: 'http://103.90.161.181:3333/api.php',
};

// ============================================
// Arquivo alvo
// ============================================
const targetFile = path.resolve(process.argv[2] || './bot.js');

if (!fs.existsSync(targetFile)) {
  console.error(`❌ Arquivo não encontrado: ${targetFile}`);
  process.exit(1);
}

// Backup antes de mexer
const backupFile = `${targetFile}.bak`;
fs.copyFileSync(targetFile, backupFile);
console.log(`📦 Backup criado: ${backupFile}\n`);

let content = fs.readFileSync(targetFile, 'utf8');
let alteracoes = 0;

// ============================================
// Função que substitui o valor de uma constante
// Aceita: const X = '...'  |  const X = "..."  |  const X = `...`  |  let X = ...
// ============================================
function substituirConstante(nome, novoValor) {
  // Regex pega: (const|let|var) NOME (opcional : tipo TS) = 'valor' até o ;
  const regex = new RegExp(
    `((?:const|let|var)\\s+${nome}\\s*(?::\\s*[\\w<>\\[\\]]+)?\\s*=\\s*)(['"\`])([\\s\\S]*?)\\2(\\s*;?)`,
    'm'
  );

  if (!regex.test(content)) {
    console.warn(`⚠️  Constante não encontrada: ${nome}`);
    return;
  }

  content = content.replace(regex, (match, prefixo, quote, antigo, fim) => {
    console.log(`✅ ${nome}`);
    console.log(`   antigo: ${antigo}`);
    console.log(`   novo:   ${novoValor}\n`);
    alteracoes++;
    // Escapa aspas do mesmo tipo do delimitador
    const valorEscapado = novoValor.replace(new RegExp(quote, 'g'), `\\${quote}`);
    return `${prefixo}${quote}${valorEscapado}${quote}${fim}`;
  });
}

// ============================================
// Aplica todas as substituições
// ============================================
for (const [nome, valor] of Object.entries(CONFIG)) {
  substituirConstante(nome, valor);
}

// ============================================
// Salva
// ============================================
if (alteracoes === 0) {
  console.log('⚠️  Nenhuma alteração feita. Verifique os nomes das constantes no bot.js.');
  process.exit(0);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log(`💾 Arquivo salvo: ${targetFile}`);
console.log(`🔧 Total de alterações: ${alteracoes}`);
