/** Type shim for CSS Modules compiled by the shared tsdown preset. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
