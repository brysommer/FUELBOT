import OpenAI from 'openai';
import 'dotenv/config';

const deepSeakKey = process.env.DEEP_SEEK_KEY;

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepSeakKey,
});

// Функція для очищення опису від HTML-тегів (щоб економити токени DeepSeek)
function stripHtml(html: string): string {
    return html
        .replace(/<\/?[^>]+(>|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export const analyzeDescriptionWithAI = async (title: string, rawDescription: string) => {
    // 1. Готуємо текст: очищаємо HTML і обрізаємо занадто довгі мемуари продавців (беремо перші 1500 символів)
    const cleanDescription = stripHtml(rawDescription).substring(0, 1500);

    try {
        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            temperature: 0.2, // Низька температура для точних фактів без "фантазій"
            max_tokens: 400, // Лаконічна відповідь займає мало місця
            messages: [
                {
                    role: 'system',
                    content: `Ти — професійний експерт-оцінювач вживаної техніки Apple (байєр). 
Твоє завдання — проаналізувати Назву (Title) та Опис (Description) лоту з європейського eBay (текст буде німецькою, французькою чи польською, італійсбкою чи англійською).
Тобі потрібно знайти приховані дефекти, згадки про ремонти, неоригінальні деталі або блокування.

Сформуй сухий, лаконічний звіт УКРАЇНСЬКОЮ мовою строго за наступним шаблоном (використовуй тільки ці пункти):

🤖 *Аналіз ШІ:*
• 📱 *Екран:* [Оригінал / Міняний / Розбитий / Подряпаний / Немає даних]
• 🔋 *АКБ:* [Вкажи % якщо є в тексті, або "Не вказано"]
• 🔒 *Блокування:* [Чистий / iCloud lock / MDM / На оператора / Невідомо]
• 🛠 *Дефекти/Ремонт:* [Коротко перерахуй нюанси (наприклад: Не працює Face ID, замінено заднє скло, дефект камери), або напише "Без дефектів"]
• 📦 *Комплект:* [Що йде крім телефону (Коробка, кабель, чохол), або "Тільки телефон"]
• 🆔 *IMEI:* [Якщо в тексті вказано 15-значний номер IMEI або Серійний номер, виведи його сюди без пробілів. Якщо немає — напиши "Не вказано"]
`,
                },
                {
                    role: 'user',
                    content: `Проаналізуй цей лот:
Назва: ${title}
Опис: ${cleanDescription}`,
                },
            ],
        });

        return completion.choices[0].message?.content || '⚠️ Не вдалося згенерувати аналіз ШІ.';
    } catch (error: any) {
        console.error('[AI Error] Помилка запиту до DeepSeek:', error.message);
        return '⚠️ Помилка аналізу ШІ.';
    }
};
