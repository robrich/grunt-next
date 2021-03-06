const util = require('util');
const pkg = require('../package');
const Task = require('../task');
const legacy = require('../legacy');
const expander = require('expander');
const bindMany = require('./lib/utils/bind_many');
const parseRegister = require('./lib/parse_register');
const findTaskFiles = require('./lib/find_task_files');
const loadTaskFiles = require('./lib/load_task_files');
const parseCommands = require('./lib/parse_commands');
const indexCommands = require('./lib/index_commands');
const buildTaskList = require('./lib/build_task_list');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const Orchestrator = require('orchestrator');

function Grunt (env) {
  this.env = env;
  this.events = this;
  this.tasks = [];
  this.option = expander.interface(this.env.argv);
  EventEmitter2.call(this, {wildcard:true});
  bindMany(['loadTasks', 'loadNpmTasks'], this);
  legacy(this);
}
util.inherits(Grunt, EventEmitter2);

Grunt.prototype.init =  function (data) {
  this.config = expander.interface(data, {
    imports: {
      grunt: {
        template: this.template,
        option: this.option
      }
    }
  });
};
Grunt.prototype.initConfig = Grunt.prototype.init;
Grunt.prototype.package = pkg;
Grunt.prototype.version = pkg.version;

Grunt.prototype.register = function (task, constructor) {
  this.tasks[task.name] = new constructor(task);
};
Grunt.prototype.registerTask = function () {
  this.register(parseRegister(arguments, 'single'), Task);
};
Grunt.prototype.registerMultiTask = function () {
  this.register(parseRegister(arguments, 'multi'), Task);
};
Grunt.prototype.loadTasks = function (input) {
  loadTaskFiles(findTaskFiles(input), this);
};
Grunt.prototype.loadNpmTasks = function (input) {
  loadTaskFiles(findTaskFiles(input, true), this);
};
Grunt.prototype.renameTask = function (oldName, newName) {
  console.log(oldName, newName);
};

Grunt.prototype.parseCommands = function (request) {
  // remove invalid requests / resolve aliases / expand multi tasks
  var commands = parseCommands(this.config, this.tasks, request);
  this.emit('run.parseCommands', commands);
  // return em
  return commands;
};

Grunt.prototype.buildTasks = function (commands) {
  // group commands by their root task
  var indexedCommands = indexCommands(commands);
  this.emit('run.indexCommands', indexedCommands);
  // build a listing of tasks to put into orchestrator
  var taskList = buildTaskList(this.config, this.tasks, indexedCommands);
  this.emit('run.buildTaskList', taskList);
  // return em
  return taskList;
};

Grunt.prototype.buildRunner = function (taskList) {
  // build an orchestration
  var runner = new Orchestrator();
  taskList.forEach(function (task) {
    runner.task(task.name, task.method);
  });

  // emit some stuff (the next v of orchestrator uses ee2)
  runner.on('taskStart', function (e) {
    this.emit('taskStart', e);
  }.bind(this));
  runner.on('taskStop', function (e) {
    this.emit('taskStop', e);
  }.bind(this));
  runner.on('taskErr', function (e) {
    this.emit('taskErr', e);
  }.bind(this));

  return runner;
};

Grunt.prototype.run = function (request) {
  var commands = this.parseCommands(request);
  var taskList = this.buildTasks(commands);
  var runner = this.buildRunner(taskList);
  runner.run(runner.parallel(commands), function (err, stats) {
    // TODO: we're done, do something meaningful with err and stats
  });
};

module.exports = Grunt;
