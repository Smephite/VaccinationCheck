import * as functions from 'firebase-functions';
import * as express from 'express';

const app = express();

export const webPage = functions.https.onRequest(app);

app.get('/', async(req, res) => {
    res.json({"test":0});
})