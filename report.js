'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config()

const totalReport = require('./reportFormat/total.json');
const personReport = require('./reportFormat/person.json');
const singleLine = require('./reportFormat/singleLine.json');

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

/*
// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});


// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // create a echoing text message
  const echo = { type: 'text', text: event.message.text };

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});*/

async function test() {
  const sheet_id = process.env.SHEET_ID;
  const CELL_RANGE = 'A106:A118'
  const MIN_NUMBER = 106, MAX_NUMBER = 118;

  try {
    const doc = new GoogleSpreadsheet(sheet_id);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo();

    const sheet = await doc.sheetsByIndex[0];

    await sheet.loadCells(CELL_RANGE);

    const reportTotalMessage = JSON.parse(JSON.stringify(totalReport));
    for (let i = 110; i <= 115; i++) {
      const newPerson = JSON.parse(JSON.stringify(personReport));
      let message = sheet.getCellByA1('A' + i).value;
      if (message === null) {
        newPerson.text = '' + i;
        newPerson.color = '#FF0000';
        const emptyLine = JSON.parse(JSON.stringify(singleLine));
        emptyLine.text = ' ';
        reportTotalMessage.body.contents = reportTotalMessage.body.contents.concat([newPerson, emptyLine, emptyLine]);
      } else {
        let splitedLines = message.trim().split(/\s*[\r\n]+\s*/g);
        newPerson.text = splitedLines.shift();
        reportTotalMessage.body.contents.push(newPerson);
        splitedLines.forEach(m => {
          if (m !== null) {
            const newLine = JSON.parse(JSON.stringify(singleLine));
            newLine.text = (m === '') ? ' ' : m;
            reportTotalMessage.body.contents.push(newLine);
          }
        });
      }
      
    }
    
    //console.log(totalReport.body.contents[3]);
    //await sheet.saveUpdatedCells();

    
    console.log(JSON.stringify(reportTotalMessage));
    // create LINE SDK client
    const client = new line.Client(config);
    client.pushMessage(process.env.GROUP_ID, reportTotalMessage)
    .then(() => {

    })
    .catch((err) => {
      console.log(err);
    });
    //console.log(reportTotalMessage);
  } catch (error) {
    console.log(error)
  }
  
}


// 執行
(async function() {
  await test();
}());