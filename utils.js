const chalk = require('chalk');
const debug = require('debug')('utils');
const { exec } = require('child_process');
const fs = require('fs');

const log = console.log;


const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

module.exports.execute = async (command, artifact, message) => {
  if (!artifact) log(chalk.blue(message));
  if (artifact) log(chalk.blue(`running command to create cache ${artifact}`));

  const executed = await execPromise(command);
  if (executed.error) {
    debug(executed.error);
    throw Error(`failed to execute ${command}`);
  }
  if (executed.stdout) log(chalk.bold(chalk.green('OK.')));
}

module.exports.isLoopBackApp = (package) => {
  if (!package) return false;
  const { dependencies } = package;
  if (!dependencies['@loopback/core']) return false;
  return true;
}

module.exports.updateFile = (filePath, updateThis, updateWith, pre, replaceAll) => {
  const file = fs.readFileSync(filePath, 'utf8');
  if (file.indexOf(updateWith) === -1) {
    const updatedFile = file[replaceAll ? 'replaceAll' : 'replace'](
      updateThis,
      pre ? updateWith + '\n' + updateThis : updateThis + '\n\t' + updateWith
    );
    fs.writeFileSync(filePath, updatedFile, 'utf8');
  }
}

module.exports.addImport = (filePath, newImport) => {
  this.updateFile(filePath, 'import', newImport, true);
}