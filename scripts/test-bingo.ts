import { calculateBingoPoints } from "../src/lib/calculateBingoPoints";

const case1 = [[1, 1], [1, 2], [1, 3], [1, 14], [2, 8], [2, 22], [2, 25], [8, 19]] as const;
const case2 = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [15, 19], [15, 10], [15, 21], [15, 9], [15, 25], [15, 1], [15, 27], [15, 13], [24, 5], [24, 16], [24, 23]] as const;

console.log("case1:", calculateBingoPoints(case1 as any));
console.log("case2:", calculateBingoPoints(case2 as any));
