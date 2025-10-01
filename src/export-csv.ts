import { writeFileSync } from 'fs';
import { format } from 'date-fns';
import { Parser } from 'json2csv';
import { adminBot } from '.';
import { prisma } from './lib/prisma';
import { CallbackQuery } from 'node-telegram-bot-api';
import { FuelRecord, Shift } from '@prisma/client';

const exportcsv = async () => {
    //тут треба передавати в колбек також ід водія ТЗ

    // Обробник натискань
    adminBot.on('callback_query', async (query: CallbackQuery) => {
        const data = query.data;

        const queryData = data?.split('_');

        const driverId = Number(queryData?.[3]);

        const period = queryData?.[2];

        if (data?.startsWith('export_csv')) {
            console.log('IDIDIDIDIID' + queryData);

            const chatId = query.message?.chat.id;

            if (!chatId) return;

            // Отримати всі записи цього водія
            const driver = await prisma.driver.findUnique({
                where: { id: driverId },
            });

            if (!driver) {
                await adminBot.sendMessage(chatId, '❌ Водія не знайдено.');
                return;
            }

            let fromDate: Date | undefined;
            const now = new Date();

            if (period === 'week') {
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - 7);
            } else if (period === 'month') {
                fromDate = new Date(now);
                fromDate.setMonth(now.getMonth() - 1);
            }

            const fillUps = await prisma.fuelRecord.findMany({
                where: {
                    driverId,
                    ...(fromDate ? { date: { gte: fromDate } } : {}),
                },
                orderBy: { date: 'asc' },
            });

            const days = await prisma.shift.findMany({
                where: { driverId, ...(fromDate ? { startedAt: { gte: fromDate } } : {}) },
                orderBy: { startedAt: 'asc' },
            });

            // перетворюємо їх у спільний формат
            const dayEvents = days.map((s) => ({
                type: 'shift',
                id: s.id,
                date: s.startedAt,
                odometerStart: s.odometerStart,
                data: s,
            }));

            const fuelEvents = fillUps.map((f) => ({
                type: 'fuel',
                id: f.id,
                date: f.date,
                odometerStart: f.odometr,
                data: f,
            }));

            // об'єднуємо і сортуємо

            if (!dayEvents.length) {
                await adminBot.sendMessage(chatId, '📂 Даних ще немає.');
                return;
            }

            interface FuelEvent {
                type: string;
                id: number;
                date: Date;
                odometerStart: bigint | null;
                data: FuelRecord;
            }

            interface ShiftEvent {
                type: string;
                id: number;
                date: Date;
                odometerStart: bigint | null;
                data: Shift;
            }

            const dataFillups = fuelEvents.map((r: FuelEvent, i: number, arr: FuelEvent[]) => {
                const currentOdometr = r.odometerStart ?? 0;

                return {
                    rawDate: new Date(r.date),
                    дата: format(new Date(r.date), 'dd.MM.yyyy'),
                    'Початкові спідометра': currentOdometr,
                    'Кінцеві спідометра': 'no Data',
                    Пробіг: 'no Data',
                    'Ціна бензина, грн.': r.data.price,
                    'Витрати, грн.': r.data.total,
                    'Витрати, л.': 'no Data',
                    'Заправлено, л.': r.data.volume,
                    Коментар: 'no Data',
                };
            });

            const dataDays = dayEvents.map((r: ShiftEvent, i: number, arr: ShiftEvent[]) => {
                const currentOdometr = r.odometerStart ?? 0;

                return {
                    rawDate: new Date(r.date),
                    дата: format(new Date(r.date), 'dd.MM.yyyy'),
                    'Початкові спідометра': currentOdometr,
                    'Кінцеві спідометра': r.data.odometerEnd,
                    Пробіг: r.data.distance,
                    'Ціна бензина, грн.': 'no Data',
                    'Витрати, грн.': 'no Data',
                    'Витрати, л.': r.data.fuelConsumed,
                    'Заправлено, л.': 'no Data',
                    Коментар: r.data.report,
                };
            });

            const recordSorted = [...dataFillups, ...dataDays].sort(
                (a, b) => a.rawDate.getTime() - b.rawDate.getTime(),
            );

            type RecordRow = {
                rawDate: Date;
                дата: string;
                'Початкові спідометра': number | bigint | string | null;
                'Кінцеві спідометра': number | bigint | string | null;
                Пробіг: number | string | null;
                'Ціна бензина, грн.': number | string | null;
                'Витрати, грн.': number | string | null;
                'Витрати, л.': number | string | null;
                'Заправлено, л.': number | string | null;
                Коментар: string | null;
                'В баку'?: number; // нова колонка
            };

            const addTankColumn = (records: RecordRow[]) => {
                let tank = 0;
                return records.map((r) => {
                    const used = typeof r['Витрати, л.'] === 'number' ? r['Витрати, л.'] : null;
                    const filled =
                        typeof r['Заправлено, л.'] === 'number' ? r['Заправлено, л.'] : null;

                    if (used !== null) {
                        tank -= used; // витрати -> мінус
                    }
                    if (filled !== null) {
                        tank += filled; // заправка -> плюс
                    }

                    return { ...r, 'В баку': tank };
                });
            };

            const balance = addTankColumn(recordSorted);

            const parser = new Parser({ delimiter: ';' });
            const csv = parser.parse(balance);

            const filePath = './tmp/fuel_report.csv';
            writeFileSync(filePath, '\uFEFF' + csv, 'utf8');

            // Надсилаємо файл
            await adminBot.sendDocument(chatId, filePath, {
                caption: '📊 Ваші дані у форматі CSV',
            });
        }
    });
};

export { exportcsv };
