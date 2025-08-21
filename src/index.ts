import 'dotenv/config';
import TelegramBot, { Message } from "node-telegram-bot-api";
import { prisma } from './lib/prisma';
import { fuelRecord } from "./fuel-record";
import { forwardPictures } from "./forward-pictures";
import { adminBotFunction } from "./admin-bot";

const token = process.env.TELEGRAM_BOT_TOKEN as string;
const loggertoken = process.env.TELEGRAM_LOGGER_BOT_TOKEN as string;
const adminToken = process.env.ADMIN_BOT_BOT as string;
const bot = new TelegramBot(token, { polling: true });
const loggerBot = new TelegramBot(loggertoken, { polling: true });
const loggerChat = process.env.LOGGER_CHAT as string;
const adminBot = new TelegramBot(adminToken, { polling: true });

interface UserData {
  step: number;
  phone?: string;
  carNumber?: string;
  tankVolume?: number;
}

const users: Record<number, UserData> = {};

fuelRecord();
forwardPictures();
adminBotFunction();

const createDriver = async (chatId: number) => {
  const user = users[chatId];

  if (!user || !user.phone || !user.carNumber) {
    throw new Error("Не вистачає даних для створення водія");
  }

  const driver = await prisma.driver.create({
    data: {
      phone: user.phone,
      carNumber: user.carNumber,
      tankVolume: user.tankVolume,
      chatId,
      step: 0
    },
  });

  loggerBot.sendMessage(loggerChat, `Водія створено: телефон ` + driver.phone + ` номер авто: ` + driver.carNumber );
  return driver;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const driver = await prisma.driver.findUnique({
    where: { chatId: BigInt(chatId) }
  });

  if (driver) return bot.sendMessage(chatId, 'Ви вже зареєстровані, можете додавати заправки',

     {
      reply_markup: {
        keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    }

  )

  users[chatId] = { step: 1 };

  bot.sendMessage(chatId, "Привіт! Для початку поділіться своїм номером телефону:", {
    reply_markup: {
      keyboard: [
              [{ text: "Заправка⛽️" }]
            ],
      one_time_keyboard: false,
      resize_keyboard: true,
    },
  });
});

bot.on("contact", (msg: Message) => {
  const chatId = msg.chat.id;

  if (!users[chatId]) return;

  users[chatId].phone = msg.contact?.phone_number || "";
  users[chatId].step = 2;

  bot.sendMessage(chatId, "Дякуємо! Тепер введіть номер вашого авто:");
});

bot.on("message", async (msg: Message) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!users[chatId]) return;

  const user = users[chatId];

  if (user.step === 2 && text) {
    user.carNumber = text;
    user.step = 3;
    bot.sendMessage(chatId, "Чудово! Введіть реальний об’єм вашого бака (в літрах):");
  } else if (user.step === 3 && text) {
    const volume = Number(text);
    if (isNaN(volume)) {
      bot.sendMessage(chatId, "Будь ласка, введіть число (об’єм бака в літрах).");
      return;
    }
    user.tankVolume = volume;
    user.step = 4;

    const driver = await createDriver(chatId);

    if (driver) {
      bot.sendMessage(
        chatId,
        `✅ Реєстрацію завершено!\n\n📱 Телефон: ${driver.phone}\n🚘 Авто: ${driver.carNumber}\n⛽ Бак: ${driver.tankVolume} л\n\nТепер ви можете реєструвати ваші заправки.`, {
          reply_markup: {
            keyboard: [
              [{ text: "Заправка⛽️" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        }
      );
    } else {
      bot.sendMessage(chatId, 'Не вдалося завершити реєстрацію, спробуйте спочатку або зверніться до адміністратора', {
        reply_markup: {
          keyboard: [
            [{ text: "/start" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }
    

  }
});

export {
  bot,
  loggerBot,
  loggerChat,
  adminBot
}
