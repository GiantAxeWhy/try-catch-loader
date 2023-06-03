const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const loaderUtils = require("loader-utils");
const core = require("@babel/core");
// babel-template 用于将字符串形式的代码来构建AST树节点
const template = require("babel-template");
/*
 * catch要打印的信息
 * @param {string} funcName - 当前执行方法的名称
 * @param {string} customLog - 用户自定义的打印信息
 */
let identifierName = "行不行啊细狗";
let catchConsole = (funcName) => `
funcName: ${funcName}
`;
let tryTemplate = `
console.log(CatchError,e)
`;
//catch中的报错信息
const DEFAULT = {
  catchCode: (identifier) => `console.error(${identifier})`,
  identifier: "e",
  funcName: `console.error(行不行啊细狗)`,
  finallyCode: null,
};

//带有async的关键词
const isAsyncNode = (node) =>
  // 函数声明
  // 箭头函数
  // 函数表达式
  // 方法
  // 类
  t.isFunctionDeclaration(node, {
    async: true,
  }) ||
  t.isArrowFunctionExpression(node, {
    async: true,
  }) ||
  t.isFunctionExpression(node, {
    async: true,
  }) ||
  t.isObjectMethod(node, {
    async: true,
  }) ||
  t.isClassMethod(node, {
    async: true,
  });

//通过@babel/parser传入ast语法树和钩子函数
module.exports = function(source) {
  let options = loaderUtils.getOptions(this);
  let ast = parser.parse(source, {
    sourceType: "module", // 支持 es6 module
    plugins: ["dynamicImport"], // 支持动态 import
  });

  options = {
    ...DEFAULT,
    ...options,
  };

  if (typeof options.catchCode === "function") {
    options.catchCode = options.catchCode(options.identifier);
  }
  if (typeof options.funcName === "function") {
    options.funcName = options.funcName(options.identifierName);
  }
  // console.log(
  //   "parser.parse(options.catchCode)",
  //   parser.parse(options.catchCode)
  // );
  let catchNode = parser.parse(options.catchCode).program.body;
  let funcNode = parser.parse(options.funcName).program.body;
  console.log("funcNode", funcNode.expression);
  let finallyNode =
    options.finallyCode && parser.parse(options.finallyCode).program.body;

  //深度遍历语法树，当遍历节点的名称和钩子函数相同时，执行回调
  traverse(ast, {
    AwaitExpression(path) {
      //向上找到最顶层的异步的async为止
      while (path && path.node) {
        let parentPath = path.parentPath;
        // const temp = template(tryTemplate);

        //找到async function
        if (t.isBlockStatement(path.node) && isAsyncNode(parentPath.node)) {
          //这太扯了
          //options.funcName = path.node.name;
          const asyncPath = path.findParent(
            (p) =>
              p.node.async &&
              (p.isFunctionDeclaration() ||
                p.isArrowFunctionExpression() ||
                p.isFunctionExpression() ||
                p.isObjectMethod())
          );
          let type = asyncPath.node.type;
          // 获取async的方法名
          let asyncName = "";
          switch (type) {
            // 1️函数表达式
            // 情况1：普通函数，如const func = async function () {}
            // 情况2：箭头函数，如const func = async () => {}
            case "FunctionExpression":
            case "ArrowFunctionExpression":
              // 使用path.getSibling(index)来获得同级的id路径
              let identifier = asyncPath.getSibling("id");
              // 获取func方法名
              asyncName =
                identifier && identifier.node ? identifier.node.name : "";
              break;
            // 2️函数声明，如async function fn2() {}
            case "FunctionDeclaration":
              asyncName = (asyncPath.node.id && asyncPath.node.id.name) || "";
              break;
            // 3️async函数作为对象的方法，如vue项目中，在methods中定义的方法: methods: { async func() {} }
            case "ObjectMethod":
              asyncName = asyncPath.node.key.name || "";
              break;
          }

          // 若asyncName不存在，通过argument.callee获取当前执行函数的name
          funcName =
            asyncName ||
            (node.argument.callee && node.argument.callee.name) ||
            "";
          identifierName = funcName;
          // let tempArgumentObj = {
          //   // 通过types.stringLiteral创建字符串字面量
          //   CatchError: t.stringLiteral(
          //     catchConsole(funcName, options.customLog)
          //   ),
          // };
          // // 通过temp创建try语句
          // let tryNode = temp(tempArgumentObj);
          // console.log("tryNode", tryNode);
          // console.log("asyncPath.node", asyncPath.node);
          // 获取async节点(父节点)的函数体
          // let info = asyncPath.node.body;
          // tryNode.block.body.push(...info.body);

          // console.log("tryNode", tryNode);
          //创建一个try节点将await放入
          //tryStatement接受3个参数、try子句、finally子句、catch子句
          //console.log("options.identifier", options.identifier);
          //console.log("catchNode", catchNode);

          let tryCatchAstNode = t.tryStatement(
            path.node,
            //try子句
            //expressionStatement创建块级作用域承载await的node
            //t.blockStatement([t.expressionStatement(path.node)]),
            //catch子句
            t.catchClause(
              t.identifier(options.identifier),
              t.blockStatement(catchNode)
              // t.expressionStatement(...funcNode)
            ),

            finallyNode && t.blockStatement(finallyNode)
          );

          //Literal
          // 给模版增加key，添加console.log打印信息
          let tempArgumentObj = {
            // 通过types.stringLiteral创建字符串字面量
            CatchError: t.stringLiteral(catchConsole(funcName)),
          };
          // 通过temp创建try语句
          const temp = template(tryTemplate);
          console.log(
            "tryCatchAstNode.body",
            funcNode[0].expression.arguments[0]
          );
          let tryNode = temp(tempArgumentObj);

          console.log("tryNode", tryNode);
          console.log("tryCatchAstNode.handler", tryCatchAstNode.handler);
          //funcNode[0].expression.arguments[0] = Literal;
          tryCatchAstNode.handler.body.body.push(tryNode);

          path.replaceWithMultiple([tryCatchAstNode]);

          return;
        } else if (
          t.isBlockStatement(path.node) &&
          t.isTryStatement(parentPath.node)
        ) {
          return;
        }
        path = parentPath;
      }
    },
  });
  return core.transformFromAstSync(ast, null, {
    configFile: false, // 屏蔽 babel.config.js，否则会注入 polyfill 使得调试变得困难
  }).code;
};
