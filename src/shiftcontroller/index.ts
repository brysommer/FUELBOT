import { prisma } from '../lib/prisma';
import { bot } from '..';
import { format } from 'date-fns';
import { delay, formattedDateUA } from '../helpers';

export const shiftChain = () => {
    bot.onText(/\/den/, async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        const driver = await prisma.driver.findUnique({
            where: { chatId: BigInt(chatId) },
        });

        if (driver) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const shift = await prisma.shift.findFirst({
                where: {
                    driverId: driver.id,
                    startedAt: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
                orderBy: {
                    startedAt: 'desc', // бере останню за часом
                },
            });

            if (shift && !shift.endedAt) {
                bot.sendMessage(
                    chatId,
                    `Робочий день розпочато о ${formattedDateUA(shift.startedAt)}. На початок дня ${
                        shift.odometerStart
                    }`,

                    {
                        reply_markup: {
                            keyboard: [[{ text: 'Кінець дня 🏁' }, { text: 'Головне меню 🏠' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    },
                );
            } else {
                const odometrStep = await prisma.driver.update({
                    where: {
                        id: driver.id,
                    },
                    data: {
                        step: 1991,
                    },
                });

                console.log(odometrStep);
                bot.sendMessage(
                    chatId,
                    `Введіть актуальний показник одометра.`,

                    {
                        reply_markup: {
                            keyboard: [[{ text: 'Головне меню 🏠' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    },
                );
            }
        }
    });
    bot.on('text', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        const driver = await prisma.driver.findUnique({
            where: { chatId: BigInt(chatId) },
        });

        console.log(driver);

        if (text === 'Головне меню 🏠') return false;

        if (driver) {
            //comment
            if (driver.step === 1989) {
                if (!text) {
                    const endShiftOdo = await prisma.driver.update({
                        where: {
                            id: driver.id,
                        },
                        data: {
                            step: 0,
                        },
                    });

                    bot.sendMessage(chatId, `Коментар не прийнято. Повертаю до головного меню`, {
                        reply_markup: {
                            keyboard: [[{ text: 'Заправка⛽️' }, { text: 'Робочий день ⏳' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    });
                }
                const recentShift = await prisma.shift.findFirst({
                    where: {
                        driverId: driver.id,
                        report: null,
                    },
                    orderBy: {
                        startedAt: 'desc',
                    },
                });
                if (!recentShift) {
                    bot.sendMessage(
                        chatId,
                        `Усі ваші дні вже містять коментар. Повертаю до головного меню`,
                        {
                            reply_markup: {
                                keyboard: [[{ text: 'Заправка⛽️' }, { text: 'Робочий день ⏳' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                    return;
                }
                const updateComment = await prisma.shift.update({
                    where: {
                        id: recentShift.id,
                    },
                    data: {
                        report: text,
                    },
                });
                if (recentShift?.id && text && updateComment) {
                    const endShiftOdo = await prisma.driver.update({
                        where: {
                            id: driver.id,
                        },
                        data: {
                            step: 0,
                        },
                    });
                    bot.sendMessage(chatId, `Коментар "${text}" прийнято.`, {
                        reply_markup: {
                            keyboard: [[{ text: 'Заправка⛽️' }, { text: 'Робочий день ⏳' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    });
                    await delay(1000);
                    bot.sendMessage(
                        chatId,
                        `Перешліть фото одометра. Натисніть на іконку "скріпка", оберіть зображення з галереї і відправте в діалог з ботом. Фото буде переслано адміністратору.`,
                        {
                            reply_markup: {
                                keyboard: [[{ text: 'Головне меню 🏠' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                } else {
                    bot.sendMessage(chatId, `Коментар не було додано. Зверніться до адміна`, {
                        reply_markup: {
                            keyboard: [[{ text: 'Заправка⛽️' }, { text: 'Робочий день ⏳' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    });
                }
            }
            //start odo
            if (driver.step === 1991) {
                try {
                    const odometerStart = Number(text);

                    const newShift = await prisma.shift.create({
                        data: {
                            driverId: driver.id,
                            odometerStart,
                            startedAt: new Date(),
                        },
                    });

                    const endShiftOdo = await prisma.driver.update({
                        where: {
                            id: driver.id,
                        },
                        data: {
                            step: 0,
                        },
                    });

                    bot.sendMessage(
                        chatId,
                        `Робочий день розпочато, перешліть фото одометра. Натисніть на іконку "скріпка", оберіть зображення з галереї і відправте в діалог з ботом. Фото буде переслано адміністратору.`,
                        {
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Кінець дня 🏁' }, { text: 'Заправка⛽️' }],
                                    [{ text: 'Головне меню 🏠' }],
                                ],
                                one_time_keyboard: true,
                                resize_keyboard: true,
                            },
                        },
                    );
                } catch (error) {
                    bot.sendMessage(
                        chatId,
                        `Введіть дійсне число щоб розпочати зміну`,

                        {
                            reply_markup: {
                                keyboard: [[{ text: 'Головне меню 🏠' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                }
            }
            //end odo
            if (driver.step === 1996) {
                try {
                    const odometerEnd = Number(text);

                    const driverID = driver.id;

                    if (odometerEnd) {
                        const activeShift = await prisma.shift.findFirst({
                            where: {
                                driverId: driver.id,
                                endedAt: null,
                            },
                            orderBy: {
                                startedAt: 'desc',
                            },
                        });

                        if (activeShift) {
                            const updatedShift = await prisma.shift.update({
                                where: {
                                    id: activeShift.id, // update потребує унікального ключа
                                },
                                data: {
                                    odometerEnd,
                                    endedAt: new Date(), // тут логічніше закривати зміну
                                },
                            });

                            if (updatedShift) {
                                const endShiftOdo = await prisma.driver.update({
                                    where: {
                                        id: driverID,
                                    },
                                    data: {
                                        step: 0,
                                    },
                                });

                                const durationHours = () => {
                                    if (updatedShift.endedAt && updatedShift.startedAt) {
                                        const durationMs =
                                            updatedShift?.endedAt?.getTime() -
                                            updatedShift.startedAt.getTime();
                                        return Number((durationMs / (1000 * 60 * 60)).toFixed(2));
                                    }

                                    return null;
                                };

                                const distance =
                                    updatedShift.odometerEnd && updatedShift.odometerStart
                                        ? Number(updatedShift.odometerEnd) -
                                          Number(updatedShift.odometerStart)
                                        : null;

                                const fuelNorm = await prisma.fuelNorm.findUnique({
                                    where: {
                                        driverId: driver.id,
                                    },
                                });

                                const fuelConsumed =
                                    distance && fuelNorm?.norm
                                        ? (fuelNorm.norm * distance) / 100
                                        : null;

                                const shiftUpdate = await prisma.shift.update({
                                    where: {
                                        id: updatedShift.id, // update потребує унікального ключа
                                    },
                                    data: {
                                        distance,
                                        fuelConsumed,
                                        durationHours: durationHours(),
                                    },
                                });

                                const waitingForComment = await prisma.driver.update({
                                    where: {
                                        id: driver.id,
                                    },
                                    data: {
                                        step: 1989,
                                    },
                                });

                                await bot.sendMessage(
                                    chatId,
                                    `✅ Зміну завершено

⏱️ Тривалість: ${shiftUpdate.durationHours?.toFixed(2)} год
🚗 Пробіг: ${distance} км
⛽ Використано пального: ${fuelConsumed?.toFixed(2)} л`,
                                );

                                await delay(500);

                                await bot.sendMessage(
                                    chatId,
                                    `Введіть підсумковий коментар дня одним повідомленням`,
                                );
                            } else {
                                bot.sendMessage(chatId, 'Відсутні активні дні', {
                                    reply_markup: {
                                        keyboard: [[{ text: 'Головне меню 🏠' }]],
                                        one_time_keyboard: false,
                                        resize_keyboard: true,
                                    },
                                });
                            }
                        }
                    } else {
                        bot.sendMessage(chatId, `Спробуйте ще раз`, {
                            reply_markup: {
                                keyboard: [[{ text: 'Головне меню 🏠' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        });

                        return;
                    }
                } catch (error) {
                    bot.sendMessage(
                        chatId,
                        `Введіть дійсне число щоб завершити зміну`,

                        {
                            reply_markup: {
                                keyboard: [[{ text: 'Головне меню 🏠' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                }
            }
            if (text === 'Робочий день ⏳') {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                const shift = await prisma.shift.findFirst({
                    where: {
                        driverId: driver.id,
                        startedAt: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                    orderBy: {
                        startedAt: 'desc', // бере останню за часом
                    },
                });

                console.log(shift);

                if (shift && !shift.endedAt) {
                    bot.sendMessage(
                        chatId,
                        `Робочий день розпочато о ${formattedDateUA(
                            shift.startedAt,
                        )}. На початок дня ${shift.odometerStart}`,

                        {
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Кінець дня 🏁' }, { text: 'Головне меню 🏠' }],
                                ],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                } else {
                    const odometrStep = await prisma.driver.update({
                        where: {
                            id: driver.id,
                        },
                        data: {
                            step: 1991,
                        },
                    });

                    console.log(odometrStep);
                    bot.sendMessage(
                        chatId,
                        `Введіть актуальний показник одометра.`,

                        {
                            reply_markup: {
                                keyboard: [[{ text: 'Головне меню 🏠' }]],
                                one_time_keyboard: false,
                                resize_keyboard: true,
                            },
                        },
                    );
                }
            }
            //deprecated
            if (text === 'Початок дня ⏱️') {
                const odometrStep = await prisma.driver.update({
                    where: {
                        id: driver.id,
                    },
                    data: {
                        step: 1991,
                    },
                });

                console.log(odometrStep);
                bot.sendMessage(
                    chatId,
                    `Введіть актуальний показник одометра.`,

                    {
                        reply_markup: {
                            keyboard: [[{ text: 'Головне меню 🏠' }]],
                            one_time_keyboard: false,
                            resize_keyboard: true,
                        },
                    },
                );
            }

            if (text === 'Кінець дня 🏁') {
                const endShiftOdo = await prisma.driver.update({
                    where: {
                        id: driver.id,
                    },
                    data: {
                        step: 1996,
                    },
                });
                bot.sendMessage(chatId, 'Введіть показник одометра');
            }
        } else {
            //водія не знайдено
        }
    });
};
