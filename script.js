if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user && document.getElementById('user')) {
        document.getElementById('user').textContent = '👋 Здравствуйте, ' + (user.first_name || 'друг') + '!';
    }
}

let currentEditId = null;
let currentFilter = 'all';

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
        s.classList.remove('active');
    });
    const el = document.getElementById('screen-' + name);
    if (el) {
        el.classList.add('active');
        window.scrollTo(0, 0);
    }
    if (name === 'orders') renderOrders();
    updateOrdersCount();
}

function getOrders() {
    const raw = localStorage.getItem('myOrders');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveOrders(orders) {
    localStorage.setItem('myOrders', JSON.stringify(orders));
    updateOrdersCount();
}

function updateOrdersCount() {
    const badge = document.getElementById('orders-count');
    if (!badge) return;
    const orders = getOrders();
    const active = orders.filter(function(o) {
        return o.status !== 'Доставлен' && o.status !== 'Отменён' && o.status !== 'Возврат';
    }).length;
    badge.textContent = active > 0 ? active : '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="' + f + '"]').classList.add('active');
    renderOrders();
}

// ===== СОЗДАНИЕ =====
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
        address: address, phone: phone, amount: amount,
        comment: comment, urgent: urgent,
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

// ===== ПАКЕТ =====
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
            current = { amount: m[3].replace(/\s/g, ''), lines: [], prefix: (m[2] || '').trim() };
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
        let phone = '—', addr = full;
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
    if (!text.trim()) { alert('Вставьте текст с заказами'); return; }
    const parsed = parseBulkOrders(text);
    if (parsed.length === 0) { alert('Не удалось найти заказы. Проверьте формат.'); return; }

    const orders = getOrders();
    for (let i = 0; i < parsed.length; i++) {
        const o = parsed[i];
        orders.unshift({
            id: Date.now() + i,
            address: o.address, phone: o.phone, amount: o.amount,
            comment: '', urgent: o.urgent, status: 'Новый',
            created: new Date().toLocaleString('ru-RU')
        });
    }
    saveOrders(orders);

    if (window.Telegram && window.Telegram.WebApp) {
        try { window.Telegram.WebApp.sendData(JSON.stringify({ bulk: parsed })); }
        catch (e) { console.log('sendData:', e.message); }
    }
    alert('✅ Создано заказов: ' + parsed.length);
    document.getElementById('batch-text').value = '';
    showScreen('main');
}

// ===== СТАТУСЫ =====
function statusBadge(status) {
    if (status === 'Новый') return '<span class="badge-status new">🟡 Новый</span>';
    if (status === 'Назначен курьеру') return '<span class="badge-status accepted">🔵 Назначен курьеру</span>';
    if (status === 'Курьер забрал') return '<span class="badge-status accepted">🟠 Курьер забрал</span>';
    if (status === 'В пути') return '<span class="badge-status accepted">🚗 В пути</span>';
    if (status === 'Доставлен') return '<span class="badge-status done">🟢 Доставлен</span>';
    if (status === 'Возврат') return '<span class="badge-status return">↩️ Возврат</span>';
    if (status === 'Отменён') return '<span class="badge-status cancelled">🔴 Отменён</span>';
    return '<span class="badge-status new">' + escapeHtml(status) + '</span>';
}

function canCancel(status) {
    return status === 'Новый' || status === 'Назначен курьеру';
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    const all = getOrders();
    let orders = all;

    if (currentFilter === 'new') {
        orders = all.filter(function(o) {
            return o.status !== 'Доставлен' && o.status !== 'Отменён' && o.status !== 'Возврат';
        });
    } else if (currentFilter === 'done') {
        orders = all.filter(function(o) { return o.status === 'Доставлен'; });
    }

    if (orders.length === 0) {
        container.innerHTML = '<div class="stub"><div class="stub-icon">📋</div><div class="stub-text">Заказов нет</div><div class="stub-hint">Создайте первый через «⚡ Быстрый заказ»</div></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const mark = o.urgent ? ' <span class="badge-urgent">🚀 СРОЧНО</span>' : '';
        let cls = 'order-card';
        if (o.status === 'Доставлен') cls += ' status-done';
        if (o.status === 'Отменён') cls += ' status-cancelled';
        if (o.status === 'Возврат') cls += ' status-return';

        html += '<div class="' + cls + '">';
        html += '<div class="order-head">📍 ' + escapeHtml(o.address) + mark + '</div>';
        html += '<div class="order-row">📞 ' + escapeHtml(o.phone) + '</div>';
        html += '<div class="order-row">💰 ' + escapeHtml(o.amount) + ' смн</div>';
        if (o.comment) {
            html += '<div class="order-row">📝 ' + escapeHtml(o.comment) + '</div>';
        }
        html += '<div class="order-foot"><span>' + escapeHtml(o.created) + '</span>' + statusBadge(o.status) + '</div>';

        // Кнопки действий
        html += '<div class="order-actions">';
        html += '<button class="btn-edit" onclick="editOrder(' + o.id + ')">✏️ Изменить</button>';
        if (canCancel(o.status)) {
            html += '<button class="btn-cancel" onclick="cancelOrder(' + o.id + ')">❌ Отменить</button>';
        }
        if (o.status === 'Доставлен') {
            html += '<button class="btn-return" onclick="returnOrder(' + o.id + ')">↩️ Возврат</button>';
        }
        if (o.status === 'Отменён' || o.status === 'Возврат') {
            html += '<button class="btn-restore" onclick="restoreOrder(' + o.id + ')">🔄 Восстановить</button>';
        }
        html += '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function cancelOrder(id) {
    if (!confirm('Отменить заказ? Курьер его не повезёт.')) return;
    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) { orders[i].status = 'Отменён'; break; }
    }
    saveOrders(orders);
    renderOrders();
}

function returnOrder(id) {
    if (!confirm('Оформить возврат? Заказ будет помечен как возвращённый.')) return;
    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) { orders[i].status = 'Возврат'; break; }
    }
    saveOrders(orders);
    renderOrders();
}

function restoreOrder(id) {
    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) { orders[i].status = 'Новый'; break; }
    }
    saveOrders(orders);
    renderOrders();
}

// ===== РЕДАКТИРОВАНИЕ =====
function editOrder(id) {
    const orders = getOrders();
    const order = orders.find(function(o) { return o.id === id; });
    if (!order) { alert('Заказ не найден'); return; }

    currentEditId = id;
    document.getElementById('edit-address').value = order.address || '';
    document.getElementById('edit-phone').value = order.phone || '';
    document.getElementById('edit-amount').value = order.amount || '';
    document.getElementById('edit-comment').value = order.comment || '';
    document.getElementById('edit-urgent').checked = !!order.urgent;
    showScreen('edit');
}

function saveEdit() {
    if (!currentEditId) return;
    const address = document.getElementById('edit-address').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const amount = document.getElementById('edit-amount').value.trim();
    const comment = document.getElementById('edit-comment').value.trim();
    const urgent = document.getElementById('edit-urgent').checked;

    if (!address || !phone || !amount) {
        alert('Заполните адрес, телефон и сумму');
        return;
    }

    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === currentEditId) {
            orders[i].address = address;
            orders[i].phone = phone;
            orders[i].amount = amount;
            orders[i].comment = comment;
            orders[i].urgent = urgent;
            orders[i].edited = new Date().toLocaleString('ru-RU');
            break;
        }
    }
    saveOrders(orders);
    currentEditId = null;
    alert('✅ Заказ обновлён');
    showScreen('orders');
}

// ===== СТАРТ =====
updateOrdersCount();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(reg) { console.log('SW:', reg.scope); })
            .catch(function(err) { console.log('SW err:', err); });
    });
}
