'use strict';

const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config()

const totalReport = require('../reportFormat/total.json');
const personReport = require('../reportFormat/person.json');
const singleLine = require('../reportFormat/singleLine.json');

const SHEET_ID = process.env.SHEET_ID;
const CELL_RANGE = 'A106:A118'
const MIN_NUMBER = 106, MAX_NUMBER = 118;

let doc = null;

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

async function pushReportMessage() {
  try {
    // 取得回報日期
    const dateSheet = await loadSheet(1);
    const rows = await dateSheet.getRows();
    if (!checkDate(rows)) {
      return;
    }

    const sheet = await loadSheet(0);

    await sheet.loadCells(CELL_RANGE);

    //const reportTotalMessage = writeFlexMessage(sheet);
    const reportTotalMessage = writeTextMessage(sheet);

    await sheet.clear();

    // create LINE SDK client
    const client = new line.Client(config);
    client.pushMessage(process.env.GROUP_ID, reportTotalMessage);
    //console.log(reportTotalMessage);
  } catch (error) {
    console.log(error)
  }
  
}

function checkDate(rows) {
  let result = false;

  const date = new Date();
  date.setHours(date.getHours()+8);
  let strTime = date.toISOString();

  for (let i = 0; i < rows.length; i++) {
    const a1 = rows[i].date.split(/[\D]/);
    const a2 = strTime.split(/[\D]/);
    if (a1[0] === a2[1] && a1[1] === a2[2]) {
      result = true;
    }
  }

  return result;
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

function writeFlexMessage(sheet) {
  const reportTotalMessage = JSON.parse(JSON.stringify(totalReport));
  for (let i = MIN_NUMBER; i <= MAX_NUMBER; i++) {
    const newPerson = JSON.parse(JSON.stringify(personReport));
    let message = sheet.getCellByA1('A' + i).value;
    if (message === null) {
      newPerson.text = '' + i;
      newPerson.color = '#FF0000';
      const emptyLine = JSON.parse(JSON.stringify(singleLine));
      emptyLine.text = ' ';
      reportTotalMessage.contents.body.contents = reportTotalMessage.contents.body.contents.concat([newPerson, emptyLine, emptyLine]);
    } else {
      let splitedLines = message.trim().split(/\s*[\r\n]+\s*/g);
      newPerson.text = splitedLines.shift();
      reportTotalMessage.contents.body.contents.push(newPerson);
      splitedLines.forEach(m => {
        if (m !== null) {
          const newLine = JSON.parse(JSON.stringify(singleLine));
          newLine.text = (m === '') ? ' ' : m.trim();
          reportTotalMessage.contents.body.contents.push(newLine);
        }
      });
    }
  }

  return reportTotalMessage;
}

function writeTextMessage(sheet) {
  let reportMessage = '';
  for (let i = MIN_NUMBER; i <= MAX_NUMBER; i++) {
    let message = sheet.getCellByA1('A' + i).value;
    if (message === null) {
      reportMessage += i + '\n\n';
    } else {
      let splitedLines = message.trim().split(/\s*[\r\n]+\s*/g);
      reportMessage += splitedLines.shift().trim() + '\n';
      splitedLines.forEach(m => {
        if (m !== null) {
          reportMessage += '　' + m.trim() + '\n';
        }
      });
    }
  }

  return {
    type: 'text',
    text: reportMessage
  };
}

// 執行
(async function() {
  await pushReportMessage();
}());