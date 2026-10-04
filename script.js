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
                address: address,
                phone: phone,
                amount: amount,
                comment: comment,
                urgent: urgent
            }));
        } catch (e) {
            console.log('sendData ошибка:', e.message);
        }
    }

    alert('✅ Заказ сохранён! Смотрите в «Мои заказы».');

    document.getElementById('address').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('comment').value = '';
    document.getElementById('urgent').checked = false;

    showScreen('main');
}

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
        const mark = o.urgent ? ' 🚀' : '';
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(reg) {
                console.log('SW ок:', reg.scope);
            })
            .catch(function(err) {
                console.log('SW ошибка:', err);
            });
    });
}
