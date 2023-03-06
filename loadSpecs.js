const SwaggerParser = require('swagger-parser');
const { convertObj } = require('swagger2openapi');
const path = require('path');

module.exports = async (url, invokedFrom) => {
  if (url.indexOf('http') === -1) {
    url = path.join(`${invokedFrom}`, url);
  }
  const parser = new SwaggerParser();
  let spec = await parser.parse(url);
  if (spec.swagger === '2.0') spec = (convertObj(spec, { patch: true })).openapi;
  try {
    spec = await parser.dereference(spec);
  } catch (error) {
    // If returns http unauthorized error, ignore resolving external ref$ pointer
    if (error instanceof ResolverError) {
      spec = await parser.dereference(spec, { resolve: { external: false } });
    }
  }
  return spec;
}