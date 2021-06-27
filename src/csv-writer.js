const createObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
const {
  logger
} = require('./logger');

const HeaderTitle = {
  File: 'File',
  TestName: 'Test Name'
}

function createCsvWriter(fileName = 'failure-tests.csv') {
  return createObjectCsvWriter({
    path: fileName,
    header: [{
        id: 'fileName',
        title: HeaderTitle.File
      },
      {
        id: 'testName',
        title: HeaderTitle.TestName
      }
    ]
  });
};

async function createCsvReport(data) {
  try {
    const csvWriter = createCsvWriter();
    await csvWriter.writeRecords(data);
    logger.success('records written successfully...');
  } catch (err) {
    logger.error('error in writing to csv');
    logger.error(err);
  }
}

module.exports = {
  createCsvWriter,
  createCsvReport
}