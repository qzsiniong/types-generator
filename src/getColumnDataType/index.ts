import { getColumnDataType_EnumFromComment } from './getColumnDataType_EnumFromComment';

export type GetColumnDataTypeContext = {
  dataType: string | null;
  columnType: string;
  columnComment: string;
  is_nullable: boolean;
  tinyintIsBoolean: boolean;
  table: string;
  column: string | null;
};
export type ColumnDataTypeResult = string | { type: string; comment?: string };

export const getColumnDataType = async (ctx: GetColumnDataTypeContext): Promise<ColumnDataTypeResult> => {
  const { dataType, columnType, tinyintIsBoolean } = ctx;
  if (dataType === null) {
    throw new Error('The DATA_TYPE field in information_schema should never be null. This may be a bug');
  }

  const r = await getColumnDataType_EnumFromComment(ctx);
  if (r) {
    return r;
  }

  switch (dataType) {
    case 'int':
    case 'smallint':
    case 'mediumint':
    case 'bigint':
    case 'float':
    case 'double':
    case 'numeric':
      return 'number';

    case 'char':
    case 'varchar':
    case 'text':
    case 'mediumtext':
    case 'longtext':
    case 'decimal':
      return 'string';

    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'Date';
    case 'year':
      return 'number';
    case 'time':
      return 'string';

    case 'binary':
    case 'varbinary':
    case 'blob':
    case 'tinyblob':
    case 'mediumblob':
    case 'longblob':
    case 'bit':
      return 'Buffer';

    case 'tinyint':
      if (columnType === 'tinyint(1)' && tinyintIsBoolean) {
        return 'boolean';
      }
      return 'number';

    case 'json':
      return 'any';

    case 'enum':
      return columnType
        .substring(5, columnType.length - 1)
        .split(',')
        .join(' | ');

    case 'set':
      return 'string';

    default:
      console.error('WARNING: unknown data type: ' + dataType);
      return 'any';
  }
};
