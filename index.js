'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), async (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // create a echoing text message
  const echo = { type: 'text', text: event.message.text };

  let message = event.message.text;
  if (filterReportMessage(message)) {
    const sheet_id = process.env.SHEET_ID;
    const cellRange = 'A106:A118'

    try {
      const doc = new GoogleSpreadsheet(sheet_id);
      await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });

      await doc.loadInfo();
      const sheet = await doc.sheetsByIndex[0];
      await sheet.loadCells(cellRange);
      sheet.getCellByA1('A'+ message.substring(0, 3)).value = message;
      console.log('A'+ message.substring(0, 3));

      await sheet.saveUpdatedCells();
    } catch (err) {
      console.log(err)
    }
  }

  return;// client.replyMessage(event.replyToken, echo);
}

function filterReportMessage(message) {
  const regex = new RegExp('\b[0-9]{3}.*');
  return regex.test(message);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
