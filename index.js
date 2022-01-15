'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config()

const SHEET_ID = process.env.SHEET_ID;
const CELL_RANGE = 'A106:B118'

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
    await reportToSheet(reportMessage, reportMessage.substring(0, 3));
  } else if (isSetDate(reportMessage)) {
    const strDates = reportMessage.split(' ');
    strDates.shift();

    let result = await setDateToSheet(strDates);
    return replyLineMessage(event, result, '設定完成', '日期格式錯誤');
  } else if (filterGroupRegister(reportMessage)) {
    // TODO
  } else if (filterNameLists(reportMessage)) {
    // TODO
  } else if (filterDefaultReport(reportMessage)) {
    let studentId = parseInt(reportMessage.split(' ')[1]);
    let strDefaultReport = await getDefaultReport(studentId);
    if (strDefaultReport === false) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '錯誤' });
    }
    await reportToSheet(strDefaultReport, studentId);
    return client.replyMessage(event.replyToken, { type: 'text', text: strDefaultReport });
  } else if (filterPersonalState(reportMessage)) {
    const tmp = reportMessage.split(' ');
    tmp.shift();  // 丟掉開頭的指令
    const studentIds = tmp.filter((v, i) => i % 2 === 0);
    const strStates = tmp.filter((v, i) => i % 2 === 1); 
    
    let result = await setPersonalState(studentIds, strStates);
    return replyLineMessage(event, result, '設定成功', '設定失敗');
  }

  return Promise.resolve(null);
}

// 對指令進行回覆
function replyLineMessage(event, result, textSuccess, textFail) {
  if (result) {
    return client.replyMessage(event.replyToken, { type: 'text', text: textSuccess });
  } else {
    return client.replyMessage(event.replyToken, { type: 'text', text: textFail });
  }
}

function filterReportMessage(reportMessage) {
  // '000 ~~~~~'
  const regex = /^[0-9]{3}.*/;
  return regex.test(reportMessage);
}

function isSetDate(reportMessage) {
  // '設定日期 ~~~~~'
  const regex = /^\u8a2d\u5b9a\u65e5\u671f[ \t].*/;
  return regex.test(reportMessage);
}

function filterGroupRegister(reportMessage) {
  // '註冊群組 000 000'
  const regex = /^\u8a3b\u518a\u7fa4\u7d44[ \t][0-9]{3}[ \t][0-9]{3}$/;
  return regex.test(reportMessage);
}

function filterNameLists(reportMessage) {
  // '設定姓名 000 XXX'
  const regex = /^\u8a2d\u5b9a\u59d3\u540d/;
  return regex.test(reportMessage);
}

function filterDefaultReport(reportMessage) {
  // '預設回報格式 000'
  const regex = /^\u9810\u8a2d\u56de\u5831\u683c\u5f0f[ \t][0-9]{3}$/;
  return regex.test(reportMessage);
}

function filterPersonalState(reportMessage) {
  // '固定狀態 000 ~~~~~'
  const regex = /^\u56fa\u5b9a\u72c0\u614b[ \t][0-9]{3}[ \t].*/;
  return regex.test(reportMessage);
}

function checkDateFormat(strDate) {
  const regex = /^[0-9]{2}[\D][0-9]{2}$/;
  return regex.test(strDate)
}

// TODO db
async function getDefaultReport(studentId) {
  let strDefaultReport = '\n目前在家\n預計不出門\n無飲酒';
  try {
    const sheet = await loadSheet(3);
    await sheet.loadCells(CELL_RANGE);
    strDefaultReport = studentId + ' ' + sheet.getCellByA1('A'+ studentId).value + strDefaultReport;

    return strDefaultReport;
  } catch (err) {
    console.log(err)
    return false;
  }
}

// TODO db
async function setPersonalState(studentIds, strStates) {
  try {
    if (studentIds.length !== strStates.length) {
      return false;
    }
    
    const sheet = await loadSheet(3);
    await sheet.loadCells(CELL_RANGE);

    for (let i = 0; i < studentIds.length; i++) {
      sheet.getCellByA1('B'+ studentIds[i]).value = strStates[i];
    }

    await sheet.saveUpdatedCells();
    return true;
  } catch (err) {
    console.log(err)
    return false;
  }
}

async function reportToSheet(reportMessage, studentId) {
  // TODO db
  try {
    const sheet = await loadSheet(0);
    await sheet.loadCells(CELL_RANGE);
    sheet.getCellByA1('A'+ studentId).value = reportMessage;

    await sheet.saveUpdatedCells();
    
  } catch (err) {
    console.log(err)
  }
}

async function setDateToSheet(strDates) {
  // TODO db
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
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    //await doc.loadInfo();
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
    
    await doc.loadInfo();
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
