import dts from 'rollup-plugin-dts';
import copy from "rollup-plugin-copy";
import typescript from '@rollup/plugin-typescript';

import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import { RollupOptions } from 'rollup';

const external = ["solid-js"];
const extensions = [".js", ".jsx", ".ts", ".tsx"]

const config: RollupOptions[] = [
    {
        external: (name) => external.includes(name),
        input: 'src/index.ts',
        output: {
            file: `dist/index.d.ts`,
            format: 'es',
        },
        plugins: [
            typescript({
                tsconfig: "tsconfig.json",
                sourceMap: false
            }),
            webWorkerLoader({
                targetPlatform: "base64",
                extensions: extensions,
                inline: true,
            }),
            dts(),
            copy({
                targets: [
                    { src: "LICENSE", dest: "dist" },
                    { src: "README.md", dest: "dist" },
                    { src: "src/solid/package.json", dest: "dist", rename: "solid/package.json" }
                ]
            })
        ],
    }
]

export default config;
