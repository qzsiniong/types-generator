import { getColumnDataType } from './getColumnDataType';
import { getFormat } from './utils';

export type Column = {
  columnName: string;
  columnComment: string;
  columnType: string;
  dataType: string;
  isNullable: boolean;
}

type GeneratorContext = {
  table: string;
  tableComment: string;
  columns: Column[];
  getColumnDataType: typeof getColumnDataType;
  typeName: string;
  tinyintIsBoolean: boolean;
}

type Awaitable<T> = Promise<T> | T;


type CustomGetColumnDataTypeContext = {
  dataType: string | null;
  columnType: string;
  is_nullable: boolean;
  tinyintIsBoolean: boolean;
  table: string;
  column: string | null;
}

export type CustomGetColumnDataType = (ctx: CustomGetColumnDataTypeContext) => Awaitable<string | null | undefined>;

type Options = {
  customGetColumnDataType?: CustomGetColumnDataType;
}

export type Generator = (cxt: GeneratorContext) => Awaitable<string>;

const formatColumn = getFormat<{ comment: string; column: string; type: string }>(
  `

  /**
   * {{comment}}
   */
  {{column}}: {{type}};`
);

const formatType = getFormat<{ comment: string; typeName: string; fields: string }>(
  `
/**
 * {{comment}}
 */
export type {{typeName}} = {
{{fields}}
}

`
);

export function getSimpleGenerator(options: Options): Generator {
  const { customGetColumnDataType } = options;

  return async function (cxt: GeneratorContext) {
    const { table, tableComment, typeName, columns, getColumnDataType, tinyintIsBoolean } = cxt;

    const list = columns.map(async (column) => {
      let type = await customGetColumnDataType?.({
        table,
        column: column.columnName,
        dataType: column.dataType,
        columnType: column.columnType,
        is_nullable: column.isNullable,
        tinyintIsBoolean,
      });

      if (type === undefined || type === null) {
        type = getColumnDataType(column.dataType, column.columnType, tinyintIsBoolean);
        type += column.isNullable ? ' | null' : '';
      }

      return formatColumn({
        comment: column.columnComment.trim(),
        column: column.columnName,
        type,
      });
    });
    const lst = await Promise.all(list);
    return formatType({
      comment: tableComment.trim(),
      typeName,
      fields: lst.join('\n'),
    });
  };
}
