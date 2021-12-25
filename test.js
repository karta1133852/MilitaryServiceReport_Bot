let str = ' 　114 asdasd';

const regex = new RegExp('/\b[0-9]{3}.*/');
const reg = /[0-9]{3}.*/;

console.log(reg.test(str.trim()));