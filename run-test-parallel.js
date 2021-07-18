/* eslint-disable */
// install below dependencies
// npm install --save-dev recursive-path-finder-regexp csv-writer jest-editor-support chalk
// yarn add recursive-path-finder-regexp csv-writer jest-editor-support chalk
const find = require('recursive-path-finder-regexp');
const createObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
const { exec } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');
const { parse } = require('jest-editor-support');
const path = require('path');
const os = require('os');

/**
 * extracts file path
 * @param {string} fpath - file path
 * @returns {string} - formatted file path
 */
const extractPath = (fpath) => {
  if (fpath.includes(__dirname) && __dirname) {
    return fpath.toString().replace(__dirname, '').replace('/', '');
  }
  return fpath.toString();
};

const testFilePath = process.env.TEST_PATH ? extractPath(process.env.TEST_PATH) : 'src.*.test.js';
const totalTestFilePaths = find(new RegExp(testFilePath), {
  exclude: [/__snapshots__/, /.git/, /node_modules/],
});

console.log('totalTestFilePaths:', totalTestFilePaths);
const logger = {
  log: (str) => console.log(chalk.green.bold(str)),
  info: (str) => console.log(chalk.yellow.bold(str)),
  error: (str) => console.log(chalk.redBright.bold(str)),
  success: (str) => console.log(chalk.green.bold('\u2705 ' + str)),
  failure: (str) => console.log(chalk.redBright.bold('\u2022 ' + str)),
};

/**
 *
 * @param {string} str - source data
 * @param {regex} regex - regex pattern to search
 * @returns {number[]} - returns macting indices for the regex
 */
function getAllMatchingIndices(str, regex = / it\(| it.each/gi) {
  const indices = [];
  let result;
  while ((result = regex.exec(str))) {
    indices.push(result.index);
  }
  return indices;
}

/**
 * converts byte to string
 * @param {Buffer}
 * @returns {string} returns stringyfied data
 */
function convertByteToString(data) {
  return new Uint8Array(data).reduce(function (acc, byte) {
    return acc + String.fromCharCode(byte);
  }, '');
}

/**
 * Get's the line number
 * @param {string} str
 * @param {number} index
 * @returns {number} line number of the matching index
 */
function getLineNumber(str, index) {
  const tempString = str.substring(0, index);
  return tempString.split('\n').length;
}

// jest-runner vs-code extension: refer: https://github.com/firsttris/vscode-jest-runner/blob/master/src/JestRunnerCodeLensProvider.ts
const getChildren = (filePath) => parse(path.resolve(filePath)).root.children;

// jest-runner vs-code extension: refer: https://github.com/firsttris/vscode-jest-runner/blob/master/src/util.ts
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

// jest-runner vs-code extension: refer: https://github.com/firsttris/vscode-jest-runner/blob/master/src/util.ts
function resolveTestNameStringInterpolation(s) {
  const variableRegex = /(\${?[A-Za-z0-9_]+}?|%[psdifjo#%])/gi;
  const matchAny = '(.*?)';
  return s.replace(variableRegex, matchAny);
}

const HeaderTitle = {
  FILE: 'File',
  TEST_NAME: 'Test Name',
  STATUS: 'Status',
};
const failureLogfile = fs.createWriteStream(__dirname + '/failure', {
  flags: 'w',
});
/**
 * logs the failure tests
 * @param {number} count - row count
 * @param {string} fileName
 * @param {string} testName
 */
const logFailure = function (count, fileName, testName) {
  try {
    failureLogfile.write(`${count} | ${fileName} | ${testName} \n`);
  } catch (e) {
    logger.error('error' + e);
  }
};

/**
 * logs the success tests
 * @param {number} count - row count
 * @param {string} fileName
 * @param {string} testName
 */
const successLogFile = fs.createWriteStream(__dirname + '/success', {
  flags: 'w',
});
const logSuccess = function (count, fileName, testName) {
  try {
    successLogFile.write(`${count} | ${fileName} | ${testName} \n`);
  } catch (e) {
    logger.error('error' + e);
  }
};

/**
 * creates csv Object writer instance
 * @param {string} fileName
 * @returns {object}
 */
function createCsvWriter(fileName = 'tests-report.csv') {
  return createObjectCsvWriter({
    path: fileName,
    header: [
      {
        id: 'filePath',
        title: HeaderTitle.FILE,
      },
      {
        id: 'testName',
        title: HeaderTitle.TEST_NAME,
      },
      {
        id: 'status',
        title: HeaderTitle.STATUS,
      },
    ],
  });
}

/**
 * creates csv report
 * @param {object[]} data
 */
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

/**
 * extracts the individual tests from the test file
 * @param {string} filePath
 * @returns
 */
const extractTests = (filePath) => {
  const tests = [];
  return new Promise(function (resolve, reject) {
    fs.readFile(filePath, function (err, data) {
      if (err) {
        logger.error(err);
        reject(err);
      }
      const str = convertByteToString(data);
      const allIndices = getAllMatchingIndices(str);
      if (allIndices.length) {
        const children = getChildren(filePath);
        allIndices.forEach((i) => {
          const lineNumber = getLineNumber(str, i);
          const fullTestName = findFullTestName(lineNumber, children);
          if (fullTestName) {
            tests.push({
              filePath,
              testName: fullTestName,
            });
          }
        });
      }
      resolve(tests);
    });
  });
};

/**
 * promisfying the exec node function
 * @param {string} cmd
 * @returns {Promise}
 */
async function execPromise(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, function (err, stdout, _) {
      if (err) return reject(err);

      return resolve(stdout);
    });
  });
}

/**
 * runs the test in promise
 * @param {object} object has filePath and testName
 * @returns {object} success or failure object
 */
async function runTestPromise({ filePath, testName }) {
  try {
    logger.info('running test: ' + testName);
    await execPromise(
      "node 'node_modules/jest/bin/jest.js' " + filePath + ' -t ' + '"' + testName + '" --testTimeout 90000 --forceExit'
    );
    return {
      filePath,
      testName,
      status: 'PASS',
    };
  } catch (e) {
    return {
      filePath,
      testName,
      status: 'FAIL',
    };
  }
}

/**
 * runs the tests and logs the results
 * @returns void
 */
async function runTests() {
  const failedTests = [];
  const passedTests = [];
  const testsToExecute = [];
  for (const filePath of totalTestFilePaths) {
    const tests = await extractTests(filePath);
    testsToExecute.push(...tests);
  }
  logger.info('total test to run: ' + testsToExecute.length);

  const MAX_PARALLEL = process.env.MAX_PARALLEL || os.cpus().length / 2;
  logger.info('running tests with max parallel: ' + MAX_PARALLEL);
  for (let i = 0; i < testsToExecute.length; i = i + MAX_PARALLEL) {
    const tests = testsToExecute.slice(i, i + MAX_PARALLEL);
    await Promise.all(tests.map((t) => runTestPromise(t))).then(async (testResults) => {
      testResults.forEach((t) => {
        if (t.status === 'PASS') {
          logSuccess(passedTests.length + 1, t.filePath, t.testName);
          passedTests.push(t);
        } else {
          logFailure(failedTests.length + 1, t.filePath, t.testName);
          failedTests.push(t);
        }
      });
    });
    logger.info('completed running ' + (i + tests.length) + ' out of ' + testsToExecute.length + ' tests');
  }

  return {
    passedTests,
    failedTests,
    totalTestCount: testsToExecute.length,
  };
}

/**
 * main function to the run the test execution
 */
async function run() {
  logger.info('test started running...');
  try {
    console.time('Total test running time:');
    const { passedTests, failedTests, totalTestCount } = await runTests();
    console.log('*****************************************');
    console.timeEnd('Total test running time:');
    if (totalTestCount) {
      logger.log('Tests Summary:');
      logger.success('Total tests: ' + totalTestCount);
      if (passedTests.length) logger.success('Passed tests: ' + passedTests.length);
      if (failedTests.length) {
        logger.log('\u274E Failed tests: ' + failedTests.length);
        logger.error('FailedTest Details:');
        failedTests.map((t) => logger.failure(t.testName));
      } else {
        logger.success('All tests passed...');
      }
      await createCsvReport(failedTests.concat(passedTests));
    }
    console.log('*****************************************');
  } catch (err) {
    logger.error('error in running tests');
    logger.error(err);
  }
}

// invoking the test execution
run();
