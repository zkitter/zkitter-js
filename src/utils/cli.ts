import { LevelDBAdapter } from '../adapters/leveldb';
import { error } from './logger';
import { Zkitter } from '../services';

export async function initZkitter(lazy?: boolean): Promise<Zkitter | null> {
  const db = await LevelDBAdapter.initialize();
  const arbitrumProvider = await db.getArbitrumProvider();

  try {
    new URL(arbitrumProvider);
  } catch (e) {
    error('invalid provider');
    return null;
  }

  return Zkitter.initialize({
    db,
    arbitrumProvider,
    lazy,
  });
}
