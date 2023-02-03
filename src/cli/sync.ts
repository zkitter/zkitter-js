import {Command} from "commander";
import {initZkitter} from "../utils/cli";
import {ZkitterEvents} from "../services";

export function sync(program: Command) {
  program
    .command('sync')
    .description('sync with arbitrum and group')
    .option('-a, --arbitrum', 'sync with arbitrum')
    .option('--groups', 'sync with all group')
    .option('-g, --group <groupName>', 'sync with group')
    .action(async (options) => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      let newUsers = 0;
      let newMembers = 0;
      let newMsgs = 0;

      zkitter.on(ZkitterEvents.NewUserCreated, data => {
        newUsers++;
      });

      zkitter.on(ZkitterEvents.NewGroupMemberCreated, (data, groupId) => {
        newMembers++;
      });

      zkitter.on(ZkitterEvents.NewMessageCreated, msg => {
        newMsgs++;
      });

      if (options.arbitrum) {
        await zkitter.syncUsers();
      } else if (options.group) {
        await zkitter.syncGroup(options.group);
      } else if (options.groups) {
        await zkitter.syncGroup();
      } else {
        await Promise.all([
          zkitter.syncUsers(),
          zkitter.syncGroup(),
          zkitter.queryHistory(),
        ]);
      }

      console.log(`Found ${newUsers} new user(s), ${newMembers} new member(s), and ${newMsgs} new message(s).`);
      process.exit(0);
    });
}