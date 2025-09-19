import { Message } from 'node-telegram-bot-api';
import { bot, loggerChat } from '.';
import { prisma } from './lib/prisma';

const forwardPictures = () => {
    bot.on('photo', async (msg: Message) => {
        const chatId = msg.chat.id;

        const photo = msg.photo?.[msg.photo.length - 1];

        const driver = await prisma.driver.findUnique({ where: { chatId: BigInt(chatId) } });

        console.log(JSON.stringify(photo));
        console.log(photo?.file_id);

        if (!photo) return;

        try {
            await bot.sendPhoto(loggerChat, photo.file_id, {
                caption: `Фото від користувача ${driver?.carNumber}`,
            });

            await bot.sendMessage(chatId, 'Фото успішно переслано адміністратору', {
                reply_markup: {
                    keyboard: [[{ text: 'Заправка⛽️' }, { text: 'Зміна 🔃' }]],
                    one_time_keyboard: false,
                    resize_keyboard: true,
                },
            });
        } catch (error) {
            bot.sendMessage(chatId, 'Помилка при пересиланні фото: ' + error);
        }
    });
};

export { forwardPictures };
