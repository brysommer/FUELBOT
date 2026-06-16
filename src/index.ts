import 'dotenv/config';
import { prisma } from './lib/prisma';
import axios from 'axios';
import { sendTelegramAlert } from './sendTGalert';
import { getEbayAppToken } from './getEbayToken';
import { getValidToken } from './tokenrefresh';

const MARKETPLACES = [
    'EBAY_DE', // Німеччина
    'EBAY_FR', // Франція
    'EBAY_IT', // Італія
    'EBAY_ES', // Іспанія
    'EBAY_PL', // Польща
];

interface UserData {
    step: number;
    phone?: string;
    carNumber?: string;
    tankVolume?: number;
}

const checkLotsForConfig = async (config: any, marketplaceId: string, token: string) => {
    try {
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
                'Cache-Control': 'no-cache',
            },
            params: {
                q: config.query,
                limit: 10, // Нам потрібні тільки найсвіжіші топ-10
                sort: 'newlyListed',
                // Динамічний фільтр з нашої бази даних
                filter: `price:[${config.minPrice}..${config.maxPrice}],priceCurrency:${config.currency},buyingOptions:{FIXED_PRICE}`,
            },
        });

        const rawItems = response.data.itemSummaries || [];

        // 2. Одразу відфільтровуємо: залишаємо ЛИШЕ ті, де маркетплейс створення НЕ 'EBAY_US'
        const items = rawItems.filter((item: any) => item.listingMarketplaceId !== 'EBAY_US');

        // Можна вивести в консоль для контролю, скільки американського сміття ми відсікли
        const skippedCount = rawItems.length - items.length;
        if (skippedCount > 0) {
            console.log(`[Filter] Відсічено ${skippedCount} лотів з американського eBay (EBAY_US)`);
        }

        console.log(items);

        for (const item of items) {
            // Валідація на ключові слова-паразити (можна теж винести в БД як глобальний чорний список)
            const titleLower = item.title.toLowerCase();
            if (titleLower.includes('box only')) {
                continue;
            }

            // Перевірка дедуплікації
            const alreadyTracked = await prisma.trackedItem.findUnique({
                where: { id: item.itemId },
            });
            if (alreadyTracked) continue;

            // Логуємо в базу, що ми його знайшли
            await prisma.trackedItem.create({
                data: {
                    id: item.itemId,
                    title: item.title,
                    price: parseFloat(item.price.value),
                    currency: item.price.currency,
                    url: item.itemWebUrl,
                    marketplace: marketplaceId,
                },
            });

            // Надсилаємо сповіщення
            await sendTelegramAlert(item, marketplaceId, config);
        }
    } catch (error: any) {
        console.error(
            `Помилка парсингу для запиту "${config.query}" на ${marketplaceId}:`,
            error.message,
        );
    }
};

// Головний цикл
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startHunting = async () => {
    // 1. Беремо з бази тільки активні фільтри
    const activeConfigs = await prisma.searchConfig.findMany({
        where: { isActive: true },
    });

    if (activeConfigs.length === 0) return;

    const DEFAULT_DELAY = 12000;

    const token = await getValidToken();

    // 2. Проходимо по кожному фільтру послідовно
    for (const config of activeConfigs) {
        // Змінюємо Promise.all на послідовний цикл по маркетплейсах
        for (const marketplaceId of MARKETPLACES) {
            try {
                // Виконуємо запит для конкретного маркетплейса
                await checkLotsForConfig(config, marketplaceId, token);

                // Беремо індивідуальну затримку з бази (якщо додаси таке поле) або дефолтну
                //const delay = config.delayMs ?? DEFAULT_DELAY;

                console.log(`Чекаємо ${DEFAULT_DELAY}мс перед наступним запитом...`);
                await sleep(DEFAULT_DELAY);
            } catch (error) {
                console.error(
                    `Помилка під час перевірки ${marketplaceId} для конфігу ${config.id}:`,
                    error,
                );
                // Навіть якщо сталася помилка, варто почекати перед наступним маркетплейсом
                await sleep(DEFAULT_DELAY);
            }
        }
    }
};
