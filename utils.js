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

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

module.exports.getControllerNames = async (specURL, invokedFrom) => {
  let controllerName = 'OpenApi';
  const controllerNames = new Set();

  let specs = await loadSpecs(specURL, invokedFrom);

  if (!specs) throw Error('No specs received');
  if (!specs.paths) specs.paths = {};

  const { components, paths } = specs;
  let stringifiedApiSpecs = JSON.stringify(specs, getCircularReplacer());

  // rewrite WithRelations and append OpenAPI at the end to avoid duplications
  stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
    'WithRelations',
    'WithRelationsOpenAPI',
  );
  // avoid duplication of paths by appending openapi
  if (paths) {
    Object.keys(paths).forEach(eachPath => {
      if (!eachPath.includes('{id}') && !eachPath.includes('count')) {
        const updatedPath =
          eachPath.slice(0, 0) + '/openapi/' + eachPath.slice(1);
        stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
          eachPath,
          updatedPath,
        );
      }
    });
  }
  // rewrite every item and append OpenAPI in the start
  if (components) {
    const { schemas } = components;
    if (schemas) {
      Object.keys(schemas).forEach(item => {
        if (
          !item.startsWith('loopback') &&
          !item.startsWith('New') &&
          !item.endsWith('Relations') &&
          !item.endsWith('Partial') &&
          !item.includes('Through') &&
          !item.includes('.') &&
          !item.includes('Ping')
        ) {
          stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
            item,
            'OpenApi' + item,
          );
        }
        if (item.includes('Ping')) {
          stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
            'Ping',
            'OpenApi' + 'Ping',
          );
        }
      });
    }
  }
  specs = JSON.parse(stringifiedApiSpecs);

  const pathKeys = Object.keys(specs.paths);
  if (!pathKeys.length) throw Error('No paths');
  pathKeys.forEach(eachPath => {
    const path = specs.paths[eachPath];
    const opKeys = Object.keys(path);
    if (!opKeys.length) throw Error('No operations');
    const op = path[opKeys[0]];
    const tags = op['tags'];
    if (tags && tags.length) {
      tags.forEach((tag, index) => {
        if (tag.includes('OpenApi')) {
          tags[index] = tag.split('OpenApi')[1];
        }
      });
      controllerName = tags[0].replace('Controller', '');
    }
    if (!controllerName) {
      if (op['x-controller-name']) {
        controllerName = op['x-controller-name'].replace('Controller', '');
      }
    }
    controllerNames.add('openapi.' + kebabCase(controllerName))
  });
  return controllerNames;
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