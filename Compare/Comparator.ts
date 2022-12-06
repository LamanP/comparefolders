import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs-extra";
import path from "path";
import { Difference, DifferenceKind } from "./Difference";

interface FolderItem {
    path: string,
    isFolder: boolean
}

function readFolder(folderPath: string): FolderItem[] {
    let fileCount = 0;
    let folderCount = 0
    const items: FolderItem[] = readdirSync(folderPath)
        .filter(name => name[0] !== '.')
        .map(name => `${folderPath}/${name}`)
        .map(path => {
            const stats = statSync(path);
            if (stats.isDirectory()) {
                ++folderCount;
            } else {
                ++fileCount;
            }
            return {
                path,
                isFolder: stats.isDirectory()
            };
        });
    items.sort((a, b) => {
        if (a.path < b.path) {
            return -1;
        }
        if (a.path > b.path) {
            return 1;
        }
        return 0;
    });
    return items;
}

function compareStrings(left: string, right: string) {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}

function compareItems(differences: Difference[], isFolder: boolean, leftContent: FolderItem[], rightContent: FolderItem[]) {
    const itemCount = Math.max(leftContent.length, rightContent.length);
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < leftContent.length || rightIndex < rightContent.length) {
        const leftItem = leftIndex < itemCount ? leftContent[leftIndex] : null;
        const rightItem = rightIndex < itemCount ? rightContent[rightIndex] : null;
        if (leftItem && rightItem) {
            const nameOrder = compareStrings(path.basename(leftItem.path), path.basename(rightItem.path));
            if (nameOrder === 0) { // File exists on both sides
                if (!isFolder && readFileSync(leftItem.path).toString() !== readFileSync(rightItem.path).toString()) {
                    differences.push({
                        kind: DifferenceKind.CONTENT,
                        isFolder: false,
                        name: leftItem.path,
                        otherName: rightItem.path
                    });
                } if (isFolder) {
                    // Compare subfolders
                    compare(differences, leftItem.path, rightItem.path);
                }
                ++leftIndex;
                ++rightIndex;
            } else if (nameOrder < 0) {
                differences.push({
                    isFolder,
                    kind: DifferenceKind.LEFT_ONLY,
                    name: leftItem.path
                });
                ++leftIndex;
            } else {
                differences.push({
                    isFolder,
                    kind: DifferenceKind.RIGHT_ONLY,
                    name: rightItem.path
                });
                ++rightIndex;
            }
        } else if (leftItem) {
            differences.push({
                kind: DifferenceKind.LEFT_ONLY,
                isFolder,
                name: leftItem.path
            });
            ++leftIndex;
        } else if (rightItem) {
            differences.push({
                kind: DifferenceKind.RIGHT_ONLY,
                isFolder,
                name: rightItem.path
            });
            ++rightIndex;
        }
    };
}

export function compare(differences: Difference[], leftFolder: string, rightFolder: string) {
    const leftContent = readFolder(leftFolder);
    const rightContent = readFolder(rightFolder);
    console.log("Comparing:");
    console.log(`\x09Left: ${leftFolder}`);
    console.log(`\x09Right: ${rightFolder}`);

    compareItems(differences, true, leftContent.filter(item => item.isFolder), rightContent.filter(item => item.isFolder));
    compareItems(differences, false, leftContent.filter(item => !item.isFolder), rightContent.filter(item => !item.isFolder));
}

export function createP4Files(differences: Difference[]) {
    const p4MergeFolder = path.resolve("./p4files");
    if (existsSync(p4MergeFolder)) {
        rmSync(p4MergeFolder, { recursive: true });
    }

    const contentDiffs = differences.filter(diff => diff.kind === DifferenceKind.CONTENT);
    if (contentDiffs.length > 0) {
        mkdirSync(p4MergeFolder);
        contentDiffs.forEach((diff, index) => {
            const batchLines: string[] = [];
            batchLines.push(`@echo off`);
            batchLines.push(`set left=${diff.name}`);
            batchLines.push(`set right=${diff.otherName}`);
            batchLines.push(`"%p4merge%" %left% %right%`);
            writeFileSync(`${p4MergeFolder}/p4merge_${path.basename(diff.name)}_${index}.bat`, batchLines.join("\r\n"));
        });
    }
    return contentDiffs.length;
}
