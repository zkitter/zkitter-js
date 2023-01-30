import {Command} from "commander";
import {initZkitter} from "../utils/cli";
import {Zkitter} from "../services";

export function list(program: Command) {
  program
    .command('list')
    .description('list all groups or users')
    .option('-u, --users', 'list all users')
    .option('-g, --groups', 'list all groups')
    .action(async (options) => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      await handleList(zkitter, options.users, options.groups);

      process.exit(0);
    });
}

export async function handleList(zkitter: Zkitter, user: boolean, group: boolean) {
  if (user) {
    const users = await zkitter.getUsers();
    for (const u of users) {
      console.log(u.address);
    }
  } else if (group) {
    const {groups} = zkitter.services.groups;
    for (const g of Object.values(groups)) {
      console.log(g.groupId);
    }
  }
}
