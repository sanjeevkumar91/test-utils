# test-utils
test utils

# To run the script
1. clone the repo
2. npm install
3. npm run test-parallel

# To run the test script in other code repo
1. add run-test-parallel.js file in root folder of the repo (where the package.json is available)
2. install needed dependencies ('recursive-path-finder-regexp', 'csv-writer', 'chalk')
3. to execute the tests, run command 
  1) `npm run test-parallel` - to run all tests ending with .test.js
  2) `TEST_PATH=fileName npm run test-parallel` - to run individual file test
