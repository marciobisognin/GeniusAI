import ts from "typescript";

/**
 * Extrai o valor literal (array ou objeto) de uma declaração exportada de um
 * arquivo TypeScript, **sem executar o arquivo**. Isso é o que torna os
 * importadores desta biblioteca "puros" de verdade: `so-ia/src/lib/org/squad-registry.ts`
 * importa `@/lib/data/org-chart` (um alias que só resolve dentro do próprio
 * projeto so-ia) — rodar o arquivo quebraria; ler sua AST não.
 *
 * Suporta apenas literais estáticos (string, número, booleano, array, objeto,
 * `as const`). Uma referência a identificador/chamada de função no meio dos
 * dados gera um erro claro em vez de silenciosamente devolver `undefined`.
 */
export class NonStaticLiteralError extends Error {}

export function extractExportedLiteral(sourceText: string, exportName: string, fileName = "source.ts"): unknown {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = findVariableDeclaration(sourceFile, exportName);
  if (!declaration || !declaration.initializer) {
    throw new Error(`Declaração exportada "${exportName}" não encontrada em ${fileName}.`);
  }
  return literalToJs(declaration.initializer, exportName);
}

function findVariableDeclaration(node: ts.Node, name: string): ts.VariableDeclaration | undefined {
  let found: ts.VariableDeclaration | undefined;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      found = n;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function literalToJs(node: ts.Expression, context: string): unknown {
  // `as const` / type assertions — o dado real está em node.expression.
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return literalToJs(node.expression, context);
  }
  if (ts.isParenthesizedExpression(node)) {
    return literalToJs(node.expression, context);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const value = literalToJs(node.operand, context);
    if (typeof value !== "number") throw new NonStaticLiteralError(`Operador unário sobre valor não numérico em "${context}".`);
    return -value;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => literalToJs(el, context));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new NonStaticLiteralError(
          `Propriedade não suportada (esperado par chave:valor literal) em "${context}".`,
        );
      }
      const key = propertyNameToString(prop.name);
      obj[key] = literalToJs(prop.initializer, `${context}.${key}`);
    }
    return obj;
  }
  throw new NonStaticLiteralError(
    `Valor não-literal encontrado em "${context}" (${ts.SyntaxKind[node.kind]}) — este extrator só lê dados estáticos, nunca executa código.`,
  );
}

function propertyNameToString(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  throw new NonStaticLiteralError("Nome de propriedade computado não suportado.");
}
