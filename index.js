'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { pgQuery } = require('./controllers/postgresController');
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
  console.log(event.message.text);
  let receivedMessage = event.message.text.trim();

  if (filterReportMessage(receivedMessage)) {

    let result = await updateReportToDB(receivedMessage, receivedMessage.substring(0, 3));
    console.log(`updateReport: ${result}`);

    return Promise.resolve(null);

  } else if (isSetDate(receivedMessage)) {

    const strDates = receivedMessage.split(' ');
    strDates.shift();

    let result = await setDateToDB(strDates);
    return replyLineMessage(event, result, '日期設定完成', '日期格式錯誤');

  } else if (filterGroupRegister(receivedMessage)) {

    let tmp = receivedMessage.split(' ');
    if (!event.source.groupId) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '此處並非群組' });
    }

    let result = await registerGroup(event.source.groupId, parseInt(tmp[1]), parseInt(tmp[2]));
    return replyLineMessage(event, result, '註冊完成', '註冊失敗');

  } else if (filterNameLists(receivedMessage)) {
    // TODO
  } else if (filterDefaultReport(receivedMessage)) {

    let studentId = parseInt(receivedMessage.split(' ')[1]);
    let strDefaultReport = await getDefaultReport(studentId);
    if (strDefaultReport === false) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '錯誤' });
    }
    await updateReportToDB(strDefaultReport, studentId);
    return client.replyMessage(event.replyToken, { type: 'text', text: strDefaultReport });

  } else if (filterPersonalState(receivedMessage)) {

    const tmp = receivedMessage.split(' ');
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

function filterReportMessage(receivedMessage) {
  // '000 ~~~~~'
  const regex = /^[0-9]{3}.*/;
  return regex.test(receivedMessage);
}

function isSetDate(receivedMessage) {
  // '設定日期 ~~~~~'
  const regex = /^\u8a2d\u5b9a\u65e5\u671f[ \t].*/;
  return regex.test(receivedMessage);
}

function filterGroupRegister(receivedMessage) {
  // '註冊群組 000 000'
  const regex = /^\u8a3b\u518a\u7fa4\u7d44[ \t][0-9]{3}[ \t][0-9]{3}$/;
  return regex.test(receivedMessage);
}

function filterNameLists(receivedMessage) {
  // '設定姓名 000 XXX'
  const regex = /^\u8a2d\u5b9a\u59d3\u540d/;
  return regex.test(receivedMessage);
}

function filterDefaultReport(receivedMessage) {
  // '預設回報格式 000'
  const regex = /^\u9810\u8a2d\u56de\u5831\u683c\u5f0f[ \t][0-9]{3}$/;
  return regex.test(receivedMessage);
}

function filterPersonalState(receivedMessage) {
  // '固定狀態 000 ~~~~~'
  const regex = /^\u56fa\u5b9a\u72c0\u614b[ \t][0-9]{3}[ \t].*/;
  return regex.test(receivedMessage);
}

function checkDateFormat(strDate) {
  const regex = /^[0-9]{1,2}[\D][0-9]{1,2}$/;
  return regex.test(strDate)
}

async function registerGroup(groupId, startId, endId) {
  const sqlInsertGroup = `INSERT INTO group_info (group_id, start_id, end_id) VALUES ('${groupId}', ${startId}, ${endId}) ` +
    'ON CONFLICT (group_id) DO UPDATE SET start_id = EXCLUDED.start_id, ' +
    'end_id = EXCLUDED.end_id;';
  const length = endId - startId + 1;
  // 酷炫的方法
  const studentIds = [...Array(length + startId).keys()].slice(startId);
  let strInsertValue = studentIds.map(id => `(${id}, '${groupId}')`).join(', ');
  const sqlInsertPerson = `INSERT INTO report_content (student_id, group_id) VALUES ${strInsertValue} ` +
    'ON CONFLICT (student_id) DO UPDATE SET group_id = EXCLUDED.group_id;';

  const res = await pgQuery(sqlInsertGroup + sqlInsertPerson);
  return res !== null;
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

async function updateReportToDB(receivedMessage, studentId) {
  const sqlUpdateReport = `UPDATE report_content SET content = '${receivedMessage}' WHERE student_id = ${studentId}`;
  const res = await pgQuery(sqlUpdateReport);
  return res !== null;
}

async function setDateToDB(strDates) {

  for (let i = 0; i < strDates.length; i++) {
    if (!checkDateFormat(strDates[i])) {
      return false;
    }
    let tmp = strDates[i].split(/[\D]/);
    strDates[i] = ('00' + tmp[0]).slice(-2) + '-' + ('00' + tmp[1]).slice(-2);
  }

  const strInsertValues = strDates.map(d => `('${d}')`).join(', ');
  const sqlUpdateDate = 'TRUNCATE TABLE report_date; ' +
    `INSERT INTO report_date (date) VALUES ${strInsertValues};`;

  const res = await pgQuery(sqlUpdateDate);
  return res !== null;
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
