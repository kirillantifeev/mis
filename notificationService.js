import {PrismaClient} from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

const prisma = new PrismaClient();

const apiKey = process.env.API_KEY;
const projectId = process.env.PROJECT_API;
const urlApi = process.env.URL_API;

export class NotificationService {
    constructor() {
        this.locks = {
            getNewTasks: false,
            createCallTasks: false,
            getResults: false
        }
    }

    async getNewTasksForCalls() {

        if (this.locks.getNewTasks) {
            console.log('get task working')
            return
        }

        try {

            this.locks.getNewTasks = true;

            const appointments = await prisma.schedule.findMany({
                where: {
                    time_from: {
                        gte: new Date(),
                    },
                    is_free: false,
                    addTask: false
                },
                include: {
                    patient: true,
                    doctor: true
                }
            })

            console.log('Взял записи')

            if (appointments.length === 0) {

                console.log('Записей нет')
            } else {

                const bodyData = appointments.map(el => {

                    const minDateCall = new Date(el.time_from);
                    minDateCall.setDate(minDateCall.getDate() - 1)


                    return ({
                        phone: el.patient.phone,
                        body: {
                            phone: el.patient.phone,
                            timezone: "UTC+7",
                            //min_datetime_to_call: `${minDateCall.toISOString().split('T')[0]} 00:00:00`,
                            //max_datetime_to_call: `${el.time_from.toISOString().split('T')[0]} 23:00:00`,
                            //min_time_to_call: '09:00:00',
                            //max_time_to_call: '20:00:00',
                            data: JSON.stringify({
                                patient_fullname: `${el.patient.name} ${el.patient.surname} ${el.patient.patronymic}`,
                                doctor_fullname: `${el.doctor.name} ${el.doctor.surname} ${el.doctor.patronymic}`,
                                date: el.date,
                                time_from: el.time_from
                            })
                        },
                        statusId: 1,
                        callAttempt: 0,
                    })


                })

                await prisma.tasks.createMany({
                    data: bodyData,

                });


                const appointmentsIds = appointments.map(el => el.id)

                await prisma.schedule.updateMany({
                    where: {
                        id: {in: appointmentsIds}
                    },
                    data: {
                        addTask: true
                    }
                })

                console.log('обновил записи')

            }


        } catch (err) {
            console.error("Error", err);
            throw err;
        } finally {
            this.locks.getNewTasks = false;
        }
    }

    async createCallTasksInRobotMia() {

        if (this.locks.createCallTasks) {
            return
        }

        try {

            this.locks.createCallTasks = true;

            const newTasks = await prisma.tasks.findMany({
                where: {
                    OR: [
                        {statusId: 1},
                        {statusId: 2}
                    ],
                    callAttempt: {lt: 3}
                },
            });

            if (newTasks.length !== 0) {

                const newTasksId = newTasks.map(task => {
                    return task.id
                })

                const bodyTasks = newTasks.map(task => {
                    return task.body
                })


                const responseApi = await axios.post(`${urlApi}/calltask/bulk`, {
                    project_id: projectId,
                    api_key: apiKey,
                    data: JSON.stringify(bodyTasks)
                })


                const callsId = Object.values(responseApi.data)
                    .filter(item => {

                        if (!item || typeof item !== 'object') {
                            console.log('log1')
                            return false;

                        }

                        console.log('log2');

                        return item.data && item.data.call_task_id !== undefined;
                    })
                    .map(item => ({
                        id: String(item.data.call_task_id),
                        //statusId: 3
                    }));

                console.log(callsId)

                const callsData = [];

                for (let i = 0; i < callsId.length && i < newTasks.length; i++) {
                    callsData.push({
                        taskId: newTasks[i].id,
                        phone: newTasks[i].phone,
                        callTaskId: Number(callsId[i].id)
                    });
                }

                await prisma.calls.createMany({
                    data: callsData
                });

                const taskIds = callsData.map(call => call.taskId);


                await prisma.tasks.updateMany({
                    where: {
                        id: {in: taskIds}
                    },
                    data: {

                        statusId: 3,
                        callAttempt: {increment: 1}
                    }
                })

                console.log('Отправил API и обновил все')

            } else {
                console.log('Задач нет')
            }

        } catch (err) {
            console.error("Error", err);
            throw err;
        } finally {
            this.locks.createCallTasks = false;
        }
    }

    async getResultsCallsApi() {

        if (this.locks.getResults) {
            return
        }

        try {

            this.locks.getResults = true;

            // const tasksInProcess = await prisma.calls.findMany({
            //     where: {
            //         statusId: 3
            //     }
            // })

            const tasks = await prisma.calls.findMany({
                where: {
                    task: {
                        statusId: 3
                    },
                },
                include: {
                    task: true
                }
            });


            // const tasksInProcess = await prisma.tasks.findMany({
            //     where: {
            //         statusId: 3
            //     },
            //     include: {
            //         calls: true
            //     }
            // })

            const tasksInProcess = tasks.filter(task => task.callData === null);

            if (tasksInProcess.length !== 0) {


                const idTasksInProcess = tasksInProcess.map(el => {
                    return el.callTaskId
                });

                console.log('Запросы ID по звонкам', idTasksInProcess)

                const resultsCallsApi = await axios.post(`${urlApi}/calltask/result-bulk`, {
                    project_id: projectId,
                    api_key: apiKey,
                    call_task_ids: idTasksInProcess
                });


                // const callsApiData = Object.values(resultsCallsApi.data.data)
                //     .filter(item => {
                //             if (!item.error) {
                //                 return false
                //             }
                //
                //             return item && item.phone_number
                //         }
                //     );

                const callsApiData = Object.entries(resultsCallsApi.data.data)
                    //.filter(([key, value]) => !value.errors)
                    .map(([key, value]) => ({
                        id: parseInt(key),
                        ...value
                    }));

                console.log('Все звонки', callsApiData)

                const callsError = callsApiData.filter((value) => value.errors);

                const callsWithoutErrors = callsApiData.filter((value) => !value.errors);

                const callsDone = callsWithoutErrors.filter((call) => call.goals.length !== 0);
                const callsNoConnection = callsWithoutErrors.filter(call => call.goals.length === 0);

                console.log('Ошибочные', callsError)
                console.log('Выполненные задачи', callsDone)
                console.log('Еще не выполненные', callsNoConnection)

                let callsUpdate = null;

                await prisma.$transaction(async (tx) => {
                    for (const call of callsNoConnection) {
                        // const callWithTask = await tx.calls.findUnique({
                        //     where: {
                        //         callTaskId: Number(call.id)
                        //     },
                        //     include: {
                        //         task: true
                        //     }
                        // });

                        const callWithTask = await tx.calls.update({
                            where: {
                                callTaskId: Number(call.id)
                            },
                            data: {
                                callData: JSON.stringify(call.data)
                            },
                            include: {
                                task: true
                            }
                        })

                        if (callWithTask?.task) {
                            await tx.tasks.update({
                                where: {
                                    id: callWithTask.task.id
                                },
                                data: {
                                    statusId: 2
                                }
                            });
                        }
                    }

                    callsUpdate = callsDone.map(el =>
                        prisma.calls.update({
                            where: {
                                callTaskId: Number(el.id)
                            },
                            data: {
                                callData: JSON.stringify(el),
                                completedAt: new Date(),
                            }
                        })
                    );

                });

                if (!callsUpdate) {
                    console.log('error callsUpdate');
                    return
                }

                const updatedCalls = await Promise.all(callsUpdate);

                const tasksIdUpdate = updatedCalls.map(call =>
                    call.taskId
                )


                await prisma.tasks.updateMany({
                    where: {
                        id: {
                            in: tasksIdUpdate
                        }

                    },
                    data: {
                        statusId: 4,
                        completedAt: new Date(),
                    }
                })

                await prisma.tasks.updateMany({
                    where: {
                        callAttempt: 3,
                        statusId: 2
                    },
                    data: {
                        statusId: 4,
                        completedAt: new Date(),
                    }
                })


                console.log('Полуил результаты API и обновил все')

            } else {
                console.log('Нет задач в процессе')
            }

        } catch (err) {
            console.error("Error", err);
            throw err;
        } finally {
            this.locks.getResults = false;
        }

    }
}