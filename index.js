import express from 'express'
import {router} from './Router.js'


const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use('/', router)

const start = () => {
    try {
        app.listen(PORT, () => console.log(`server started on port ${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

start();

