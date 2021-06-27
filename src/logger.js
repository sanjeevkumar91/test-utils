const chalk = require('chalk');

const logger = {
  log: (str) => console.log(chalk.green.bold(str)),
  info: (str) => console.log(chalk.yellow.bold(str)),
  error: (str) => console.log(chalk.redBright.bold(str)),
  success: (str) => console.log(chalk.green.bold('\u2705 ' + str)),
  failure: (str) => console.log(chalk.redBright.bold('\u2022 ' + str)),
}

module.exports = {
  logger
}