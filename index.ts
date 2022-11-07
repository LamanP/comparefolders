import { existsSync } from 'fs-extra';
import path from 'path';
import PromptSync from 'prompt-sync';
import { compare, createP4Files } from './Compare/Comparator';
import { Difference, DifferenceKind } from './Compare/Difference';
const ask = PromptSync();

function getFolder(prompt: string, argIndex: number) {
    let folder: string;
    if (argIndex < process.argv.length) {
        folder = process.argv[argIndex];
        if (existsSync(folder)) {
            return folder;
        }
    }
    do {
        folder = ask(prompt);
        if (folder.length === 0) {
            return null;
        }
        if (!existsSync(folder)) {
            console.error(`Folder "${path.resolve(folder)}" does not exist.`);
        }
    } while (!existsSync(folder));
    return folder;
}

function listDifferences(differences: Difference[], diffKind: DifferenceKind, folders: boolean) {
    const filteredDifferences = differences.filter(diff => diff.kind === diffKind && diff.isFolder === folders);
    if (filteredDifferences.length > 0) {
        console.log(`${folders ? "FOLDERS" : "FILES"} ${diffKind}`);
        filteredDifferences.forEach(diff => {
            console.log(diff.name);
        });
    }
}

/////// Start of program
const p4m = process.env.p4merge;
if (!p4m || !existsSync(p4m)) {
    console.log("Cannot locate P4Merge program.");
    console.log("- If you don't have it, download it from https://www.perforce.com and install it.");
    console.log("- If you installed it, create environment variable P4MERGE to translate to 'p4merge.exe'");
    console.log("- Then retry this script.");
    process.exit(1);
}

const leftFolder = getFolder("Left folder: ", 2);
if (!leftFolder) {
    process.exit(0);
}
console.log(`Left folder: ${path.resolve(leftFolder)}`);

const rightFolder = getFolder("Right folder: ", 3);
if (!rightFolder) {
    process.exit(0);
}
console.log(`Right folder: ${path.resolve(rightFolder)}`);

// Compare
const differences: Difference[] = [];
compare(differences, leftFolder, rightFolder);

console.log("\n\nRESULTS:\n\n");
console.log(`\nNumber of differences: ${differences.length}\n`);
listDifferences(differences, DifferenceKind.LEFT_ONLY, true);
listDifferences(differences, DifferenceKind.RIGHT_ONLY, true);
listDifferences(differences, DifferenceKind.LEFT_ONLY, false);
listDifferences(differences, DifferenceKind.RIGHT_ONLY, false);
listDifferences(differences, DifferenceKind.CONTENT, false);
const numBatches = createP4Files(differences);
if (numBatches > 0) {
    console.log(`${numBatches} batch file(s) created in ${path.resolve("./p4merge")}.`);
}