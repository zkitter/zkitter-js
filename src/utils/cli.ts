import { LevelDBAdapter } from '../adapters/leveldb';
import { Zkitter } from '../services';
import { error } from './logger';

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
    arbitrumProvider,
    db,
    lazy,
  });
}
