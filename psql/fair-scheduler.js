"use strict";

const FastPriorityQueue = require('fastpriorityqueue');
const q = require('q');

/**
 * A fair scheduler. Launches at most *concurrency* concurrent tasks.
 * A task is a no-arg function which returs a result and a cost.
 * Each source is allocated the same amount of resources based on the
 * cost of executing each task.
 *
 */

module.exports = (options) => {

  const concurrency = options.concurrency || 1;
  const prioritySlots = options.prioritySlots || 0;
  const initialPriorityOffset = options.initialPriorityOffset || 0;
  const cleanupInterval = options.cleanupInterval || 0;
  const sourceDescriptorMap = {};
  let activeCount = 0;
  let topPriority = 0;
  let priorityRunning = 0;
  let lastCleanup = Date.now();

  const queue = new FastPriorityQueue((a, b) => {
    return a.priority < b.priority;
  });

  const inactive = new Set();
  /**
   * Remove sources from top of queue until encountering a source with a pending task
   * or queue is empty.
   */
  function removeTasklessSources() {
    while(!queue.isEmpty()) {
      const sourceDescriptor = queue.peek();
      const tasks = sourceDescriptor.tasks;
      if(tasks.length === 0) {
        queue.poll();
        inactive.add(sourceDescriptor);
      }
      else {
        break;
      }
    }
    if(inactive.size > 0 && lastCleanup + cleanupInterval < Date.now()) {
      lastCleanup = Date.now();
      for(let sourceDescriptor of inactive.values()) {
        if(sourceDescriptor.priority <= topPriority + initialPriorityOffset) {
          inactive.delete(sourceDescriptor);
          delete sourceDescriptorMap[sourceDescriptor.source];
        }
      }
    }
  }

  /**
   * Run a task from top of queue. Assumes that the queue is not empty,
   * and that the top of the queue has at least one task.
   * @returns {*}
   */
  function runTopTask(){
    const sourceDescriptor = queue.poll();
    const tasks = sourceDescriptor.tasks;
    const task = tasks.shift();
    topPriority = Math.max(topPriority, sourceDescriptor.priority);
    ++activeCount;
    return q.async(function*() {
      sourceDescriptor.running = true;
      const runPrioritized = sourceDescriptor.priority < topPriority;
      if(runPrioritized) {
        priorityRunning++;
      }
      const promise = task.asyncTaskFn();
      const taskResult = yield promise;
      if(runPrioritized) {
        priorityRunning--;
      }
      sourceDescriptor.running = false;
      --activeCount;
      const cost = taskResult.cost;
      const result = taskResult.result;
      sourceDescriptor.priority += cost;
      queue.add(sourceDescriptor);

      task.deferred.resolve({
        result: result,
        cost: cost
      });
    })();

  }

  return {
    schedule: (source, asyncTaskFn) => {
      if(!sourceDescriptorMap[source]) {
        const sourceDescriptor = {
          source: source,
          tasks: [],
          priority: topPriority + initialPriorityOffset,
          running: false
        };
        sourceDescriptorMap[source] = sourceDescriptor;

        queue.add(sourceDescriptor);
      }
      else {
        if(inactive.has(sourceDescriptorMap[source])) {
          const sourceDescriptor = sourceDescriptorMap[source];
          inactive.delete(sourceDescriptor);
          sourceDescriptor.priority = Math.max(topPriority + initialPriorityOffset, sourceDescriptor.priority);
          queue.add(sourceDescriptor);
        }
      }
      const sourceDescriptor = sourceDescriptorMap[source];
      const deferred = q.defer();

      sourceDescriptor.tasks.push({
        asyncTaskFn: asyncTaskFn,
        deferred: deferred
      });

      const nextIsPriorityTask = queue.peek().priority < topPriority;
      const remainingPrioritySlots = prioritySlots - priorityRunning;
      if((nextIsPriorityTask && remainingPrioritySlots > 0)|| (activeCount < concurrency - remainingPrioritySlots)) {
        q.async(function*() {
          /* eslint no-constant-condition: 0 */
          while(true) {
            removeTasklessSources();
            if(queue.isEmpty()) {
              break;
            }
            const nextIsPriorityTask = queue.peek().priority < topPriority;
            if((nextIsPriorityTask && remainingPrioritySlots > 0) ||  (activeCount < concurrency - prioritySlots + priorityRunning)) {
              yield runTopTask();
            }
            else {
              break;
            }
          }
        })();
      }
      return deferred.promise;
    },
    internal: {
      inactive: () => inactive,
      descriptor: (source) => sourceDescriptorMap[source],
      topPriority: () => topPriority
    },

  }
};