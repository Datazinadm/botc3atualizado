// install.js - Instalador automático do C3 NUCLEAR (Bot + API + Painel)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════');
console.log('  C3 NUCLEAR - INSTALADOR DE DEPENDÊNCIAS');
console.log('═══════════════════════════════════════════════\n');

// 1. Lista de dependências
const dependencias = [
    'telegraf',
    'canvas',
    'axios',
    'cheerio',
    'cloudscraper',
    'colors',
    'fake-useragent',
    'gradient-string',
    'header-generator',
    'hpack',
    'randomstring',
    'request',
    'socks',
    'user-agents',
    'systeminformation'
];

// 2. Verificar e instalar dependências
function instalarDependencias() {
    console.log('📦 [1/2] Verificando e instalando dependências...\n');
    
    let instaladas = 0;
    let faltando = [];

    for (const dep of dependencias) {
        try {
            require.resolve(dep);
            console.log(`   ✅ ${dep} — já instalada`);
            instaladas++;
        } catch (e) {
            faltando.push(dep);
        }
    }

    if (faltando.length > 0) {
        console.log(`\n   ⚠️  Faltando ${faltando.length} dependência(s). Instalando...\n`);
        try {
            execSync(`npm install ${faltando.join(' ')}`, { stdio: 'inherit' });
            console.log('\n   ✅ Todas as dependências foram instaladas com sucesso!');
        } catch (err) {
            console.error('\n   ❌ Erro ao instalar dependências:', err.message);
            console.error('   Tente rodar manualmente: npm install ' + faltando.join(' '));
            process.exit(1);
        }
    } else {
        console.log('\n   ✅ Todas as dependências já estão instaladas.');
    }
    console.log('');
}

// 3. Criar arquivos JSON necessários se não existirem
function criarArquivosJSON() {
    console.log('📄 [2/2] Verificando arquivos JSON...\n');
    
    const arquivos = {
        'usuarios_liberados.json': {},
        'alvos_bloqueados.json': [],
        'stats.json': { totalQuedas: 11843, nodesAtivos: 334 },
        'attack_history.json': {},
        'admins.json': ['SEU_ID_AQUI'], // O usuário deve trocar
        'vips.json': {},
        'keys.json': {},
        'default_config.json': { simultaneous: 1, maxTime: 30, expires_at: 0 },
        'free_users.json': []
    };

    for (const [nome, conteudo] of Object.entries(arquivos)) {
        if (!fs.existsSync(nome)) {
            fs.writeFileSync(nome, JSON.stringify(conteudo, null, 2), 'utf8');
            console.log(`   ✅ Criado: ${nome}`);
        } else {
            console.log(`   ℹ️  Já existe: ${nome}`);
        }
    }

    // Criar proxy.txt se não existir
    if (!fs.existsSync('proxy.txt')) {
        fs.writeFileSync('proxy.txt', '# Adicione seus proxies aqui (um por linha)\n', 'utf8');
        console.log('   ✅ Criado: proxy.txt');
    } else {
        console.log('   ℹ️  Já existe: proxy.txt');
    }
    
    console.log('');
}

// 4. Instruções finais
function instrucoesFinais() {
    console.log('═══════════════════════════════════════════════');
    console.log('  ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   • Edite o arquivo `admins.json` e troque "SEU_ID_AQUI" pelo seu ID do Telegram.');
    console.log('   • Edite o `bot.js` e coloque seus tokens e IDs.');
    console.log('');
    console.log('🚀 Para iniciar:');
    console.log('   node bot.js      (inicia o bot do Telegram)');
    console.log('   node api.js      (inicia a API de ataques)');
    console.log('   node painel.js   (inicia o painel web)');
    console.log('');
    console.log('═══════════════════════════════════════════════');
}

// 5. Executar tudo
try {
    instalarDependencias();
    criarArquivosJSON();
    instrucoesFinais();
} catch (err) {
    console.error('❌ Erro inesperado:', err.message);
    process.exit(1);
}