// download-server.js
// Uso: node download-server.js
// Acesse: http://localhost:7777/baixa
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 7777;
const PASTA_ATUAL = process.cwd();
const NOME_ZIP = 'sitemac3.zip';
const NOME_PASTA = 'sitemac3';

// Verifica se o comando zip está disponível
function temZip() {
    try {
        execSync('which zip', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

function log(msg) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.log('[' + ts + '] ' + msg);
}

// Cria o zip com todos os .js e proxy.txt dentro da pasta sitemac3/
function criarZip() {
    const zipPath = path.join(PASTA_ATUAL, NOME_ZIP);

    // Remove zip antigo se existir
    if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath); } catch (e) {}
    }

    // Lista arquivos .js e proxy.txt (ignora node_modules)
    const arquivos = [];
    const items = fs.readdirSync(PASTA_ATUAL, { withFileTypes: true });
    for (const item of items) {
        if (!item.isFile()) continue;
        const nome = item.name;
        if (nome.endsWith('.js') || nome === 'proxy.txt') {
            arquivos.push(nome);
        }
    }

    if (arquivos.length === 0) {
        return { ok: false, error: 'Nenhum .js ou proxy.txt encontrado' };
    }

    log('📦 Empacotando ' + arquivos.length + ' arquivo(s) em ' + NOME_ZIP);

    if (temZip()) {
        // Usa o comando zip do sistema (mais rápido)
        const lista = arquivos.map(a => '"' + a + '"').join(' ');
        // Cria pasta temporária sitemac3/ com os arquivos
        const tempDir = path.join(PASTA_ATUAL, NOME_PASTA);
        if (fs.existsSync(tempDir)) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        }
        fs.mkdirSync(tempDir, { recursive: true });

        for (const a of arquivos) {
            fs.copyFileSync(path.join(PASTA_ATUAL, a), path.join(tempDir, a));
        }

        try {
            execSync('cd "' + PASTA_ATUAL + '" && zip -r "' + NOME_ZIP + '" "' + NOME_PASTA + '"', { stdio: 'ignore' });
        } catch (e) {
            return { ok: false, error: 'Falha ao criar zip: ' + e.message };
        } finally {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        }

        return { ok: true, path: zipPath, count: arquivos.length };
    } else {
        // Fallback: cria zip manualmente sem dependência externa
        return criarZipManual(arquivos, zipPath);
    }
}

// Cria ZIP manualmente (fallback quando não tem o comando zip)
// Implementação mínima de ZIP (stored, sem compressão)
function criarZipManual(arquivos, zipPath) {
    try {
        const partes = [];
        const centralDir = [];
        let offset = 0;

        for (const nome of arquivos) {
            const conteudo = fs.readFileSync(path.join(PASTA_ATUAL, nome));
            const nomeCompleto = NOME_PASTA + '/' + nome;
            const nomeBuf = Buffer.from(nomeCompleto, 'utf8');
            const crc = crc32(conteudo);

            // Local file header
            const localHeader = Buffer.alloc(30 + nomeBuf.length);
            localHeader.writeUInt32LE(0x04034b50, 0);       // signature
            localHeader.writeUInt16LE(20, 4);              // version needed
            localHeader.writeUInt16LE(0x0800, 6);          // flags (UTF-8)
            localHeader.writeUInt16LE(0, 8);               // compression (stored)
            localHeader.writeUInt16LE(0, 10);              // mod time
            localHeader.writeUInt16LE(0, 12);              // mod date
            localHeader.writeUInt32LE(crc, 14);            // crc32
            localHeader.writeUInt32LE(conteudo.length, 18); // compressed size
            localHeader.writeUInt32LE(conteudo.length, 22); // uncompressed size
            localHeader.writeUInt16LE(nomeBuf.length, 26); // filename length
            localHeader.writeUInt16LE(0, 28);              // extra length
            nomeBuf.copy(localHeader, 30);

            partes.push(localHeader);
            partes.push(conteudo);

            // Central directory header
            const centralHeader = Buffer.alloc(46 + nomeBuf.length);
            centralHeader.writeUInt32LE(0x02014b50, 0);       // signature
            centralHeader.writeUInt16LE(20, 4);                // version made by
            centralHeader.writeUInt16LE(20, 6);                // version needed
            centralHeader.writeUInt16LE(0x0800, 8);            // flags
            centralHeader.writeUInt16LE(0, 10);                // compression
            centralHeader.writeUInt16LE(0, 12);                // mod time
            centralHeader.writeUInt16LE(0, 14);                // mod date
            centralHeader.writeUInt32LE(crc, 16);              // crc32
            centralHeader.writeUInt32LE(conteudo.length, 20);  // compressed
            centralHeader.writeUInt32LE(conteudo.length, 24);  // uncompressed
            centralHeader.writeUInt16LE(nomeBuf.length, 28);   // filename length
            centralHeader.writeUInt16LE(0, 30);                // extra
            centralHeader.writeUInt16LE(0, 32);                // comment
            centralHeader.writeUInt16LE(0, 34);                // disk
            centralHeader.writeUInt16LE(0, 36);                // internal attr
            centralHeader.writeUInt32LE(0, 38);                // external attr
            centralHeader.writeUInt32LE(offset, 42);           // local header offset
            nomeBuf.copy(centralHeader, 46);

            centralDir.push(centralHeader);

            offset += localHeader.length + conteudo.length;
        }

        const centralBuf = Buffer.concat(centralDir);
        const centralOffset = offset;

        // End of central directory
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4);
        eocd.writeUInt16LE(0, 6);
        eocd.writeUInt16LE(arquivos.length, 8);
        eocd.writeUInt16LE(arquivos.length, 10);
        eocd.writeUInt32LE(centralBuf.length, 12);
        eocd.writeUInt32LE(centralOffset, 16);
        eocd.writeUInt16LE(0, 20);

        const finalBuf = Buffer.concat([...partes, centralBuf, eocd]);
        fs.writeFileSync(zipPath, finalBuf);

        return { ok: true, path: zipPath, count: arquivos.length };
    } catch (e) {
        return { ok: false, error: 'Falha ao criar zip: ' + e.message };
    }
}

// CRC32 para o fallback
let crcTable = null;
function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
}
function crc32(buf) {
    if (!crcTable) crcTable = makeCrcTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    log('📥 ' + req.method + ' ' + rawUrl);

    const pathname = rawUrl.split('?')[0].replace(/\/+$/, '') || '/';

    if (pathname === '/baixa' || pathname === '/baixa/') {
        log('📦 Gerando pacote...');
        const result = criarZip();

        if (!result.ok) {
            log('❌ Erro: ' + result.error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: false, error: result.error }, null, 2));
        }

        log('✅ Zip criado: ' + NOME_ZIP + ' (' + result.count + ' arquivos)');
        log('📤 Enviando download...');

        const stat = fs.statSync(result.path);
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="' + NOME_ZIP + '"',
            'Content-Length': stat.size
        });

        const stream = fs.createReadStream(result.path);
        stream.pipe(res);

        stream.on('end', () => {
            log('✅ Download concluído: ' + NOME_ZIP);
            // Remove o zip depois de enviar
            setTimeout(() => {
                try { fs.unlinkSync(result.path); } catch (e) {}
            }, 2000);
        });

        stream.on('error', (err) => {
            log('❌ Erro no stream: ' + err.message);
            res.end();
        });

        return;
    }

    // Rota raiz
    if (pathname === '/' || pathname === '') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
            status: true,
            service: 'C3 DOWNLOAD SERVER',
            version: '1.0.0',
            endpoint: 'GET /baixa',
            descricao: 'Baixa todos os arquivos .js e proxy.txt em um .zip (pasta sitemac3/)',
            arquivos_incluidos: '.js + proxy.txt (ignora node_modules)',
            zip_nome: NOME_ZIP
        }, null, 2));
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: false, error: 'Rota não encontrada', uso: '/baixa' }, null, 2));
});

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('📦 C3 DOWNLOAD SERVER');
    console.log('═══════════════════════════════════════════');
    console.log('🌐 Servidor: http://localhost:' + PORT);
    console.log('📥 Download: http://localhost:' + PORT + '/baixa');
    console.log('📁 Pasta no zip: ' + NOME_PASTA + '/');
    console.log('📄 Arquivos: todos .js + proxy.txt');
    console.log('⚙️  Comando zip: ' + (temZip() ? 'disponível' : 'NÃO (usando fallback JS)'));
    console.log('═══════════════════════════════════════════\n');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Finalizando servidor...');
    process.exit(0);
});
