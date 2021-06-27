function getAllMatchingIndices(str, regex = /it\(/gi) {
  const indices = [];
  let result;
  while ((result = regex.exec(str))) {
    indices.push(result.index);
  }
  return indices;
}

function convertByteToString(data) {
  return String.fromCharCode(...data);
};

function getLineNumber(str, index) {
  const tempString = str.substring(0, index);
  return tempString.split('\n').length;
}

module.exports = {
  getAllMatchingIndices,
  convertByteToString,
  getLineNumber
}