'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config()

const SHEET_ID = process.env.SHEET_ID;
const CELL_RANGE = 'A106:A118'

let doc = null;

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

  console.log('groupId: ' + event.source.groupId);
  console.log('userId: ' + event.source.userId);
  let reportMessage = event.message.text.trim();

  if (filterReportMessage(reportMessage)) {
    (async function() {
      await recordToSheet(reportMessage);
    }());
  } else if (isSetDate(reportMessage)) {
    const strDates = reportMessage.split(' ');
    strDates.shift();

    let result;
    result = await setDateToSheet(strDates);
    /*(async function() {
      result = await setDateToSheet(strDates);
    }());*/

    if (result) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '設定完成' });
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: '日期格式錯誤' });
    }
  }

  return Promise.resolve(null);// client.replyMessage(event.replyToken, echo);
}

function filterReportMessage(reportMessage) {
  const regex = /[0-9]{3}.*/;
  return regex.test(reportMessage);
}

function isSetDate(reportMessage) {
  return reportMessage.substring(0, 4) === '設定日期';
}

function checkDateFormat(strDate) {
  const regex = /[0-9]{2}[\D][0-9]{2}/;
  return regex.test(strDate)
}

async function recordToSheet(reportMessage) {

  try {
    const sheet = await loadSheet(0);
    await sheet.loadCells(CELL_RANGE);
    sheet.getCellByA1('A'+ reportMessage.substring(0, 3)).value = reportMessage;

    await sheet.saveUpdatedCells();

  } catch (err) {
    console.log(err)
  }
}

async function setDateToSheet(strDates) {
  
  for (let i = 0; i < strDates.length; i++) {
    if (!checkDateFormat(strDates[i])) {
      return false;
    }
  }

  try {
    const dateSheet = await loadSheet(1);
    await dateSheet.clear();
    await dateSheet.setHeaderRow([ 'date' ]);

    await dateSheet.addRows(strDates.map(d => {
      return { date: d };
    }));

    return true;
  } catch (err) {
    console.log(err)
  }
}

async function loadDoc() {
  if (doc)
    return;
  
  try {
    doc = new GoogleSpreadsheet(SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo();
    return doc;

  } catch (err) {
    console.log(err);
  }
}

async function loadSheet(sheetIndex) {
  
  try {

    if (doc === null) {
      await loadDoc();
    }
    
    const sheet = await doc.sheetsByIndex[sheetIndex];

    return sheet;

  } catch (err) {
    console.log(err);
  }
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
