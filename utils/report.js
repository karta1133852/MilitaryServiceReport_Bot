'use strict';

const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { pgQuery } = require('../controllers/postgresController');
require('dotenv').config()

const totalReport = require('../reportFormat/total.json');
const personReport = require('../reportFormat/person.json');
const singleLine = require('../reportFormat/singleLine.json');

const SHEET_ID = process.env.SHEET_ID;
const CELL_RANGE = 'A106:B118'
const MIN_NUMBER = 106, MAX_NUMBER = 118;

let doc = null;

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

async function pushReportMessage() {

  // create LINE SDK client
  const client = new line.Client(config);

  try {
    // 取得回報日期
    const sqlSelectDate = 'SELECT date FROM report_date;';
    const resDates = await pgQuery(sqlSelectDate);

    if (!checkDate(resDates.rows)) {
      return;
    }

    // 統整訊息
    const sqlSelectPerson = 'SELECT * FROM report_content ORDER BY student_id ASC;';
    const resPersons = await pgQuery(sqlSelectPerson);
    //const sqlSelectGroup = 'SELECT * FROM group_info ORDER BY start_id ASC;';
    //const resGroups = await pgQuery(sqlSelectGroup);

    // 以群組拆分
    const groups = resPersons.rows.reduce((g, p) => {
      const groupId = p.group_id;
      g[groupId] = g[groupId] || [];
      g[groupId].push(p);
      return g;
    }, {}); // 初始化 g

    // 每個群組統整一遍
    for (let groupId in groups) {
      console.log(groupId);
      const reportTotalMessage = writeTextMessage(groups[groupId]);
      // 推送訊息
      client.pushMessage(groupId, reportTotalMessage);
    }
    
    // 清空所有回報紀錄
    const sqlClearContent = 'UPDATE report_content SET content = NULL;';
    const res = await pgQuery(sqlClearContent);
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
    if (rows[i].date === strTime.substring(5, 10)) {
      result = true;
      break;
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

function getPersonalState(resPersons) {
  

  /*try {
    const stateSheet = await loadSheet(3);
    await stateSheet.loadCells(CELL_RANGE);

    const personalStates = [];
    for (let i = MIN_NUMBER; i <= MAX_NUMBER; i++) {
      let strState = stateSheet.getCellByA1('B' + i).value;
      if (stateSheet.getCellByA1('B' + i).value !== null) {
        personalStates.push({ studentId: i, state: strState });
      }
    }

    return personalStates;
  } catch (err) {
    console.log(err);
    return false;
  }*/
}

// not use
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

function writeTextMessage(group) {
  let reportMessage = '統整回報：\n'; // 防止其他人修改重傳時覆蓋第一人的紀錄

  for (let i = 0; i < group.length; i++) {
    const person = group[i];
    const studentId = ('000' + person.student_id).slice(-3);
    if (person.state !== null) {
      reportMessage += studentId + '\n　' + person.state + '\n';
    } else if (person.content === null) {
      reportMessage += studentId + '\n\n';
    } else {
      let splitedLines = person.content.trim().split(/\s*[\r\n]+\s*/g);
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