// This higher order function is responsible for returning a new
// function that will execute with the context that a grunt task
// expects.
const buildTaskContext = require('./build_task_context');

module.exports = function (config, task, target) {
  var method = task.fn;

  // Create a context object for a grunt task to execute with.
  var context = buildTaskContext(config, task, target);

  // Return a function that will be invoked by Orchestrator.
  return function () {
    // clear promise for each run.
    context.deferred = false;

    // Execute task method from registerTask or registerMultiTask.
    var ret = method.apply(context, arguments);

    // Optionally return a promise if the method was async.  This is sort
    // of releasing zalgo, but Orchestrator requires this kind of hinting
    // to determine if a task is async or not.
    if (!context.deferred) {
      return ret;
    } else {
      return context.deferred.promise;
    }
  };
};
