let str = '12/21'
const regex = /[0-9]{2}[\D][0-9]{2}$/;
console.log(regex.test(str));