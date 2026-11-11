// The Receiver's icon, imported as a file: the import is the file's path,
// inside the executable when the Radio is compiled.
declare module '*.ico' {
  const path: string
  export default path
}
