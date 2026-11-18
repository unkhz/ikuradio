// The run that names the kept: every Song the Archive holds that has no
// name, named by its own number, so that every Song wears a name, and no
// slug is worn by two. No mind is woken: what a Song's own number says is
// all the name it needs, and the namelessness is the Song's lore. The run
// reads only what it must; the check reads everything, and is made once,
// when the naming is done.
//
//   bun run names          name, and tell of what is left
//   bun run names --check  verify, that every Song wears a name, and no slug is worn by two
import { openArchive } from 'archive';
import { holdStudioFree } from './lib/lock.js';
import { nameKept, verifyNamed } from './lib/names.js';
// the Studio at work is let finish, and the lock is asked for again until
// it is free: this run writes the Archive as a Studio does, and the two
// shall not write it at once
try {
    await holdStudioFree();
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
const { store, where } = openArchive();
console.log(`the Archive is ${where}`);
if (process.argv.includes('--check')) {
    const { unmarked, mismatched } = await verifyNamed(store);
    if (unmarked.length || mismatched.length) {
        if (unmarked.length)
            console.error(`Songs without a name: ${unmarked.join(', ')}`);
        if (mismatched.length)
            console.error(`Songs whose name is worn by another: ${mismatched.join(', ')}`);
        process.exit(1);
    }
    console.log(`every Song the Archive holds has a name, and no slug is worn by two`);
    process.exit(0);
}
try {
    const { named, missing } = await nameKept(store);
    console.log(`${named} Songs named`);
    if (missing.length) {
        console.error(`these Songs are listed, and not there: ${missing.join(', ')}`);
        process.exitCode = 1;
    }
    else
        console.log('every Song the Archive holds wears a name');
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
//# sourceMappingURL=names.js.map