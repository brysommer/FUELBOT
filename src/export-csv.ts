import { writeFileSync } from "fs";
import { format } from "date-fns";
import { Parser } from "json2csv";
import { adminBot } from "."; 
import { prisma } from "./lib/prisma";
import { CallbackQuery } from "node-telegram-bot-api";



const exportcsv = async () => {
  console.log("ПІДКЛЮЧЕНО")
  //тут треба передавати в колбек також ід водія ТЗ

  // Обробник натискань
  adminBot.on("callback_query", async (query: CallbackQuery) => {
    console.log('EXPORT')
    if (query.data === "export_csv") {
      const chatId = query.message?.chat.id;
      if (!chatId) return;
      console.log("EXPORT")
      // Отримати всі записи цього водія
      const driver = await prisma.driver.findUnique({
        where: { chatId: BigInt(chatId) },
      });

      if (!driver) {
        await adminBot.sendMessage(chatId, "❌ Ви не зареєстровані.");
        return;
      }

      const records = await prisma.fuelRecord.findMany({
        where: { driverId: driver.id },
        orderBy: { date: "asc" },
      });

      if (!records.length) {
        await adminBot.sendMessage(chatId, "📂 Даних ще немає.");
        return;
      }

      // Готуємо дані для CSV
      const data = records.map((r) => ({
        дата: format(new Date(r.date), "dd.MM.yyyy"),
        "Початкові спідометра": "-", // треба логіку порахувати
        "Кінцеві спідометра": r.odometr?.toString() ?? "-",
        Пробіг: "-", // можна порахувати через різницю
        "Ціна бензина, грн.": r.price,
        "Витрати, грн.": r.total,
        "Витрати, л.": r.volume,
        "Заправлено, л.": r.volume,
        "Балансовий залишок, л.": "-", // якщо є
        "Заплановані цілі та заходи": "",
      }));

      const parser = new Parser({ delimiter: ";" });
      const csv = parser.parse(data);

      const filePath = "./tmp/fuel_report.csv";
      writeFileSync(filePath, csv, "utf8");

      // Надсилаємо файл
      await adminBot.sendDocument(chatId, filePath, {
        caption: "📊 Ваші дані у форматі CSV",
      });
    }
  });

}

export {

  exportcsv

}
