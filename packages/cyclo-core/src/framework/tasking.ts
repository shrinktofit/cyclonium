import * as cc from 'cc';

export const TaskPriority = {
  predefined: Object.freeze({
    componentsLateUpdate: 0,
  }),

  before(priority: number) {
    return priority - 1;
  },

  after(priority: number) {
    return priority + 1;
  },

  between(a: number, b: number) {
    return (a + b) / 2;
  },
};

interface Task<TThis = any> {
  fn: (this: TThis, deltaTime: number) => void;
  thisArg: TThis;
  priority: number;
}

class TaskCluster {
  add(task: Task) {
    const taskIndex = this._find(task);
    if (taskIndex >= 0) {
      return false;
    }
    this._tasks.push({
      ...task,
    });
    this._tasks.sort((a, b) => b.priority - a.priority);
    return true;
  }

  remove(task: Task) {
    const taskIndex = this._find(task);
    if (taskIndex < 0) {
      return false;
    }
    this._tasks.splice(taskIndex, 1);
    return true;
  }

  execute(deltaTime: number) {
    for (const task of this._tasks) {
      task.fn.call(task.thisArg, deltaTime);
    }
  }

  private _tasks: Task[] = [];

  private _find(task: Task) {
    return this._tasks.findIndex((t) => t.fn === task.fn && t.thisArg === task.thisArg);
  }
}

class CycloTaskScheduler extends cc.System {
  add(task: Task) {
    const cluster = this._getCluster(task.priority);
    cluster.add(task);
  }

  remove(task: Task) {
    for (const cluster of [this._clusterBeforeComponentsLateUpdate, this._clusterAfterComponentsLateUpdate]) {
      const removed = cluster.remove(task);
      if (removed) {
        return;
      }
    }
  }

  override update(deltaTime: number): void {
    this._clusterBeforeComponentsLateUpdate.execute(deltaTime);
  }

  override postUpdate(deltaTime: number): void {
    this._clusterAfterComponentsLateUpdate.execute(deltaTime);
  }

  private _clusterBeforeComponentsLateUpdate = new TaskCluster();
  private _clusterAfterComponentsLateUpdate = new TaskCluster();

  private _getCluster(priority: number) {
    if (priority <= TaskPriority.predefined.componentsLateUpdate) {
      return this._clusterBeforeComponentsLateUpdate;
    }
    return this._clusterAfterComponentsLateUpdate;
  }
}

const taskScheduler = new CycloTaskScheduler();
cc.director.registerSystem('CycloTasks', taskScheduler, cc.System.Priority.MEDIUM);

export function addFrameTask<TThis>(task: Task<TThis>) {
  taskScheduler.add(task);
}

export function removeFrameTask<TThis>(task: Task<TThis>) {
  taskScheduler.remove(task);
}
