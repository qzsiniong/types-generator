import { GetColumnDataTypeContext, getColumnDataType } from '../src/getColumnDataType';

describe('getColumnDataType', () => {
  it('converts enum properly', async () => {
    const dataType = 'enum';
    const columnType = `enum('value1','value2','value3')`;
    const columnComment = '';
    const res = await getColumnDataType({
      dataType,
      columnType,
      columnComment,
      tinyintIsBoolean: false,
      column: '',
      table: '',
      is_nullable: false,
    });
    expect(res).toEqual(`'value1' | 'value2' | 'value3'`);
  });

  it('converts enum from comment', async () => {
    const ctx = {
      columnType: '',
      columnComment: `enum('1','2:ss','3')`,
      is_nullable: false,
      column: '',
      table: '',
      tinyintIsBoolean: false,
    } satisfies Partial<GetColumnDataTypeContext>;

    let result = await getColumnDataType({
      ...ctx,
      dataType: 'text',
    });
    expect((result as any).type).toEqual(`'1' | '2' | '3'`);

    result = await getColumnDataType({
      ...ctx,
      dataType: 'int',
    });

    expect((result as any).type).toEqual(`1 | 2 | 3`);
  });
});
