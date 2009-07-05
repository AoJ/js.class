/** section: test
 * class JS.Test.Unit.Error
 * 
 * Encapsulates an error in a test. Created by
 * `JS.Test.Unit.TestCase` when it rescues an exception thrown
 * during the processing of a test.
 **/
JS.Test.Unit.extend({
  Error: new JS.Class({
    // TODO  include Util::BacktraceFilter
    
    extend: {
      SINGLE_CHARACTER: 'E'
    },
    
    /**
     * new JS.Test.Unit.Error(testName, exception)
     * 
     * Creates a new `JS.Test.Unit.Error` with the given test name and
     * exception.
     **/
    initialize: function(testName, exception) {
      this.testName  = testName;
      this.exception = exception;
      this.toString  = this.longDisplay;
    },
    
    /**
     * JS.Test.Unit.Error#singleCharacterDisplay() -> String
     *
     * Returns a single character representation of an error.
     **/
    singleCharacterDisplay: function() {
      return this.klass.SINGLE_CHARACTER;
    },
    
    /**
     * JS.Test.Unit.Error#message() -> String
     * 
     * Returns the message associated with the error.
     **/
    message: function() {
      return this.exception.name + ': ' + this.exception.message;
    },
    
    /**
     * JS.Test.Unit.Error#shortDisplay() -> String
     * 
     * Returns a brief version of the error description.
     **/
    shortDisplay: function() {
      return this.testName + ': ' + this.message().split("\n")[0];
    },
    
    /**
     * JS.Test.Unit.Error#longDisplay() -> String
     * 
     * Returns a verbose version of the error description.
     **/
    longDisplay: function() {
      // TODO backtrace = filter_backtrace(@exception.backtrace).join("\n    ")
      return "Error:\n" + this.testName + ":\n" + this.message(); // + "\n    " + backtrace
    }
  })
});

