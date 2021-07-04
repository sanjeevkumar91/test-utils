const {
  add,
  subtract,
  multiply
} = require("./calc");

describe('Calc', () => {
  it('should add two numbers', () => {
    // debugger;
    expect(add(2, 3)).toBe(5);
  });

  it('should subtract two numbers', () => {
    expect(subtract(2, 3)).toBe(-1);
  });

  // incorrect test
  it('should multiply two numbers', () => {
    expect(multiply(2, 3)).toBe(5);
  });
});