import 'dotenv/config';
import connectDB from "./db/db.js";
import { app } from './app.js';

const port = process.env.PORT || 8000

connectDB()
.then(() => {
    app.on('error', (error) => {
        console.log("ERRR: ", error);
        process.exit(1)
    })

    app.listen(port, () => {
        console.log(`The app is listening at port: ${port}`)
    })
})
.catch((error) => {
    console.log(`MONGODB CONNECTION FAILED: ${error}`)
})
