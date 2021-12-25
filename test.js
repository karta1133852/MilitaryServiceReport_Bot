let rusult = false
const a1 = '12/26'.split(/[\D]/);
    const a2 = '2021-12-26 2asdAsd'.split(/[\D]/);
    if (a1[0] === a2[1] && a1[1] === a2[2]) {
      result = true;
    }

    console.log(result);