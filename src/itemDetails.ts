import axios from 'axios';
import { analyzeDescriptionWithAI } from './deepseak';
import { CHAT_ID, bot } from './sendTGalert';

// Функція для отримання опису конкретного лота
export const getItemDescription = async (itemId: string, token: string): Promise<string> => {
    try {
        const response = await axios.get(`https://api.ebay.com/buy/browse/v1/item/${itemId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(response.data);

        const summary = await analyzeDescriptionWithAI(
            response.data.description,
            response.data.title,
        );

        bot.sendMessage(CHAT_ID, summary);

        // Опис зазвичай повертається в полі description (часто у форматі HTML)
        return response.data.description || '';
    } catch (error) {
        console.error(`[Error] Не вдалося отримати опис для лота ${itemId}`);
        return '';
    }
};
