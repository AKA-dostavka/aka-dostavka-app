// Показываем имя пользователя из Telegram
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('user').textContent = 
            '👋 Здравствуйте, ' + (user.first_name || 'друг') + '!';
    }
}
function sendOrder() {
    const address = document.getElementById('address').value;
    const phone = document.getElementById('phone').value;
    const amount = document.getElementById('amount').value;
    const comment = document.getElementById('comment').value;
    const urgent = document.getElementById('urgent').checked;

    if (!address || !phone || !amount) {
        alert('Заполните адрес, телефон и сумму');
        return;
    }

    let text = '📦 Новый заказ\n\n';
    text += '📍 ' + address + '\n';
    text += '📞 ' + phone + '\n';
    text += '💰 ' + amount + ' смн\n';
    if (comment) text += '📝 ' + comment + '\n';
    if (urgent) text += '🚀 СРОЧНЫЙ\n';

    alert('Заказ готов:\n\n' + text);
}
