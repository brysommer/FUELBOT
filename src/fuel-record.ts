import { Message } from "node-telegram-bot-api";
import { bot } from ".";
import { loggerBot } from ".";
import { prisma } from "./lib/prisma"


const fuelRecord = () => {
    bot.on("message", async (msg: Message) => {
        const chatId = msg.chat.id;
        const text = msg.text;
    
        const driver = await prisma.driver.findUnique({
            where: { chatId: BigInt(chatId) }
          });
    
        if (text === "Заправка⛽️") {
                console.log('Дооо')
              
              if (!driver) {
                return bot.sendMessage(chatId, "Ви ще не зареєстровані. Будь ласка, спочатку /start.");
              }
    
              
    
              if (driver.step === 0) {
                // Крок 1: запитати обсяг заправки
                await bot.sendMessage(chatId, "Введіть обсяг заправки (літри):");
                await prisma.driver.update({
                  where: { id: driver.id },
                  data: { step: 1 }
                });
                return;
              }
              
        }
    
        if (driver?.step === 1 && text) {
            // Зберігаємо обсяг
            const volume = parseFloat(text);
            await prisma.driver.update({
              where: { id: driver.id },
              data: { step: 2 } // переходимо до наступного кроку
            });
            
            // Зберігаємо тимчасово в пам’яті або в базі
            await prisma.fuelRecord.create({
              data: {
                driverId: driver.id,
                volume,
                price: 0, // поки що 0, заповнимо пізніше
                total: 0, // поки що 0
              }
            });
          
            await bot.sendMessage(chatId, "Введіть ціну за літр:");
            return;
          }
          
          if (driver?.step === 2 && text) {
            // Отримуємо ціну
            const price = parseFloat(text);
          
            // Беремо останній запис FuelRecord цього водія без ціни
            const record = await prisma.fuelRecord.findFirst({
              where: { driverId: driver.id, price: 0 },
              orderBy: { createdAt: 'desc' }
            });
          
            if (!record) {
              return bot.sendMessage(chatId, "Сталася помилка. Спробуйте ще раз.");
            }
          
            const total = record.volume * price;
          
            await prisma.fuelRecord.update({
              where: { id: record.id },
              data: { price, total, date: new Date() }
            });
          
            await prisma.driver.update({
              where: { id: driver.id },
              data: { step: 0 } // повертаємо step в початковий стан
            });
          
            return bot.sendMessage(chatId, `Заправка зареєстрована: ${record.volume} л по ${price} грн/л. Загальна сума: ${total} грн.`, {
                reply_markup: {
                  keyboard: [
                    [{ text: "Заправка⛽️" }]
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: false
                }
              }
            );
          }
    })
}

export { 

    fuelRecord

};

