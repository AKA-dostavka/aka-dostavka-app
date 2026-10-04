if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user && document.getElementById('user')) {
        document.getElementById('user').textContent = '👋 Здравствуйте, ' + (user.first_name || 'друг') + '!';
    }
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
        s.classList.remove('active');
    });
    const el = document.getElementById('screen-' + name);
    if (el) {
        el.classList.add('active');
        window.scrollTo(0, 0);
    }
    if (name === 'orders') {
        renderOrders();
    }
}

function getOrders() {
    const raw = localStorage.getItem('myOrders');
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveOrders(orders) {
    localStorage.setItem('myOrders', JSON.stringify(orders));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== ОДИНОЧНЫЙ ЗАКАЗ =====
function sendOrder() {
    const address = document.getElementById('address').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const amount = document.getElementById('amount').value.trim();
    const comment = document.getElementById('comment').value.trim();
    const urgent = document.getElementById('urgent').checked;

    if (!address || !phone || !amount) {
        alert('Заполните адрес, телефон и сумму');
        return;
    }

    const order = {
        id: Date.now(),
        address: address,
        phone: phone,
        amount: amount,
        comment: comment,
        urgent: urgent,
        status: 'Новый',
        created: new Date().toLocaleString('ru-RU')
    };

    const orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            window.Telegram.WebApp.sendData(JSON.stringify({
                address: address, phone: phone, amount: amount,
                comment: comment, urgent: urgent
            }));
        } catch (e) { console.log('sendData:', e.message); }
    }

    alert('✅ Заказ сохранён!');

    document.getElementById('address').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('comment').value = '';
    document.getElementById('urgent').checked = false;

    showScreen('main');
}

// ===== ПАКЕТ ЗАКАЗОВ =====
function parseBulkOrders(text) {
    const lines = text.split('\n');
    const parsed = [];
    let current = null;
    const KEYWORDS = ['срочно', 'срочн', 'приоритет', 'быстрее', 'поскорее', 'asap'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = line.match(/^\s*Заказ\s+(\d+)\s*(.*?)\(\s*к оплате\s+([\d\s]+)\s*смн/i);
        if (m) {
            if (current) parsed.push(current);
            current = {
                amount: m[3].replace(/\s/g, ''),
                lines: [],
                prefix: (m[2] || '').trim()
            };
            continue;
        }
        if (current) {
            const am = line.match(/^\s*(?:Адрес и номер|Адрес|Номера|Телефон|Телефоны):\s*(.*)$/i);
            if (am) {
                if (am[1].trim()) current.lines.push(am[1].trim());
                continue;
            }
            if (line.trim()) current.lines.push(line.trim());
        }
    }
    if (current) parsed.push(current);

    const result = [];
    for (let i = 0; i < parsed.length; i++) {
        const o = parsed[i];
        const full = o.lines.join(' ').trim();
        if (!full) continue;

        const combined = ((o.prefix || '') + ' ' + full).toLowerCase();
        let urgent = false;
        for (let k = 0; k < KEYWORDS.length; k++) {
            if (combined.includes(KEYWORDS[k])) { urgent = true; break; }
        }
        if (!urgent && /\b\d{1,2}[:.]\d{2}\b/.test(combined)) urgent = true;

        const pm = full.match(/\+?\d[\d\s]{8,}/);
        let phone = '—';
        let addr = full;
        if (pm) {
            phone = pm[0].trim();
            addr = full.replace(phone, '').replace(/^[\s,;.]+|[\s,;.]+$/g, '');
        }
        if (!addr) addr = '—';

        result.push({ amount: o.amount, phone: phone, address: addr, urgent: urgent });
    }
    return result;
}

function sendBatchOrders() {
    const text = document.getElementById('batch-text').value;
    if (!text.trim()) {
        alert('Вставьте текст с заказами');
        return;
    }

    const parsed = parseBulkOrders(text);

    if (parsed.length === 0) {
        alert('Не удалось найти заказы. Проверьте формат.');
        return;
    }

    const orders = getOrders();
    for (let i = 0; i < parsed.length; i++) {
        const o = parsed[i];
        orders.unshift({
            id: Date.now() + i,
            address: o.address,
            phone: o.phone,
            amount: o.amount,
            comment: '',
            urgent: o.urgent,
            status: 'Новый',
            created: new Date().toLocaleString('ru-RU')
        });
    }
    saveOrders(orders);

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            window.Telegram.WebApp.sendData(JSON.stringify({
                bulk: parsed
            }));
        } catch (e) { console.log('sendData:', e.message); }
    }

    alert('✅ Создано заказов: ' + parsed.length);

    document.getElementById('batch-text').value = '';
    showScreen('main');
}

// ===== СПИСОК =====
function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    const orders = getOrders();

    if (orders.length === 0) {
        container.innerHTML = '<div class="stub"><div class="stub-icon">📋</div><div class="stub-text">Заказов пока нет</div><div class="stub-hint">Создайте первый через «⚡ Быстрый заказ»</div></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const mark = o.urgent ? ' <span class="badge-urgent">🚀 СРОЧНО</span>' : '';
        html += '<div class="order-card">';
        html += '<div class="order-head">📍 ' + escapeHtml(o.address) + mark + '</div>';
        html += '<div class="order-row">📞 ' + escapeHtml(o.phone) + '</div>';
        html += '<div class="order-row">💰 ' + escapeHtml(o.amount) + ' смн</div>';
        if (o.comment) {
            html += '<div class="order-row">📝 ' + escapeHtml(o.comment) + '</div>';
        }
        html += '<div class="order-foot">' + escapeHtml(o.created) + ' • ' + escapeHtml(o.status) + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(reg) { console.log('SW:', reg.scope); })
            .catch(function(err) { console.log('SW err:', err); });
    });
            }
