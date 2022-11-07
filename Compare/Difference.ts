export enum DifferenceKind {
    LEFT_ONLY = "LEFT_ONLY",
    RIGHT_ONLY = "RIGHT_ONLY",
    CONTENT = "CONTENT"
}

export interface Difference {
    isFolder: boolean,
    name: string,
    otherName?: string,
    kind: DifferenceKind
}