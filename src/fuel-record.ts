import { Message } from "node-telegram-bot-api";
import { bot, loggerChat } from ".";
import { loggerBot } from ".";
import { prisma } from "./lib/prisma"

const delay = (duration: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });
};

const fuelRecord = () => {
	bot.onText(/\/zapravka/, async (msg) => {  

		const chatId = msg.chat.id;
	  
		const driver = await prisma.driver.findUnique({
		  where: { chatId: BigInt(chatId) }
		});
	  
		if (!driver) {
			return bot.sendMessage(chatId, "Ви ще не зареєстровані. Будь ласка, спочатку /start.");
		  }

		  if (driver.step === 0) {

			// Крок 1: обсяг
			await bot.sendMessage(chatId, "Введіть обсяг заправки (літри):");
			await prisma.driver.update({
				where: { id: driver.id },
				data: { step: 1 }
			});
			return;
		  }
	});

  	bot.on("message", async (msg: Message) => {
    	const chatId = msg.chat.id;
    	const text = msg.text;

    	const driver = await prisma.driver.findUnique({
      		where: { chatId: BigInt(chatId) }
   		});

    	if (text === "Заправка⛽️") {

      		if (!driver) {
        		return bot.sendMessage(chatId, "Ви ще не зареєстровані. Будь ласка, спочатку /start.");
      		}

      		if (driver.step === 0) {

				// Крок 1: обсяг
				await bot.sendMessage(chatId, "Введіть обсяг заправки (літри):");
				await prisma.driver.update({
					where: { id: driver.id },
					data: { step: 1 }
				});
				return;
      		}
    	}

		// === КРОК 1: ОБСЯГ ===
		if (driver?.step === 1 && text) {

			const volume = parseFloat(text);

			if (isNaN(volume)) {
				return bot.sendMessage(chatId, "Будь ласка, введіть число (літри).");
			}

			// тимчасовий запис
			await prisma.fuelRecord.create({
				data: {
					driverId: driver.id,
					volume,
					price: 0,
					total: 0,
				}
			});

			await prisma.driver.update({
				where: { id: driver.id },
				data: { step: 2 }
			});

			await bot.sendMessage(chatId, "Введіть ціну за літр:");
			return;
		}

		// === КРОК 2: ЦІНА ===
		if (driver?.step === 2 && text) {
			const price = parseFloat(text);
			if (isNaN(price)) {
				return bot.sendMessage(chatId, "Будь ласка, введіть число (грн/л).");
			}

			const record = await prisma.fuelRecord.findFirst({
				where: { driverId: driver.id, price: 0 },
				orderBy: { createdAt: "desc" }
			});

			if (!record) {
				return bot.sendMessage(chatId, "Сталася помилка. Спробуйте ще раз.");
			}

			const total = record.volume * price;

			await prisma.fuelRecord.update({
				where: { id: record.id },
				data: { price, total }
			});

			await prisma.driver.update({
				where: { id: driver.id },
				data: { step: 3 } // новий крок
			});

			await bot.sendMessage(chatId, "Додайте показник одометра (км):");
			return;
		};

		// === КРОК 3: ОДОМЕТР ===
		if (driver?.step === 3 && text) {

			const odometr = parseInt(text);
			
			if (isNaN(odometr)) {
				return bot.sendMessage(chatId, "Будь ласка, введіть число (одометр).");
			}

			const record = await prisma.fuelRecord.findFirst({
				where: { driverId: driver.id, odometr: null },
				orderBy: { createdAt: "desc" }
			});

			if (!record) {
				return bot.sendMessage(chatId, "Сталася помилка. Спробуйте ще раз.");
			}

			const updated = await prisma.fuelRecord.update({
				where: { id: record.id },
				data: { odometr }
			});

			await prisma.driver.update({
				where: { id: driver.id },
				data: { step: 4 }
			});

			await bot.sendMessage(chatId, "Введіть коментар до заправки");
			return;

		};

			// === КРОК 4: КОМЕНТАР ===
		if (driver?.step === 4 && text) {

			const record = await prisma.fuelRecord.findFirst({
				where: { driverId: driver.id, comment: null },
				orderBy: { createdAt: "desc" }
			});

			if (!record) {
				return bot.sendMessage(chatId, "Сталася помилка. Спробуйте ще раз.");
			}

			const updated = await prisma.fuelRecord.update({
				where: { id: record.id },
				data: { comment: text }
			});

			await prisma.driver.update({
				where: { id: driver.id },
				data: { step: 0 } // Завершуємо процес
			});

  			bot.sendMessage(chatId, 
    `✅ Заправка зареєстрована!  
🛢️ ${updated.volume} л по ${updated.price} грн/л  
📍 Одометр: ${updated.odometr} км  
💸 Сума: ${updated.total} грн
💬 Коментар: ${updated.comment ?? "немає"}
`
);
			await delay(1000);
    
    		loggerBot.sendMessage(loggerChat,
`⛽️ Нова заправка!  
🚗 Авто: ${driver.carNumber}  
🛢️ ${updated.volume} л по 💵 ${updated.price} грн/л  
📍 Одометр: ${updated.odometr} км  
💸 Загальна сума: ${updated.total} грн
💬 Коментар: ${updated.comment ?? "немає"}
`
);
          
    		return bot.sendMessage(chatId, 'Фото одометру та чеку можна переслати після внесення данних',
				{
					reply_markup: {
						keyboard: [[{ text: "Заправка⛽️" }]],
						resize_keyboard: true,
						one_time_keyboard: false
					}
				}
			);
		}
	});   
};

export { 

    fuelRecord

};



