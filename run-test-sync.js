const find = require('recursive-path-finder-regexp');
const createObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
const {
  execSync
} = require('child_process');
const fs = require('fs');
const chalk = require('chalk');
const {
  parse
} = require('jest-editor-support');
const path = require('path');

const extractPath = (fpath) => {
  if (fpath.includes(__dirname) && __dirname) {
    return fpath.toString().replace(__dirname, '');
  }
  return fpath.toString()
}
const testFilePath = process.env.TEST_PATH ? extractPath(process.env.TEST_PATH) : "src.*\.test.js";
const totalTestFilePaths = find(new RegExp(testFilePath), {
  exclude: [/__snapshots__/, /.git/, /node_modules/]
});

console.log('totalTestFilePaths:', totalTestFilePaths);
const logger = {
  log: (str) => console.log(chalk.green.bold(str)),
  info: (str) => console.log(chalk.yellow.bold(str)),
  error: (str) => console.log(chalk.redBright.bold(str)),
  success: (str) => console.log(chalk.green.bold('\u2705 ' + str)),
  failure: (str) => console.log(chalk.redBright.bold('\u2022 ' + str)),
};

function getAllMatchingIndices(str, regex = /it\(/gi) {
  const indices = [];
  let result;
  while ((result = regex.exec(str))) {
    indices.push(result.index);
  }
  return indices;
}

function convertByteToString(data) {
  return new Uint8Array(data).reduce(function (acc, byte) {
    return acc + String.fromCharCode(byte);
  }, '');
};

function getLineNumber(str, index) {
  const tempString = str.substring(0, index);
  return tempString.split('\n').length;
}

const getChildren = filePath => parse(path.resolve(filePath)).root.children;

function findFullTestName(selectedLine, children) {
  if (!children) {
    return;
  }
  for (const element of children) {
    if (element.type === 'describe' && selectedLine === element.start.line) {
      return resolveTestNameStringInterpolation(element.name);
    }
    if (element.type !== 'describe' && selectedLine >= element.start.line && selectedLine <= element.end.line) {
      return resolveTestNameStringInterpolation(element.name);
    }
  }
  for (const element of children) {
    const result = findFullTestName(selectedLine, element.children);
    if (result) {
      return resolveTestNameStringInterpolation(element.name) + ' ' + result;
    }
  }
}

function resolveTestNameStringInterpolation(s) {
  const variableRegex = /(\${?[A-Za-z0-9_]+}?|%[psdifjo#%])/gi;
  const matchAny = '(.*?)';
  return s.replace(variableRegex, matchAny);
}

const HeaderTitle = {
  FILE: 'File',
  TEST_NAME: 'Test Name',
  STATUS: 'Status'
}
const logFailurefile = fs.createWriteStream(__dirname + '/failure', {
  flags: 'w'
});
const processFailureLog = function (count, fileName, testName) {
  try {
    logFailurefile.write(`${count} | ${fileName} | ${testName} \n`);
  } catch (e) {
    logger.error('error' + e);
  }
};

const logSuccessFile = fs.createWriteStream(__dirname + '/success', {
  flags: 'w'
});
const processSuccessLog = function (count, fileName, testName) {
  try {
    logSuccessFile.write(`${count} | ${fileName} | ${testName} \n`);
  } catch (e) {
    logger.error('error' + e);
  }
};

function createCsvWriter(fileName = 'tests-report.csv') {
  return createObjectCsvWriter({
    path: fileName,
    header: [{
        id: 'filePath',
        title: HeaderTitle.FILE
      },
      {
        id: 'testName',
        title: HeaderTitle.TEST_NAME
      },
      {
        id: 'status',
        title: HeaderTitle.STATUS
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

const extractTests = (filePath) => {
  const tests = [];
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
          tests.push({
            filePath,
            testName: fullTestName
          });
        })
      }
      resolve(tests);
    });
  });
};

async function runTests() {
  const failedTests = [];
  const passedTests = [];
  const testsToExecute = [];
  for (const filePath of totalTestFilePaths) {
    const tests = await extractTests(filePath);
    testsToExecute.push(...tests);
  };
  logger.info('total test to run: ' + testsToExecute.length);
  testsToExecute.forEach(function ({
    testName,
    filePath
  }, index) {
    try {
      logger.info('running test: ' + (index + 1) + ' ' + testName);
      execSync("node 'node_modules/jest/bin/jest.js' " + filePath + " -t " + '"' + testName + '"');
      processSuccessLog(passedTests.length + 1, filePath, testName);
      passedTests.push({
        filePath,
        testName,
        status: 'PASS'
      });
    } catch (e) {
      processFailureLog(failedTests.length + 1, filePath, testName);
      failedTests.push({
        filePath,
        testName,
        status: 'FAIL'
      });
    }
  });
  return {
    passedTests,
    failedTests,
    totalTestCount: testsToExecute.length,
  };
}

async function run() {
  logger.info('test started running...');
  try {
    console.time('Total test running time:');
    const {
      passedTests,
      failedTests,
      totalTestCount,
    } = await runTests();
    console.log('*****************************************')
    console.timeEnd('Total test running time:');
    if (totalTestCount) {
      logger.log('Tests Summary:');
      logger.success('Total tests: ' + totalTestCount);
      if (passedTests.length) logger.success('Passed tests: ' + passedTests.length);
      if (failedTests.length) {
        logger.log('\u274E Failed tests: ' + failedTests.length)
        logger.error('FailedTest Details:');
        failedTests.map((t) => logger.failure(t.testName));
      } else {
        logger.success('All tests passed...');
      }
      await createCsvReport(failedTests.concat(passedTests));
    };
    console.log('*****************************************')
  } catch (err) {
    logger.error('error in running tests');
    logger.error(err);
  }
}

run();