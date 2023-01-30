import {LevelDBAdapter} from "../adapters/leveldb";
import {error} from "./logger";
import {Zkitter} from "../services";

export async function initZkitter(lazy?: boolean): Promise<Zkitter|null> {
  const db = await LevelDBAdapter.initialize();
  const arbitrumHttpProvider = await db.getArbitrumProvider();

  try {
    new URL(arbitrumHttpProvider);
  } catch (e) {
    error('invalid http provider');
    return null;
  }

  return Zkitter.initialize({ db, arbitrumHttpProvider, lazy });
}