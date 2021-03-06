<%= license %>

(function() {
  var $ = (typeof this.global === 'object') ? this.global : this;
  $.JS = $.JS || {};
  JS.ENV = $;
})();

JS.Package = function(loader) {
  var Set = JS.Package.OrderedSet;
  JS.Package._index(this);
  
  this._loader    = loader;
  this._names     = new Set();
  this._deps      = new Set();
  this._uses      = new Set();
  this._styles    = new Set();
  this._observers = {};
  this._events    = {};
};

(function(klass) {
  klass.displayName = 'Package';
  klass.toString = function() { return klass.displayName };
  
  klass.log = function(message) {
    if (typeof window === 'undefined') return;
    if (typeof window.runtime === 'object') window.runtime.trace(message);
    if (window.console && console.info) console.info(message);
  };
  
  //================================================================
  // Ordered list of unique elements, for storing dependencies
  
  var Set = klass.OrderedSet = function(list) {
    this._members = this.list = [];
    this._index = {};
    if (!list) return;
    
    for (var i = 0, n = list.length; i < n; i++)
      this.push(list[i]);
  };

  Set.prototype.push = function(item) {
    var key   = (item.id !== undefined) ? item.id : item,
        index = this._index;
    
    if (index.hasOwnProperty(key)) return;
    index[key] = this._members.length;
    this._members.push(item);
  };
  
  //================================================================
  // Wrapper for deferred values
  
  var Deferred = klass.Deferred = function() {
    this._status    = 'deferred';
    this._value     = null;
    this._callbacks = [];
  };
  
  Deferred.prototype.callback = function(callback, context) {
    if (this._status === 'succeeded') callback.call(context, this._value);
    else this._callbacks.push([callback, context]);
  };
  
  Deferred.prototype.succeed = function(value) {
    this._status = 'succeeded';
    this._value  = value;
    var callback;
    while (callback = this._callbacks.shift())
      callback[0].call(callback[1], value);
  };
  
  //================================================================
  // Environment settings
  
  klass.ENV = JS.ENV;
  
  if ((this.document || {}).getElementsByTagName) {
    var script = document.getElementsByTagName('script')[0];
    klass._isIE = (script.readyState !== undefined);
  }
  
  klass.onerror = function(e) { throw e };
  
  klass._throw = function(message) {
    klass.onerror(new Error(message));
  };
  
  
  //================================================================
  // Configuration methods, called by the DSL
  
  var instance = klass.prototype,
      
      methods = [['requires', '_deps'],
                 ['uses',     '_uses'],
                 ['styling',  '_styles']],
      
      i = methods.length;
  
  while (i--)
    (function(pair) {
      var method = pair[0], list = pair[1];
      instance[method] = function() {
        var n = arguments.length, i;
        for (i = 0; i < n; i++) this[list].push(arguments[i]);
        return this;
      };
    })(methods[i]);
  
  instance.provides = function() {
    var n = arguments.length, i;
    for (i = 0; i < n; i++) {
      this._names.push(arguments[i]);
      klass._getFromCache(arguments[i]).pkg = this;
    }
    return this;
  };
  
  instance.setup = function(block) {
    this._onload = block;
    return this;
  };
  
  //================================================================
  // Event dispatchers, for communication between packages
  
  instance._on = function(eventType, block, scope) {
    if (this._events[eventType]) return block.call(scope);
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
    this._load();
  };
  
  instance._fire = function(eventType) {
    if (this._events[eventType]) return false;
    this._events[eventType] = true;
    
    var list = this._observers[eventType];
    if (!list) return true;
    delete this._observers[eventType];
    
    for (var i = 0, n = list.length; i < n; i++)
      list[i][0].call(list[i][1]);
    
    return true;
  };
  
  //================================================================
  // Loading frontend and other miscellany
  
  instance._isLoaded = function(withExceptions) {
    if (!withExceptions && this.__isLoaded !== undefined) return this.__isLoaded;
    
    var names = this._names.list,
        i     = names.length,
        name, object;
    
    while (i--) { name = names[i];
      object = klass._getObject(name, this._exports);
      if (object !== undefined) continue;
      if (withExceptions)
        return klass._throw('Expected package at ' + this._loader + ' to define ' + name);
      else
        return this.__isLoaded = false;
    }
    return this.__isLoaded = true;
  };
  
  instance._load = function() {
    if (!this._fire('request')) return;
    this._prefetch();
    
    var allDeps = this._deps.list.concat(this._uses.list),
        i = allDeps.length;
    
    klass.when({load: allDeps});
    
    klass.when({complete: this._deps.list}, function() {
      klass.when({complete: allDeps, load: [this]}, function() {
        this._fire('complete');
      }, this);
      
      var self = this, fireOnLoad = function(exports) {
        self._exports = exports;
        if (self._onload) self._onload();
        self._isLoaded(true);
        self._fire('load');
      };
      
      if (this._isLoaded()) {
        this._fire('download');
        return this._fire('load');
      }
      
      if (this._loader === undefined)
        return klass._throw('No load path found for ' + this._names.list[0]);
      
      typeof this._loader === 'function'
            ? this._loader(fireOnLoad)
            : klass.Loader.loadFile(this._loader, fireOnLoad, this._source);
      
      if (!klass.Loader.loadStyle) return;
      
      var styles = this._styles.list,
          i      = styles.length;
      
      while (i--) klass.Loader.loadStyle(styles[i]);
      
      this._fire('download');
    }, this);
  };
  
  instance._prefetch = function() {
    if (typeof this._loader !== 'string' ||!klass.Loader.fetch) return;
    this._source = this._source ||
                   klass.Loader.fetch(this._loader);
  };
  
  instance.toString = function() {
    return 'Package:' + this._names.list.join(',');
  };
  
  //================================================================
  // Class-level event API, handles group listeners
  
  klass.when = function(eventTable, block, scope) {
    var eventList = [], objects = {}, event, packages, i;
    for (event in eventTable) {
      if (!eventTable.hasOwnProperty(event)) continue;
      objects[event] = [];
      packages = new klass.OrderedSet(eventTable[event]);
      i = packages.list.length;
      while (i--) eventList.push([event, packages.list[i], i]);
    }
    
    var waiting = i = eventList.length;
    if (waiting === 0) return block && block.call(scope, objects);
    
    while (i--)
      (function(event) {
        var pkg = klass._getByName(event[1]);
        pkg._on(event[0], function() {
          objects[event[0]][event[2]] = klass._getObject(event[1], pkg._exports);
          waiting -= 1;
          if (waiting === 0 && block) block.call(scope, objects);
        });
      })(eventList[i]);
  };
  
  //================================================================
  // Indexes for fast lookup by path and name, and assigning IDs
  
  klass._autoIncrement = 1;
  klass._indexByPath = {};
  klass._indexByName = {};
  klass._autoloaders = [];
  
  klass._index = function(pkg) {
    pkg.id = this._autoIncrement;
    this._autoIncrement += 1;
  };
  
  klass._getByPath = function(loader) {
    var path = loader.toString();
    return this._indexByPath[path] = this._indexByPath[path] || new this(loader);
  };
  
  klass._getByName = function(name) {
    if (typeof name !== 'string') return name;
    var cached = this._getFromCache(name);
    if (cached.pkg) return cached.pkg;
    
    var autoloaded = this._manufacture(name);
    if (autoloaded) return autoloaded;
    
    var placeholder = new this();
    placeholder.provides(name);
    return placeholder;
  };
  
  klass.remove = function(name) {
    var pkg = this._getByName(name);
    delete this._indexByName[name];
    delete this._indexByPath[pkg._loader];
  };
  
  //================================================================
  // Auotloading API, generates packages from naming patterns
  
  klass._autoload = function(pattern, options) {
    this._autoloaders.push([pattern, options]);
  };
  
  klass._manufacture = function(name) {
    var autoloaders = this._autoloaders,
        n = autoloaders.length,
        i, autoloader, path;
    
    for (i = 0; i < n; i++) {
      autoloader = autoloaders[i];
      if (!autoloader[0].test(name)) continue;
      
      path = autoloader[1].from + '/' +
             name.replace(/([a-z])([A-Z])/g, function(m,a,b) { return a + '_' + b })
                 .replace(/\./g, '/')
                 .toLowerCase() + '.js';
      
      var pkg = new this(path);
      pkg.provides(name);
      
      if (path = autoloader[1].require)
        pkg.requires(name.replace(autoloader[0], path));
      
      return pkg;
    }
    return null;
  };
  
  //================================================================
  // Cache for named packages and runtime objects
  
  klass._getFromCache = function(name) {
    return this._indexByName[name] = this._indexByName[name] || {};
  };
  
  klass._getObject = function(name, rootObject) {
    if (typeof name !== 'string') return undefined;
    
    var cached = rootObject ? {} : this._getFromCache(name);
    if (cached.obj !== undefined) return cached.obj;
    
    var object = rootObject || this.ENV,
        parts  = name.split('.'), part;
    
    while (part = parts.shift()) object = object && object[part];
    
    if (rootObject && object === undefined)
      return this._getObject(name);
    
    return cached.obj = object;
  };
  
})(JS.Package);

