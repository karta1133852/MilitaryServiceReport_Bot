let test = '114 asdasdasda';

const regex = new RegExp('\b[0-9]{3}.*');

console.log(regex.test(test));