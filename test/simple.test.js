const { expect } = require("chai");

describe("Simple Test", function() {
  it("should pass a basic assertion", function() {
    expect(true).to.equal(true);
  });
  
  it("should handle basic math", function() {
    expect(1 + 1).to.equal(2);
  });
});
