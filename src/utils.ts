function format(template: string, context: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (substring, name) => {
    return context[name];
  });
}

export function getFormat<T>(template: string) {
  template = template.replace(/^\n|\n$/g, '');
  return (context: T) => format(template, context);
}
