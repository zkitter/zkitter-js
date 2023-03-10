import { Mutex } from 'async-mutex';

/**
 * return a function that invoke fn in a mutex
 * this is useful for rate limiting a bunch of fetches in a sequence
 * @param fn
 * @param mutex
 */
const mutexify = (fn: (...args: any) => void, mutex?: Mutex) => {
  const oldFn = fn;
  const mux = mutex || new Mutex();

  return (...args: any[]) => {
    return mux.runExclusive(oldFn.bind(this, ...args));
  };
};

export default mutexify;
