import { GetColumnDataType } from '../generator';

// 1:尽快尽 done:完成 to-do:待办
// enum('value1','value2:label2','value3')
const enumReg = /enum\('[^']+'(,\s*'[^']+')+\)/g;

const dataTypes_enumNumber = ['int', 'smallint', 'mediumint', 'bigint', 'float', 'double', 'numeric', 'tinyint'];
const dataTypes_enumString = ['char', 'varchar', 'text', 'mediumtext', 'longtext', 'decimal'];

function parseEnumComment(comment: string) {
  const matched = comment.match(enumReg);
  if (!matched) return;

  const str = matched[0];

  return str
    .substring(5, str.length - 1)
    .split(/,\s*/)
    .map((it) => {
      const [value, label = ''] = it.substring(1, it.length - 1).split(':', 2);
      return {
        value,
        label,
      };
    });
}

export const getColumnDataType_EnumFromComment: GetColumnDataType = (ctx) => {
  const { dataType, columnComment } = ctx;

  if (dataType && [...dataTypes_enumNumber, ...dataTypes_enumString].includes(dataType)) {
    const isNumber = dataTypes_enumNumber.includes(dataType);
    const enumRe = parseEnumComment(columnComment);

    if (enumRe) {
      return {
        type: enumRe.map((it) => (isNumber ? it.value : `'${it.value}'`)).join(' | '),
        comment: columnComment,
      };
    }
  }
};
