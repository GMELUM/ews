declare module 'rollup-plugin-web-worker-loader';

declare module '*?worker&inline' {
    const workerConstructor: {
        new(): Worker
    }
    export default workerConstructor
}
