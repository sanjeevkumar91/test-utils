const find = require('recursive-path-finder-regexp');
const {
  execSync
} = require('child_process');
const fs = require('fs');
const {
  logger
} = require('./logger');
const {
  getChildren,
  findFullTestName,
} = require('./jest-utils');
const {
  createCsvReport
} = require('./csv-writer');
const {
  getAllMatchingIndices,
  convertByteToString,
  getLineNumber
} = require('./utils');

// TODO: need to move to separate file or utils?
const testPaths = find(/src.*\.test.js/, {
  exclude: [/__snapshots__/]
});

const extractTests = (filePath) => {
  const testsToRun = [];
  return new Promise(function (resolve, reject) {
    fs.readFile(filePath, function (err, data) {
      if (err) {
        logger.error(err);
        reject(err)
      };
      const str = convertByteToString(data);
      const allIndices = getAllMatchingIndices(str);
      if (allIndices.length) {
        const children = getChildren(filePath);
        allIndices.forEach((i) => {
          const lineNumber = getLineNumber(str, i);
          const fullTestName = findFullTestName(lineNumber, children)
          testsToRun.push(fullTestName)
        })
      }
      resolve(testsToRun);
    });
  });
};

async function runTests() {
  const failedTests = [];
  let totalTestCount = 0;
  let passedTestCount = 0;
  for (const fileName of testPaths) {
    const tests = await extractTests(fileName);
    tests.forEach(function (testName) {
      totalTestCount++;
      try {
        execSync("node 'node_modules/jest/bin/jest.js' " + fileName + " -t " + '"' + testName + '"');
        passedTestCount++;
      } catch (e) {
        failedTests.push({
          fileName,
          testName,
        });
      }
    });
  }
  return {
    failedTests,
    failedTestsCount: failedTests.length,
    totalTestCount,
    passedTestCount
  };
}

async function run() {
  logger.info('test started running...');
  try {
    const {
      failedTests,
      failedTestsCount,
      totalTestCount,
      passedTestCount
    } = await runTests();

    if (totalTestCount) {
      logger.log('Tests Summary:');
      logger.success('Total tests: ' + totalTestCount);
      if (passedTestCount) logger.success('Passed tests: ' + passedTestCount);
      if (failedTestsCount) logger.log('\u274E Failed tests: ' + failedTestsCount);
      if (failedTestsCount) {
        logger.error('FailedTest Details:');
        failedTests.map((t) => logger.failure(t.testName));
        await createCsvReport(failedTests);
      } else {
        logger.success('All tests passed...');
      }
    };
  } catch (err) {
    logger.error('error in running tests');
    logger.error(err);
  }
}

run();