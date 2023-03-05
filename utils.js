const chalk = require('chalk');
const debug = require('debug')('utils');
const { exec } = require('child_process');
const fs = require('fs');
const loadSpecs = require('./loadSpecs');

module.exports.log = console.log;

const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

module.exports.getControllerName = async (specURL, invokedFrom) => {
  let controllerName = 'OpenApi';
  
  const specs = await loadSpecs(specURL, invokedFrom);
  if (!specs) throw Error('No specs received');
  if (!specs.paths) specs.paths = {};

  const pathKeys = Object.keys(specs.paths);
  if (!pathKeys.length) throw Error('No paths');

  const path = specs.paths[pathKeys[0]];
  const opKeys = Object.keys(path);
  if (!opKeys.length) throw Error('No operations');

  const op = path[opKeys[0]];

  if (op['x-controller-name']) {
    controllerName = op['x-controller-name'].replace('Controller', '');
  }

  if (!controllerName) {
    if (op['tags'] && op['tags'].length) {
      controllerName = op['tags'][0].replace('Controller', '');
    }
  }
  return kebabCase(controllerName);
}

const kebabCase = string => string
  .replace(/([a-z])([A-Z])/g, "$1-$2")
  .replace(/[\s_]+/g, '-')
  .toLowerCase();

module.exports.execute = async (command, message) => {
  this.log(chalk.blue(message));
  const executed = await execPromise(command);
  if (executed.error) {
    debug(executed.error);
    throw Error(`failed to execute ${command}`);
  }
  this.log(chalk.bold(chalk.green('OK.')));
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