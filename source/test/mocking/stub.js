JS.Test.extend({
  Mocking: new JS.Module({
    extend: {
      ExpectationError: new JS.Class(JS.Test.Unit.AssertionFailedError),
      
      UnexpectedCallError: new JS.Class(Error, {
        initialize: function(message) {
          this.message = message.toString();
        }
      }),
      
      __activeStubs__: [],
      
      stub: function(object, methodName, implementation) {
        if (JS.isType(object, 'string')) {
          implementation = methodName;
          methodName     = object;
          object         = JS.ENV;
        }
        
        var stubs = this.__activeStubs__,
            i     = stubs.length;
        
        while (i--) {
          if (stubs[i]._object === object && stubs[i]._methodName === methodName)
            return stubs[i].defaultMatcher(implementation);
        }
        
        var stub = new JS.Test.Mocking.Stub(object, methodName);
        stubs.push(stub);
        return stub.defaultMatcher(implementation);
      },
      
      removeStubs: function() {
        var stubs = this.__activeStubs__,
            i     = stubs.length;
        
        while (i--) stubs[i].revoke();
        this.__activeStubs__ = [];
      },
      
      verify: function() {
        try {
          var stubs = this.__activeStubs__;
          for (var i = 0, n = stubs.length; i < n; i++)
            stubs[i]._verify();
        } finally {
          this.removeStubs();
        }
      },
      
      Stub: new JS.Class({
        initialize: function(object, methodName) {
          this._object      = object;
          this._methodName  = methodName;
          this._original    = object[methodName];
          
          this._ownProperty = object.hasOwnProperty
                            ? object.hasOwnProperty(methodName)
                            : (typeof this._original !== 'undefined');
          
          var mocking = JS.Test.Mocking;
          
          this._argMatchers = [];
          this._anyArgs     = new mocking.Parameters([new mocking.AnyArgs()]);
          this._expected    = false;
          
          this.apply();
        },
        
        defaultMatcher: function(implementation) {
          if (implementation !== undefined && typeof implementation !== 'function') {
            this._object[this._methodName] = implementation;
            return this;
          }
          
          this._activeLastMatcher();
          this._currentMatcher = this._anyArgs;
          if (typeof implementation === 'function')
            this._currentMatcher._fake = implementation;
          return this;
        },
        
        apply: function() {
          var object = this._object, methodName = this._methodName;
          if (object[methodName] !== this._original) return;
          
          var self = this;
          object[methodName] = function() { return self._dispatch(arguments) };
        },
        
        revoke: function() {
          if (this._ownProperty)
            this._object[this._methodName] = this._original;
          else
            try { delete this._object[this._methodName] }
            catch (e) { this._object[this._methodName] = undefined }
        },
        
        expected: function() {
          this._expected = true;
          this._anyArgs._expected = true;
        },
        
        _activeLastMatcher: function() {
          if (this._currentMatcher) this._currentMatcher._active = true;
        },
        
        _dispatch: function(args) {
          this._activeLastMatcher();
          var matchers = this._argMatchers.concat(this._anyArgs),
              matcher, result;
          
          this._anyArgs.ping();
          
          for (var i = 0, n = matchers.length; i < n; i++) {
            matcher = matchers[i];
            result  = matcher.match(args);
            
            if (!result) continue;
            if (matcher !== this._anyArgs) matcher.ping();
            
            if (typeof result === 'function')
              return result.apply(this._object, args);
            
            if (result === true)  return matcher.nextReturnValue();
            if (result.callback)  return result.callback.apply(result.context, matcher.nextYieldArgs());
            if (result.exception) throw result.exception;
          }
          
          var message = new JS.Test.Unit.AssertionMessage('',
                            '<?> received call to ' + this._methodName + '() with unexpected arguments:\n(?)',
                            [this._object, JS.array(args)]);
          
          throw new JS.Test.Mocking.UnexpectedCallError(message);
        },
        
        _verify: function() {
          if (!this._expected) return;
          
          for (var i = 0, n = this._argMatchers.length; i < n; i++)
            this._verifyParameters(this._argMatchers[i]);
          
          this._verifyParameters(this._anyArgs);
        },
        
        _verifyParameters: function(parameters) {
          parameters.verify(this._object, this._methodName);
        }
      })
    }
  })
});

