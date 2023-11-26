# lb4-cache

This is a small cli tool to add caching to controllers created in a LoopBack 4 app.
At this point, the CLI only works for OpenAPI based contrllers created with `lb4 openapi`.

## Installing

`npm install lb4-cache -g`

## Prerequisites

- Run the cli in a LoopBack 4 project.
- Run the cli after the OpenAPI based controllers are created using `lb4 openapi`

## How to run

- With default options: `lb4-cache --redisDS redisDataSource --specURL 'http://localhost:3000/openapi.json'`
- With custom options: `lb4-cache --prefix openapi --redisDS redisDataSource --cacheTTL 60000 --specURL 'http://localhost:3000/openapi.json'`

### Options

```
--redisDS: pass redis datasource generated with lb4 datasource. This is a required parameter.
--cacheTTL: Pass ttl (in miliseconds) for caching. Default is 60 seconds. 
--specURL: URL to open api specs. This is requried parameter.
--prefix: prefix passed to lb4 openapi. Default is 'openapi'
--readonly: Only GET APIs. Default is false
--exclude: A regex (e.g. products/*) to exclude APIs to add caching to.
--include: A regex (e.g. products/*) to include APIs to add caching to.
```
