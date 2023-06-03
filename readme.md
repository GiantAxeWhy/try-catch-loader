# try-catch loader for vue/webpack/react

A Webpack loader that wraps required JS in a try/catch
While the output content supports customization, the name of the error reporting method is synchronously output

一个 webpack 的 loader 插件，打包后可统一将 try catch 包裹进 try/catch 代码块中
输出内容支持自定义的同时，同步输出报错方法名称

## Why would I use that?

Some client-side JS libraries don't like being loaded on the server -
ones that do something like check `navigator.userAgent` when loading,
for example. This causes problems when you're trying to do server-side
rendering of a React/Vue component (for example) as the require statement
will fail.

loader 可以读取匹配到的文件，经过处理变成期望的输出结果.因此通过一个 webpack loader 来自动注入 try/catch 代码，打包之后 webpack 自动给生产环境的代码注入错误捕获的逻辑。
代码中已有 trycatch 代码块将会自动略过，考虑了多种情况

```js
//函数声明
async function fn() {
  await f();
}
// 函数表达式
const func = async function() {
  await asyncFunc();
};

// 箭头函数
const func2 = async () => {
  await asyncFunc();
};

// 方法
const vueComponent = {
  methods: {
    async func() {
      await asyncFunc();
    },
  },
};
```

## Give me an example

Fine. Consider the following Vue loader :

```js
module.exports = {
  publicPath: "./",
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.less$/,
          use: ["style-loader", "css-loader", "less-loader"],
        },
        {
          test: /\.js$/,
          use: {
            loader: "async-try-loader",
            options: {
              catchCode: `console.log(e)`,
            },
          },
        },
      ],
    },
  },
};
```

打包前代码如下

```js
 async init() {
      await new Promise((resolve, reject) => {
        reject("抛出错误");
      });
    },
```

打包后效果

```js
async function init() {
  try {
    await new Promise((resolve, reject) => {
      reject("抛出错误");
    });
  } catch (e) {
    console.log(e);
    console.log("funcName: init");
  }
}
```
