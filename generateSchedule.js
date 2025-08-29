import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

export const generateSchedule = async (doctorId, days = 7) => {
    const slots = [];
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + days);

    let currentDate = new Date(now);
    currentDate.setUTCHours(0, 0, 0, 0); // UTC время

    while (currentDate <= endDate) {
        if (currentDate.getUTCDay() >= 1 && currentDate.getUTCDay() <= 5) {
            let timeFrom = new Date(currentDate);
            timeFrom.setUTCHours(9, 0, 0, 0); // 9:00 UTC

            const endTime = new Date(currentDate);
            endTime.setUTCHours(21, 0, 0, 0); // 21:00 UTC

            while (timeFrom < endTime) {
                const timeTo = new Date(timeFrom.getTime() + 30 * 60000);

                slots.push({
                    doctor_id: doctorId,
                    date: new Date(currentDate),
                    time_from: new Date(timeFrom),
                    time_to: new Date(timeTo),
                    is_free: true,
                    type: 'PRIMARY'
                });

                timeFrom = timeTo;
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setUTCHours(0, 0, 0, 0);
    }

    await prisma.schedule.createMany({
        data: slots,
        skipDuplicates: true
    });

    console.log(`Создано ${slots.length} слотов`);
}

generateSchedule('1');