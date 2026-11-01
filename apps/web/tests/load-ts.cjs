const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

module.exports = function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, relative);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  loaded._compile(source, filename);
  return loaded.exports;
};
