import OpenAI from 'openai';
import 'dotenv/config';

const deepSeakKey = process.env.DEEP_SEEK_KEY;

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepSeakKey,
});

const requestAI = async (link: string) => {
    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: 'system',
                content:
                    "Ти є експертом з аналізу продуктів для здоров'я та краси. Твоє завдання – детально описувати продукти на основі наданих посилань, вказуючи, кому вони підходять, кому слід уникати їх використання, а також надавати загальні професійні рекомендації із застосування. Відповідь має бути чіткою, об'єктивною та базуватися на інформації з джерела.",
            },
            {
                role: 'user',
                content: `Проаналізуй продукт за посиланням: ${link}.  Зпропонуй його клієнту. Будь лаконічним і влучним. Форматуй як повідомлення в telegram. Не додавай гіперпосилання в повідомлення
                `,
            },
        ],
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 1000,
    });

    console.log(completion.choices[0].message.content);

    return completion.choices[0].message.content;
};

export { requestAI };
