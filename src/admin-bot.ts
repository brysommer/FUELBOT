import { CallbackQuery, Message } from "node-telegram-bot-api";
import { adminBot } from "."
import { prisma } from "./lib/prisma";


const adminBotFunction = () => {
  adminBot.onText(/\/start/, async (msg: Message) => {

    await adminBot.setMyCommands([

      { command: "/start", description: "Почати спочатку" },

    ]);

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
            text: driver.carNumber,
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

    // ✅ Якщо вибрали авто
    if (data.startsWith("driver_")) {
      const driverId = parseInt(data.replace("driver_", ""));
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });

      if (driver) {
        await adminBot.sendMessage(
          chatId,
          `✅ Ви обрали авто: ${driver.carNumber}\n📊 Оберіть період для статистики:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📅 Тиждень", callback_data: `stats_week_${driverId}` },
                  { text: "🗓️ Місяць", callback_data: `stats_month_${driverId}` },
                  { text: "📊 Весь період", callback_data: `stats_all_${driverId}` },
                ],
              ],
            },
          }
        );
      } else {
        await adminBot.sendMessage(chatId, "❌ Водія не знайдено.");
      }
    }

    // ✅ Якщо вибрали період для статистики
    if (data.startsWith("stats_")) {
      const [_, period, driverIdStr] = data.split("_");
      const driverId = parseInt(driverIdStr);

      let fromDate: Date | undefined;
      const now = new Date();

      if (period === "week") {
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 7);
      } else if (period === "month") {
        fromDate = new Date(now);
        fromDate.setMonth(now.getMonth() - 1);
      }

      const driver = await prisma.driver.findUnique({
        where: { id: driverId }
      });
      
      const records = await prisma.fuelRecord.findMany({
        where: {
          driverId,
          ...(fromDate ? { date: { gte: fromDate } } : {}),
        },
        orderBy: { date: "asc" },
      });

      if (!records.length) {
        await adminBot.sendMessage(chatId, "🚫 Немає даних за цей період.");
        return;
      }

      // ✅ Обчислення статистики
      const liters = records.reduce((sum, r) => sum + r.volume, 0);
      const cost = records.reduce((sum, r) => sum + r.total, 0);

      const firstOdo = records[0].odometr ?? 0;
      const lastOdo = records[records.length - 1].odometr ?? firstOdo;
      const distance = Number(lastOdo) - Number(firstOdo);

      const costPerKm = distance > 0 ? cost / distance : 0;
      const consumption = distance > 0 ? (liters / distance) * 100 : 0;

      // ✅ Відправляємо результат
      await adminBot.sendMessage(
        chatId,
        `📊 Статистика (${period === "week" ? "Тиждень" : period === "month" ? "Місяць" : "Весь період"})  

🚗 Авто: ${driver?.carNumber}
🛢️ Витрачено палива: ${liters.toFixed(2)} л  
💸 Витрати: ${cost.toFixed(2)} грн  
📏 Пробіг: ${distance} км  
⚡️ Витрати на 1 км: ${costPerKm.toFixed(2)} грн/км  
⛽️ Середня витрата: ${consumption.toFixed(2)} л/100 км
`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "📊 Вивести у CSV", callback_data: `export_csv_${period}_${driverId}` }]
    ]
  }
}
      );
    }

    
  });
};


export {
    adminBotFunction
}
