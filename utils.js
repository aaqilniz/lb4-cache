const chalk = require('chalk');
const debug = require('debug')('utils');
const { exec } = require('child_process');
const fs = require('fs');
const openapiFilter = require('openapi-filter');

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
      if (seen.has(value)) { return; }
      seen.add(value);
    }
    return value;
  };
};

module.exports.modifySpecs = (specs, prefix) => {
  if (!specs.paths) specs.paths = {};
  const { components, paths } = specs;
  let stringifiedApiSpecs = JSON.stringify(specs, getCircularReplacer());

  // rewrite WithRelations and append prefix to avoid duplications
  stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
    'WithRelations',
    `${prefix}WithRelations`,
  );

  // avoid duplication of paths by appending prefix
  if (paths) {
    Object.keys(paths).forEach(eachPath => {
      if (!eachPath.includes('{id}') && !eachPath.includes('count')) {
        const updatedPath =
          eachPath.slice(0, 0) + `${prefix.toLowerCase()}.` + eachPath.slice(1);
        stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
          eachPath,
          updatedPath,
        );
      }
    });
  }

  // rewrite every item and append prefix
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
            prefix + item,
          );
        }
        if (item.includes('Ping')) {
          stringifiedApiSpecs = stringifiedApiSpecs.replaceAll(
            'Ping',
            prefix + 'Ping',
          );
        }
      });
    }
  }
  
  return JSON.parse(stringifiedApiSpecs);
}

function getIndiciesOf (searchStr, str, caseSensitive) {
  let searchStrLen = searchStr.length;
  if (searchStrLen == 0) { return []; }
  let startIndex = 0, index, indices = [];
  if (!caseSensitive) {
    str = str.toLowerCase();
    searchStr = searchStr.toLowerCase();
  }
  while ((index = str.indexOf(searchStr, startIndex)) > -1) {
    indices.push(index);
    startIndex = index + searchStrLen;
  }
  return indices;
}

function insertAtIndex (str, substring, index) {
  return str.slice(0, index) + substring + str.slice(index);
}

function applyFilters (stringifiedSpecs, options) {
  let specs = JSON.parse(stringifiedSpecs);
  let openapiComponent = specs.components;
  specs = openapiFilter.filter(specs, options);
  specs.components = openapiComponent;
  return specs;
}

function findIndexes (stringSpecs, regex) {
  let result;
  const indices = [];
  while ((result = regex.exec(stringSpecs))) {
    indices.push(result.index);
  }
  return indices;
}

function excludeOrIncludeSpec (specs, filter, options) {
  let stringifiedSpecs = JSON.stringify(specs);
  let regex = new RegExp(filter, 'g')


  const indexes = findIndexes(stringifiedSpecs, regex);
  let indiciesCount = 0;
  while (indiciesCount < indexes.length) {
    let ind = indexes[indiciesCount];
    for (let i = ind; i < stringifiedSpecs.length; i++) {
      const toMatch = stringifiedSpecs[i] + stringifiedSpecs[i + 1] + stringifiedSpecs[i + 2];
      if (toMatch === '":{') {
        stringifiedSpecs = insertAtIndex(
          stringifiedSpecs,
          '"x-filter": true,',
          i + 3
        );
        indiciesCount++;
        break;
      }

    }
  }
  return applyFilters(stringifiedSpecs, options);
}

function readonlySpec (specs, options) {
  let stringifiedSpecs = JSON.stringify(specs);
  let excludeOps = ['"post":', '"patch":', '"put":', '"delete":'];
  excludeOps.forEach(operator => {
    const indices = getIndiciesOf(operator, stringifiedSpecs);
    let indiciesCount = 0;
    while (indiciesCount < indices.length) {
      const indices = getIndiciesOf(operator, stringifiedSpecs);
      const index = indices[indiciesCount];
      stringifiedSpecs = insertAtIndex(
        stringifiedSpecs,
        '"x-filter": true,',
        index + operator.length + 1
      );
      indiciesCount++;
    }
  });
  return applyFilters(stringifiedSpecs, options);
}

module.exports.filterSpec = (specs, readonly, exclude, include) => {
  const options = {
    valid: true,
    info: true,
    strip: true,
    flags: ['x-filter'],
    servers: true,
  };
  if (readonly) {
    specs = readonlySpec(specs, options);
  }
  if (exclude) { // exclude only specified - include everything else
    specs = excludeOrIncludeSpec(specs, exclude, options);
  }
  if (include) { // include only specified - exclude everything else
    specs = excludeOrIncludeSpec(specs, include, { ...options, inverse: true });
  }
  return specs;
}

module.exports.getControllerNames = (specs, prefix) => {
  let controllerName = 'OpenApi';
  const controllerNames = new Set();

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
        if (prefix && tag.includes(prefix)) {
          tags[index] = tag.split(prefix)[1];
        }
      });
      controllerName = tags[0].replace('Controller', '');
    }
    if (!controllerName) {
      if (op['x-controller-name']) {
        controllerName = op['x-controller-name'].replace('Controller', '');
      }
    }
    if (prefix) {
      controllerNames.add(`${prefix.toLowerCase()}.` + this.kebabCase(controllerName))
    } else {
      controllerNames.add(this.kebabCase(controllerName))
    }
  });
  return controllerNames;
}

module.exports.kebabCase = string => string
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

module.exports.toPascalCase = string => string
  .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
  .map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
  .join('');