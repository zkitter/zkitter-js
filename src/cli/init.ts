import { Command } from 'commander';
import { LevelDBAdapter } from '../adapters/leveldb';
import { error, success, warning } from '../utils/logger';

export function init(program: Command) {
  program
    .command('init')
    .description('initialize zkitter')
    .option(
      '-a, --arbitrumHttpProvider <arbitrumHttpProvider>',
      'http provider url for arbitrum mainnet'
    )
    .action(async options => {
      const db = await LevelDBAdapter.initialize();
      const arbitrumHttpProvider = await db.getArbitrumProvider();

      if (!arbitrumHttpProvider && !options.arbitrumHttpProvider) {
        error('no arbitrum provider');
        return;
      }

      if (options.arbitrumHttpProvider && arbitrumHttpProvider !== options.arbitrumHttpProvider) {
        try {
          new URL(options.arbitrumHttpProvider);
          await db.setArbitrumProvider(options.arbitrumHttpProvider);
        } catch (err) {
          error(err.message);
          return;
        }
      }

      success('initialized zkitter');
    });
}
