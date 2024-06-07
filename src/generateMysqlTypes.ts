import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

import { getColumnDataType } from './getColumnDataType';
import { writeToFile } from './writeToFile';
import type { SslOptions } from 'mysql2';
import { Generator, getSimpleGenerator, Column } from './generator';
import { COLUMNS } from './information-schema/COLUMNS';
import micromatch = require('micromatch');

type Table = {
  table: string;
  tableComment: string;
  columns: Array<Column>;
};

export type GetTables = (option: {
  ignoreTables?: string[];
  includeTables?: string[];
}) => Awaited<Table[]>;

export type ConnectionConfig = (
  | {
    host: string;
    port?: number;
    user: string;
    password: string;
  }
  | {
    uri: string;
  }
) & {
  database: string;
  ssl?: SslOptions;
};

export type GenerateMysqlTypesConfig = {
  db: ConnectionConfig | GetTables;
  output:
  | {
    dir: string;
  }
  | {
    file: string;
  }
  | {
    stream: fs.WriteStream | NodeJS.WritableStream;
  };
  suffix?: string;
  ignoreTables?: string[];
  includeTables?: string[];
  tinyintIsBoolean?: boolean;
  getTypeName?: (table: string) => string;
  generator?: Generator;
  warningHeader?: string;
};

function defaultGetTypeName(table: string) {
  return `${table
    .split('_')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')}`;
}

export const generateMysqlTypes = async (config: GenerateMysqlTypesConfig) => {
  const tinyintIsBoolean = config.tinyintIsBoolean ?? false;
  // const getTypeName = config.getTypeName ?? defaultGetTypeName;
  const getTypeName = (table: string) => {
    if (config.getTypeName) {
      return config.getTypeName(table);
    }
    return defaultGetTypeName(table) + (config.suffix ?? '');
  };

  const tables = await getTables(config);

  // check if at least one table exists
  if (tables.length === 0) {
    throw new Error(`0 eligible tables found`);
  }

  // prepare the output location
  if ('file' in config.output) {
    emptyOutputPath(config.output.file, 'file');
  } else if ('dir' in config.output) {
    emptyOutputPath(config.output.dir, 'dir');
  }

  const generator = config.generator ?? getSimpleGenerator({});

  // loop through each table
  for (const { table, tableComment, columns } of tables) {
    const typeName = getTypeName(table);

    // define output
    const outputDestination =
      'dir' in config.output
        ? `${config.output.dir}/${typeName}.ts`
        : 'file' in config.output
          ? config.output.file
          : config.output.stream;

    const code = await generator({
      table,
      tableComment,
      columns,
      tinyintIsBoolean,
      typeName,
      getColumnDataType,
    });
    await output(outputDestination, code, config.warningHeader);

    // add type to index file
    if ('dir' in config.output) {
      await output(`${config.output.dir}/index.ts`, `export type { ${typeName} } from './${typeName}';\n`, config.warningHeader);
    }
  }
};

async function getTableNames(
  connection: mysql.Connection,
  databaseName: string,
  ignoredTables: string[],
  includeTables: string[],
) {
  const [tables] = (await connection.execute(
    `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.tables WHERE table_schema = ?`,
    [databaseName],
  )) as any as [Array<{ TABLE_NAME: string; TABLE_COMMENT: string }>];

  // filter default ignored tables
  return tables
    .filter(({ TABLE_NAME }) => !TABLE_NAME.includes('knex_'))
    .filter(({ TABLE_NAME }) => !ignoredTables.some((it) => micromatch.isMatch(TABLE_NAME, it)))
    .filter(({ TABLE_NAME }) => includeTables.length === 0 || includeTables.some((it) => micromatch.isMatch(TABLE_NAME, it)));
}

const columnInfoColumns = ['COLUMN_NAME', 'DATA_TYPE', 'COLUMN_TYPE', 'IS_NULLABLE', 'COLUMN_COMMENT'] as const;

async function getColumnInfo(
  connection: mysql.Connection,
  databaseName: string,
  tableName: string,
): Promise<Column[]> {
  const [result] = (await connection.query(
    'SELECT ?? FROM information_schema.columns WHERE table_schema = ? and table_name = ? ORDER BY ordinal_position ASC',
    [columnInfoColumns, databaseName, tableName],
  )) as any;

  const columns = result as COLUMNS[];
  return columns.map(col => ({
    columnName: col.COLUMN_NAME!,
    dataType: col.DATA_TYPE!,
    columnType: col.COLUMN_TYPE!,
    isNullable: col.IS_NULLABLE === 'YES',
    columnComment: col.COLUMN_COMMENT!,
  }));
}

async function getTables(config: GenerateMysqlTypesConfig) {
  const { db, includeTables, ignoreTables } = config;
  if (typeof db === 'function') {
    return db({
      includeTables,
      ignoreTables,
    });
  }

  let connectionConfig: mysql.ConnectionOptions;
  if ('uri' in db) {
    connectionConfig = {
      uri: db.uri,
      database: db.database,
      ssl: db.ssl,
    };
  } else {
    connectionConfig = {
      host: db.host,
      port: db.port || 3306,
      user: db.user,
      password: db.password,
      database: db.database,
      ssl: db.ssl,
    };
  }
  const connection = await mysql.createConnection(connectionConfig);
  const tables = await getTableNames(
    connection,
    db.database,
    config.ignoreTables ?? [],
    config.includeTables ?? [],
  );

  const result = tables.map(async (it) => {
    const columns = await getColumnInfo(connection, db.database, it.TABLE_NAME);
    return {
      table: it.TABLE_NAME,
      tableComment: it.TABLE_COMMENT,
      columns,
    };
  });

  // close the mysql connection
  await connection.end();

  return Promise.all(result);
}

const emptyOutputPath = (outputPath: string, outputType: 'file' | 'dir') => {
  // delete existing output
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { recursive: true });
  }

  // make sure parent folder of output path exists
  const parentFolder = outputType === 'dir' ? outputPath : path.resolve(outputPath, '../');
  if (!fs.existsSync(parentFolder)) {
    fs.mkdirSync(parentFolder, { recursive: true });
  }
};

const output = async (outputPathOrStream: string | fs.WriteStream | NodeJS.WritableStream, content: string, warningHeader?:string) => {
  if (typeof outputPathOrStream === 'string') {
    await writeToFile(outputPathOrStream, content, warningHeader);
  } else {
    outputPathOrStream.write(content);
  }
};
