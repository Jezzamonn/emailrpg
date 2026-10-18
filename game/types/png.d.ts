// Bundled as binary data (wrangler "Data" rule, test/hbs-loader.mjs in tests).
declare module "*.png" {
  const content: ArrayBuffer;
  export default content;
}
