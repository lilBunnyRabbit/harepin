import { plugin } from "bun";
import { compile, compileModule } from "svelte/compiler";
import config from "../svelte.config.js";

// bun test has no DOM, so components compile for the server and tests assert on `render` from svelte/server.
plugin({
  name: "svelte",
  setup(build) {
    const ts = new Bun.Transpiler({ loader: "ts" });
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const { js } = compile(source, { ...config.compilerOptions, filename: path, generate: "server" });
      return { contents: js.code, loader: "js" };
    });
    build.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => {
      const source = ts.transformSync(await Bun.file(path).text());
      const { js } = compileModule(source, { filename: path, generate: "server" });
      return { contents: js.code, loader: "js" };
    });
  },
});
