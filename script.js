// Telegram SDK — показываем имя
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;
    if (user && document.getElementById('user')) {
        document.getElementById('user').textContent = 
            '👋 Здравствуйте, ' + (user.first_name || 'друг') + '!';
    }
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

    const data = {
        address: address,
        phone: phone,
        amount: amount,
        comment: comment,
        urgent: urgent
    };

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            window.Telegram.WebApp.sendData(JSON.stringify(data));
            setTimeout(function() {
                window.Telegram.WebApp.close();
            }, 300);
        } catch (e) {
            alert('Ошибка: ' + e.message);
        }
    } else {
        alert('Откройте через Telegram');
    }
}
// v2
