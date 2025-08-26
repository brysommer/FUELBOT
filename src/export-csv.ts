import { writeFileSync } from "fs";
import { format } from "date-fns";
import { Parser } from "json2csv";
import { adminBot } from "."; 
import { prisma } from "./lib/prisma";
import { CallbackQuery } from "node-telegram-bot-api";



const exportcsv = async () => {
  
  //тут треба передавати в колбек також ід водія ТЗ

  // Обробник натискань
  adminBot.on("callback_query", async (query: CallbackQuery) => {
    const data = query.data;

    const queryData = data?.split("_")

    

    const driverId = Number(queryData?.[3]);
    
    const period = queryData?.[2];
    

    if (data?.startsWith("export_csv")) {
      console.log("IDIDIDIDIID" + queryData)
      
      const chatId = query.message?.chat.id;

      if (!chatId) return;
      
      // Отримати всі записи цього водія
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });

      if (!driver) {
        await adminBot.sendMessage(chatId, "❌ Водія не знайдено.");
        return;
      }

      let fromDate: Date | undefined;
      const now = new Date();

      if (period === "week") {
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 7);
      } else if (period === "month") {
        fromDate = new Date(now);
        fromDate.setMonth(now.getMonth() - 1);
      }

      const records = await prisma.fuelRecord.findMany({
        where: {
          driverId,
          ...(fromDate ? { date: { gte: fromDate } } : {}),
        },
        orderBy: { date: "asc" },
      });

      if (!records.length) {
        await adminBot.sendMessage(chatId, "📂 Даних ще немає.");
        return;
      }

      const data = records.map((r, i, arr) => {
        const prevOdometr = i > 0 ? arr[i - 1].odometr ?? 0 : 0;
        const currentOdometr = r.odometr ?? 0;
        const distance = Number(currentOdometr) - Number(prevOdometr);
      
        return {
          дата: format(new Date(r.date), "dd.MM.yyyy"),
          "Початкові спідометра": prevOdometr.toString(),
          "Кінцеві спідометра": currentOdometr.toString(),
          "Пробіг": distance >= 0 ? distance.toString() : "-",
          "Ціна бензина, грн.": r.price,
          "Витрати, грн.": r.total,
          "Витрати, л.": r.volume,
          "Заправлено, л.": r.volume,
          "Коментар": r.comment ?? "",
        };
      });
      

      const parser = new Parser({ delimiter: ";" });
      const csv = parser.parse(data);

      const filePath = "./tmp/fuel_report.csv";
      writeFileSync(filePath, "\uFEFF" + csv, "utf8");

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
