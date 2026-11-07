// libheif-js ships no types for its prebuilt ES module; the shape used is declared in src/lib/images/heic.ts.
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  const factory: () => Promise<unknown>;
  export default factory;
}
