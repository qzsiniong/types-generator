import { ColumnDataTypeResult, GetColumnDataTypeContext, getColumnDataType } from './getColumnDataType';
// import { getFormat } from './utils';

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



export type GetColumnDataType = (ctx: GetColumnDataTypeContext) => Awaitable<ColumnDataTypeResult | null | undefined>;

export type FormatColumn = (ctx: Record<'comment' | 'column' | 'type', string>) => string;
export type FormatType = (ctx: { comment: string; typeName: string; fields: string }) => string;

type Options = {
  getColumnDataType?: GetColumnDataType;
  formatColumn?: FormatColumn;
  formatType?: FormatType;
}

export type Generator = (cxt: GeneratorContext) => Awaitable<string>;

export const defaultFormatColumn: FormatColumn = (ctx) => {
  return `
  /**
   * ${ctx.comment.split('\n').join('\n   * ')}
   */
  ${ctx.column}: ${ctx.type};`;
};

export const defaultFormatType: FormatType = (ctx) => {
  return `/**
 * ${ctx.comment}
 */
export type ${ctx.typeName} = {
${ctx.fields}
}
`;
};

export function createGenerator(options: Options): Generator {
  const { getColumnDataType: customGetColumnDataType, formatColumn = defaultFormatColumn, formatType = defaultFormatType } = options;

  return async function (cxt: GeneratorContext) {
    const { table, tableComment, typeName, columns, getColumnDataType, tinyintIsBoolean } = cxt;

    const list = columns.map(async (column) => {
      const ctx: GetColumnDataTypeContext = {
        table,
        column: column.columnName,
        dataType: column.dataType,
        columnType: column.columnType,
        columnComment: column.columnComment,
        is_nullable: column.isNullable,
        tinyintIsBoolean,
      };
      let type = await customGetColumnDataType?.(ctx);

      if (type === undefined || type === null) {
        type = await getColumnDataType(ctx);
      }

      const typeResult = typeof type === 'string' ? { type } : type;
      typeResult.type += column.isNullable ? ' | null' : '';

      return formatColumn({
        comment: typeResult.comment ?? column.columnComment.trim(),
        column: column.columnName,
        type: typeResult.type,
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
