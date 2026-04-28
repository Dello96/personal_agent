// var twoSum = function (nums, target) {
//   const result = [];
//   for (i = 0; i < nums.length; i++) {
//     const next = i + 1;
//     if (i + next === target) {
//       result.push(i);
//       result.push(next);
//       console.log(result);
//     } else {
//     }
//   }
//   return result;
// };

var twoSum = function (nums, target) {
  const map = {};

  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];

    if (map[diff] !== undefined) {
      return [map[diff], i];
    }

    map[nums[i]] = i;
  }
};

test = twoSum([2, 7, 11, 15], 9);
test2 = twoSum([3, 2, 4], 6);
test3 = twoSum([3, 3], 6);

console.log(test);
console.log(test2);
console.log(test3);
