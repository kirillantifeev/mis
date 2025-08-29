import Router from 'express';

import {validationResult} from 'express-validator'
import {v4 as uuidv4} from "uuid";
import {PrismaClient} from "@prisma/client";

export const router = new Router();

const prisma = new PrismaClient();

router.post('/authorization', async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }

        const {phone} = req.body;

        if (!phone) {
            return res.status(400).json({message: "Нужно заполнить номер телефона"});
        }

        const patient = await prisma.patients.findUnique({
            where: {
                phone: phone
            }
        })

        if (!patient) {
            return res.status(401).json({message: "Пациент не зарегистрирован"})
        }

        if (patient) {
            return res.status(200).json({success: true, data: patient, message: "Пациент зарегистрирован"})
        }


    } catch (err) {
        res.status(500).json({message: err.message})
    }
})

router.post('/doctors', async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }

        const {name, surname, spec} = req.body;

        if (!name || !surname || !spec) {
            return res.status(400).json({message: "Нужно заполнить все данные"});
        }

        const doctor = await prisma.doctors.findFirst({
            where: {
                name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
                surname: surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase(),
                spec: spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase(),
            }
        })

        if (!doctor) {
            return res.status(400).json({message: "Врач не найден"})
        }

        return res.status(200).json(doctor);


    } catch (err) {
        res.status(500).json({message: err.message})
    }
})

router.post('/patients', async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }


        const {phone, name, surname, patronymic, gender} = req.body;

        if (!phone || !name || !surname || !gender) {
            return res.status(400).json({message: "Нужно заполнить все обязательные поля"});
        }


        const existingPatient = await prisma.patients.findUnique({
            where: {phone}
        });

        if (existingPatient) {
            return res.status(400).json({message: "Пациент с таким номером телефона уже существует"})
        }

        const patient = await prisma.patients.create({
            data: {
                phone,
                name,
                surname,
                patronymic,
                gender: gender.toUpperCase(),
            }
        })

        res.status(200).json(patient)
    } catch (e) {
        res.status(500).json({error: e.message})
    }
})

router.post('/schedule', async (req, res) => {
    try {
        const {doctor_id, patient_id, time_from, time_to, is_free, date} = req.body;


        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({message: "Ошибка получения расписания", errors})
        }

        const where = {
            date: new Date(date),
        };

        if (time_from) {

            const date = new Date(time_from);

            date.setHours(date.getHours() + 4)

            where.time_from = {gte: date};
        }

        if (time_to) {
            const date = new Date(time_to);

            date.setHours(date.getHours() + 4)

            where.time_to = {lte: date}
        }

        if (is_free === "true") {
            where.is_free = true;
        }
        ;

        if (is_free === "false") {
            where.is_free = false;
        }

        if (doctor_id) {
            where.doctor_id = doctor_id;
        }

        if (patient_id) {
            where.patient_id = patient_id;
        }

        const schedule = await prisma.schedule.findMany({
            where,
            include: {
                doctor: true,
                patient: true,
            },
        });


        return res.status(200).json(schedule)
    } catch (error) {
        res.status(500).json({error: error.message});
    }
})

// router.post('/appointments', async (req, res) => {
//     try {
//         const {patient_id, doctor_id, schedule_id} = req.body;
//
//         if (!patient_id || !doctor_id || !schedule_id) {
//             return res.status(400).json({message: "Заполните все обязательные поля"})
//         }
//
//         const [patient, doctor, slot] = await Promise.all([
//             prisma.patients.findUnique({
//                 where: {id: patient_id}
//             }),
//             prisma.doctors.findUnique({
//                 where: {id: doctor_id}
//             }),
//             prisma.schedule.findUnique({
//                 where: {id: schedule_id}
//             })
//         ])
//
//         if (!patient || !doctor || !slot) {
//             return res.status(400).json({message: 'Таких данных не существует'})
//         }
//
//         if (slot.time_to <= new Date()) {
//             return res.status(400).json({message: 'Данная запись уже прошла'})
//         }
//
//         if (!slot.is_free) {
//             return res.status(400).json({message: 'Данное время уже занято'})
//         }
//
//         let type = "PRIMARY";
//
//         const checkingSlots = await prisma.schedule.findMany({
//             where: {
//                 patient_id: patient_id,
//                 doctor_id: doctor_id,
//             }
//         })
//
//         if (checkingSlots.length > 0) {
//             type = "FOLLOW_UP";
//         }
//
//         const updatedSlot = await prisma.schedule.update({
//             where: {id: schedule_id},
//             data: {
//                 patient_id: patient_id,
//                 is_free: false,
//                 type: type
//             }
//         })
//
//         res.status(200).json(updatedSlot);
//     } catch (e) {
//         return res.status(500).json({error: e.message})
//     }
// })

router.post('/appointments', async (req, res) => {
    try {
        const {patient_id, doctor_id, date, time_from} = req.body;

        if (!patient_id || !doctor_id) {
            return res.status(400).json({message: "Заполните все обязательные поля"})
        }

        const [patient, doctor, slot] = await Promise.all([
            prisma.patients.findUnique({
                where: {id: patient_id}
            }),
            prisma.doctors.findUnique({
                where: {id: doctor_id}
            }),
            prisma.schedule.findFirst({
                where: {
                    doctor_id: doctor_id,
                    date: new Date(date),
                    time_from: new Date(new Date(time_from).getTime() + 7 * 60 * 60 * 1000)
                }
            })
        ])

        if (!patient || !doctor || !slot) {
            return res.status(400).json({message: 'Таких данных не существует'})
        }

        if (slot.time_to <= new Date()) {
            return res.status(400).json({message: 'Данная запись уже прошла'})
        }

        if (!slot.is_free) {
            return res.status(400).json({message: 'Данное время уже занято'})
        }

        let type = "PRIMARY";

        const checkingSlots = await prisma.schedule.findMany({
            where: {
                patient_id: patient_id,
                doctor_id: doctor_id,
            }
        })

        if (checkingSlots.length > 0) {
            type = "FOLLOW_UP";
        }

        const updatedSlot = await prisma.schedule.update({
            where: {id: slot.id},
            data: {
                patient_id: patient_id,
                is_free: false,
                type: type
            }
        })

        res.status(200).json(updatedSlot);
    } catch (e) {
        return res.status(500).json({error: e.message})
    }
})