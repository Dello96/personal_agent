function longestCommonPrefix(strs) {
  if (strs.length === 0) return "";

  let prefix = strs[0];

  for (let i = 1; i < strs.length; i++) {
    console.log(strs[i].indexOf(prefix));
  }
}

console.log("strs is" + longestCommonPrefix(["flower", "flow", "flight"]));
