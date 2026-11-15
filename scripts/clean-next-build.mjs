// Repeated incremental builds in this checkout can fail inside Next's cached analysis.
// A release build starts from generated output only; dependencies and browser data are untouched.
import { existsSync, lstatSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),target=resolve(root,".next");
if(dirname(target)!==root||!target.endsWith(`${process.platform==="win32"?"\\":"/"}.next`))throw new Error("Unexpected Next build output");
if(existsSync(target)){
 if(lstatSync(target).isSymbolicLink())throw new Error("Refusing to clear a symlinked Next build output");
 rmSync(target,{recursive:true,force:true});
}
