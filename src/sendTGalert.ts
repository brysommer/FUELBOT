import TelegramBot from 'node-telegram-bot-api';

// Ініціалізація бота (токен беремо з екологічних змінних .env)
const bot = new TelegramBot(process.env.ADMIN_BOT_BOT!, { polling: false });
const CHAT_ID = process.env.LOGGER_CHAT!; // Твій особистий ID чату

interface EbayItem {
    itemId: string;
    title: string;
    price: { value: string; currency: string };
    itemWebUrl: string;
    image?: { imageUrl: string };
}

export const sendTelegramAlert = async (item: EbayItem, marketplaceId: string, config: any) => {
    // Витягуємо чистий Legacy ID лоту для формування Deep Link
    const legacyItemId = item.itemId.includes('|') ? item.itemId.split('|')[1] : item.itemId;

    const webUrl = item.itemWebUrl;
    const appUrl = `https://www.ebay.de/itm/${legacyItemId}`; // Лінкує прямо в додаток eBay

    // Красивий прапорець для маркетплейсу
    const flag =
        marketplaceId === 'EBAY_DE'
            ? '🇩🇪 DE'
            : marketplaceId === 'EBAY_PL'
            ? '🇵🇱 PL'
            : marketplaceId === 'EBAY_FR'
            ? '🇫🇷 FR'
            : marketplaceId === 'EBAY_IT'
            ? '🇮🇹 IT'
            : marketplaceId;

    // Текст повідомлення у форматі HTML
    const messageText = `
📱 <b>Знайдено новий лот!</b> [${flag}]

<b>Назва:</b> ${item.title}
<b>Цільовий пошук:</b> <code>${config.query}</code>

💰 <b>Ціна:</b> ${item.price.value} ${item.price.currency}
📦 <b>Тип:</b> Buy It Now

<i>Макс. ліміт у фільтрі: ${config.maxPrice} ${config.currency}</i>
`;

    // Опції для клавіатури з кнопками швидкого переходу
    const options: TelegramBot.SendMessageOptions = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📱 Відкрити в Додатку', url: appUrl },
                    { text: '🌐 Відкрити в Браузері', url: webUrl },
                ],
            ],
        },
    };

    try {
        if (item.image?.imageUrl) {
            // У node-telegram-bot-api для sendPhoto опції йдуть третім аргументом, а caption передається всередині опцій
            await bot.sendPhoto(CHAT_ID, item.image.imageUrl, {
                ...options,
                caption: messageText,
            });
        } else {
            await bot.sendMessage(CHAT_ID, messageText, options);
        }
        console.log(`[Telegram] Успішно надіслано алерт для: ${item.title}`);
    } catch (error: any) {
        console.error('[Telegram Error] Не вдалося надіслати повідомлення:', error.message);
    }
};
