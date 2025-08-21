import { CallbackQuery, Message } from "node-telegram-bot-api";
import { adminBot } from "."
import { prisma } from "./lib/prisma";


const adminBotFunction = () => {
    adminBot.onText(/\/start/, async (msg: Message) => {
      const chatId = msg.chat.id;
  
      // Отримуємо всіх водіїв
      const drivers = await prisma.driver.findMany();
  
      if (!drivers.length) {
        await adminBot.sendMessage(chatId, "🚫 Водіїв поки немає.");
        return;
      }
  
      // Формуємо callback-клавіатуру з номерами авто
      const keyboard = {
        reply_markup: {
          inline_keyboard: drivers.map((driver) => [
            {
              text: driver.carNumber, // припускаю, що у моделі є поле carNumber
              callback_data: `driver_${driver.id}`,
            },
          ]),
        },
      };
  
      await adminBot.sendMessage(chatId, "🚘 Оберіть авто:", keyboard);
    });
  
    // Обробка callback натискань
    adminBot.on("callback_query", async (query: CallbackQuery) => {
      const chatId = query.message?.chat.id;
      const data = query.data;
  
      if (!chatId || !data) return;
  
      if (data.startsWith("driver_")) {
        const driverId = parseInt(data.replace("driver_", ""));
        const driver = await prisma.driver.findUnique({
          where: { id: driverId },
        });
  
        if (driver) {
          await adminBot.sendMessage(
            chatId,
            `✅ Ви обрали авто: ${driver.carNumber}\n👨‍✈️ Водій: ${driver.carNumber}`
          );
        } else {
          await adminBot.sendMessage(chatId, "❌ Водія не знайдено.");
        }
      }
    });
  };

export {
    adminBotFunction
}